// Kontrast barev ve všech barevných tématech podle WCAG (běžný text aspoň 4,5 : 1, velké/tučné prvky 3 : 1).
// Spuštění:  node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "css", "styles.css"), "utf8");

// vytáhne barvy z bloků [data-theme="…"] { --bg: #…; … }
const themes = {};
for (const m of css.matchAll(/data-theme="(\w+)"\]\s*\{([^}]*)\}/g)) {
  themes[m[1]] = Object.fromEntries([...m[2].matchAll(/--([\w-]+):\s*(#[0-9a-f]{3,6})/gi)].map((x) => [x[1], x[2]]));
}

const hex = (h) => {
  const s = h.replace("#", "");
  const full = s.length === 3 ? [...s].map((c) => c + c).join("") : s;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
};
const lum = (h) => {
  const [r, g, b] = hex(h).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

test("css obsahuje všech šest barevných témat", () => {
  assert.deepEqual(Object.keys(themes).sort(), ["indigo", "koral", "les", "mata", "noc", "ocean"]);
});

for (const [name, c] of Object.entries(themes)) {
  test(`téma ${name}: text je dobře čitelný`, () => {
    for (const bg of ["bg", "paper", "soft"]) {
      assert.ok(ratio(c.ink, c[bg]) >= 4.5, `hlavní text na --${bg}: ${ratio(c.ink, c[bg]).toFixed(2)}`);
    }
    for (const bg of ["bg", "paper"]) {
      assert.ok(ratio(c.muted, c[bg]) >= 4.5, `šedý text na --${bg}: ${ratio(c.muted, c[bg]).toFixed(2)}`);
    }
  });
  test(`téma ${name}: tlačítka a odkazy`, () => {
    // text na barevném přechodu tlačítek (tučné písmo → stačí 3 : 1 na obou koncích přechodu)
    for (const a of ["a1", "a2"]) {
      assert.ok(ratio(c["on-accent"], c[a]) >= 3, `text tlačítka na --${a}: ${ratio(c["on-accent"], c[a]).toFixed(2)}`);
    }
    // barevné odkazy (--a1) na pozadí stránky a karet
    for (const bg of ["bg", "paper"]) {
      assert.ok(ratio(c.a1, c[bg]) >= 3, `odkaz --a1 na --${bg}: ${ratio(c.a1, c[bg]).toFixed(2)}`);
    }
  });
}
