// Před vydáním nové verze: přepíše označení verze u css/js souborů v index.html,
// aby prohlížeče nenačítaly staré kopie z mezipaměti.
// Spuštění:  node tools/stamp.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const file = join(dirname(fileURLToPath(import.meta.url)), "..", "index.html");
const d = new Date();
const pad = (n) => String(n).padStart(2, "0");
const version = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}`;

const html = readFileSync(file, "utf8");
const stamped = html.replace(/((?:css|js)\/[\w-]+\.(?:css|js))\?v=[\w.-]+/g, `$1?v=${version}`);
const count = (stamped.match(new RegExp(`\\?v=${version}`, "g")) || []).length;
if (!count) throw new Error("V index.html jsem nenašel žádný odkaz na css/js soubory.");
writeFileSync(file, stamped);
console.log(`Verze ${version} nastavena u ${count} souborů.`);
