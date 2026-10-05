// Hledání podle nálady s AI: logika serveru (ai-worker/src/logic.js) a převod odpovědi v aplikaci (aiToMood).
// Skutečná AI se tu nevolá – odpovědi Claude jsou podvržené.
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { GENRES, SCHEMA, ALLOWED_ORIGINS, sanitize, validateInput, createLimiter, handle } from "../ai-worker/src/logic.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ctx = vm.createContext({});
vm.runInContext(readFileSync(join(root, "js/config.js"), "utf8") + "\n" + readFileSync(join(root, "js/pure.js"), "utf8"), ctx);
const app = vm.runInContext("({ aiToMood, GENRES, MOODS })", ctx);
const plainObj = (x) => JSON.parse(JSON.stringify(x));

const req = (body, { origin = ALLOWED_ORIGINS[0], method = "POST", path = "/nalada", ip = "1.2.3.4" } = {}) =>
  new Request("https://listuj-ai.example.workers.dev" + path, {
    method,
    headers: { "Content-Type": "application/json", Origin: origin, "CF-Connecting-IP": ip },
    body: method === "POST" ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
  });
const okLimiter = () => true;

test("server zná přesně stejné žánry jako aplikace", () => {
  const appIds = [...app.GENRES.map((g) => g[2]), "dystopias", "grief"].sort();
  assert.deepEqual(Object.keys(GENRES).sort(), appIds);
  assert.deepEqual([...SCHEMA.properties.genres.items.enum].sort(), appIds);
});

test("schéma odpovědi: všechna pole povinná, žádná navíc", () => {
  assert.equal(SCHEMA.additionalProperties, false);
  assert.deepEqual([...SCHEMA.required].sort(), Object.keys(SCHEMA.properties).sort());
});

test("vstup: prázdná a příliš dlouhá věta neprojde", () => {
  assert.ok(validateInput({}).error);
  assert.ok(validateInput({ text: " " }).error);
  assert.ok(validateInput({ text: "x".repeat(301) }).error);
  assert.equal(validateInput({ text: "  temná fantasy  " }).text, "temná fantasy");
});

test("pročištění odpovědi AI: jen známé hodnoty a rozumné délky", () => {
  const out = sanitize({
    genres: ["fantasy", "neexistuje", "fantasy", "horror", "romance", "humor"],
    exclude: ["horror", "thrillers"],
    topics: [{ cs: "draci", en: "Dragons" }, { cs: "<script>", en: "x" }, { cs: "", en: "y" }, { cs: "a", en: "b" }, { cs: "c", en: "d" }],
    like: "Harry Potter",
    length: "obří",
    fresh: "ano",
    audience: "adult",
    lang: "klingonština",
    summary: "Hledám temnou fantasy.",
  });
  assert.deepEqual(out.genres, ["fantasy", "horror", "romance"]);
  assert.deepEqual(out.exclude, ["thrillers"], "žánr nemůže být zároveň chtěný i vyloučený");
  assert.deepEqual(out.topics, [{ cs: "draci", en: "dragons" }, { cs: "a", en: "b" }, { cs: "c", en: "d" }]);
  assert.equal(out.length, "any");
  assert.equal(out.fresh, false);
  assert.equal(out.lang, "any");
  assert.equal(out.audience, "adult");
});

test("server: zpracuje větu a vrátí pročištěné filtry", async () => {
  let asked = null;
  const res = await handle(req({ text: "něco jako Harry Potter, ale temnější a pro dospělé" }), async (t) => {
    asked = t;
    return { genres: ["fantasy"], exclude: [], topics: [], like: "Harry Potter", length: "any", fresh: false, audience: "adult", lang: "any", summary: "Hledám temnější fantasy jako Harry Potter pro dospělé." };
  }, okLimiter);
  assert.equal(res.status, 200);
  assert.equal(asked, "něco jako Harry Potter, ale temnější a pro dospělé");
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), ALLOWED_ORIGINS[0]);
  const data = await res.json();
  assert.equal(data.like, "Harry Potter");
  assert.deepEqual(data.genres, ["fantasy"]);
});

test("server: cizí web, špatná adresa, nesmysl a zahlcení se odmítnou", async () => {
  const never = async () => { throw new Error("AI se nemá volat"); };
  assert.equal((await handle(req({ text: "fantasy" }, { origin: "https://zly-web.cz" }), never, okLimiter)).status, 403);
  assert.equal((await handle(req({ text: "fantasy" }, { path: "/jinam" }), never, okLimiter)).status, 404);
  assert.equal((await handle(req("{nesmysl"), never, okLimiter)).status, 400);
  assert.equal((await handle(req({ text: "" }), never, okLimiter)).status, 400);
  assert.equal((await handle(req({ text: "fantasy" }), never, () => false)).status, 429);
  const pre = await handle(req(null, { method: "OPTIONS" }), never, okLimiter);
  assert.equal(pre.status, 204);
  assert.match(pre.headers.get("Access-Control-Allow-Methods"), /POST/);
});

test("server: když AI selže, vrátí chybu a aplikace použije slovník", async () => {
  const res = await handle(req({ text: "fantasy" }), async () => null, okLimiter);
  assert.equal(res.status, 502);
});

test("omezení dotazů: nejvýš N za okno, pak zase volno", () => {
  const allow = createLimiter(3, 60_000);
  assert.deepEqual([1, 2, 3, 4].map((i) => allow("ip", 1000 + i)), [true, true, true, false]);
  assert.equal(allow("jina-ip", 1005), true);
  assert.equal(allow("ip", 1000 + 61_000), true, "po minutě znovu povoleno");
});

test("aplikace: odpověď AI má stejný tvar jako slovník", () => {
  const m = plainObj(app.aiToMood({
    genres: ["fantasy"], exclude: ["horror"], topics: [{ cs: "draci", en: "dragons" }], like: "Zaklínač",
    length: "not_long", fresh: true, audience: "adult", lang: "cze", summary: "Hledám fantasy s draky.",
  }));
  assert.deepEqual(m.include, ["fantasy"]);
  assert.deepEqual(m.exclude, ["horror", "juvenile_fiction", "young_adult_fiction"]);
  assert.deepEqual(m.topics, [{ ol: "dragons", kc: "draci", label: "draci" }]);
  assert.equal(m.like, "Zaklínač");
  assert.deepEqual(m.pages, [0, 350]);
  assert.equal(m.period, "new");
  assert.equal(m.lang, "cze");
  assert.equal(m.ai, true);
  assert.equal(m.rest, "");
  // klíče shodné s parseMood, aby zbytek aplikace fungoval beze změny
  const dict = Object.keys(plainObj(vm.runInContext('parseMood("fantasy")', ctx)));
  for (const k of dict) assert.ok(k in m, `chybí pole ${k}`);
});

test("aplikace: čtenář pro děti / mládež přidá odpovídající žánr", () => {
  assert.ok(plainObj(app.aiToMood({ genres: ["fantasy"], audience: "children" })).include.includes("juvenile_fiction"));
  assert.ok(plainObj(app.aiToMood({ genres: ["romance"], audience: "teen" })).include.includes("young_adult_fiction"));
});
