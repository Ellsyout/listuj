// Server (Cloudflare Worker) pro hledání podle nálady: větu čtenáře převede Claude na filtry aplikace.
// Klíč k Claude je uložený jako tajná proměnná ANTHROPIC_API_KEY (nikdy v kódu).
import Anthropic from "@anthropic-ai/sdk";
import { MODEL, SCHEMA, SYSTEM, createLimiter, handle } from "./logic.js";

const limiter = createLimiter(10, 60_000); // nejvýš 10 dotazů za minutu z jedné adresy

async function askClaude(text, env) {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 2000,
      // když bezpečnostní filtr dotaz odmítne, server ho zkusí na doporučeném záložním modelu
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      // jednoduchý úkol – nízká míra přemýšlení stačí a je rychlejší i levnější
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: "user", content: text }],
    });
    if (response.stop_reason === "refusal") return null;
    const block = response.content.find((b) => b.type === "text");
    return block ? JSON.parse(block.text) : null;
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) console.warn("Claude: překročen limit dotazů");
    else if (error instanceof Anthropic.AuthenticationError) console.error("Claude: neplatný klíč ANTHROPIC_API_KEY");
    else if (error instanceof Anthropic.APIError) console.error(`Claude: chyba ${error.status}`, error.message);
    else console.error("Claude: neočekávaná chyba", error);
    return null;
  }
}

export default {
  async fetch(request, env) {
    return handle(request, (text) => askClaude(text, env), limiter);
  },
};
