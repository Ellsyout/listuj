// Sdílené seznamy: seznam zabalený do odkazu se musí rozbalit beze ztrát.
// Spuštění:  node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(join(root, file), "utf8");

// social.js potřebuje jen pár věcí z prohlížeče – Node je má také
const browserBits = { btoa, atob, TextEncoder, TextDecoder, Response, Blob, CompressionStream, DecompressionStream };
// social.js při načtení sahá na úložiště a jeden prvek stránky – v testu stačí jednoduché náhražky
const fakePage = { getElementById: () => ({ addEventListener() {} }) };
const fakeStore = { get: (k, d) => d, set() {} };
const ctx = vm.createContext({ ...browserBits, window: { ...browserBits }, document: fakePage, store: fakeStore });
vm.runInContext(read("js/config.js") + "\n" + read("js/pure.js") + "\n" + read("js/social.js"), ctx);
const app = vm.runInContext("({ encodeList, decodeList, packBook })", ctx);
const plainObj = (x) => JSON.parse(JSON.stringify(x));

const books = [
  { key: "/works/OL82563W", title: "Harry Potter a kámen mudrců", author: "J. K. Rowling", cover: 15155833, year: 1997 },
  { key: "gb:8XZctgEACAAJ", gbId: "8XZctgEACAAJ", title: "Hra o trůny", author: "George R. R. Martin", coverUrl: "https://books.google.com/x?id=1&zoom=1", year: 2011 },
  { key: "kc:cbvk.CbvkUsCat*1298706", kcId: "cbvk.CbvkUsCat*1298706", title: "Žluťoučký kůň „úpěl“ ďábelské ódy", author: "", year: null },
];

test("seznam projde odkazem beze ztrát (diakritika, všechny tři zdroje)", async () => {
  const code = await app.encodeList("Moje oblíbené – fantasy & spol.", books);
  assert.match(code, /^[zj][\w-]+$/, "odkaz obsahuje jen bezpečné znaky");
  const back = plainObj(await app.decodeList(code));
  assert.equal(back.name, "Moje oblíbené – fantasy & spol.");
  assert.equal(back.books.length, 3);
  for (const [i, b] of books.entries()) {
    assert.equal(back.books[i].key, b.key);
    assert.equal(back.books[i].title, b.title);
    assert.equal(back.books[i].author, b.author);
  }
  assert.equal(back.books[0].cover, 15155833);
  assert.equal(back.books[1].coverUrl, books[1].coverUrl);
  assert.equal(back.books[1].gbId, "8XZctgEACAAJ");
  assert.equal(back.books[2].kcId, "cbvk.CbvkUsCat*1298706");
});

test("dlouhý seznam se zkrátí na 60 knih a odkaz zůstane rozumně krátký", async () => {
  const many = Array.from({ length: 80 }, (_, i) => ({ key: `/works/OL${1000 + i}W`, title: `Kniha číslo ${i}`, author: "Autor Autorovič", cover: 100000 + i, year: 2000 + (i % 20) }));
  const code = await app.encodeList("Velký seznam", many);
  const back = plainObj(await app.decodeList(code));
  assert.equal(back.books.length, 60);
  assert.ok(code.length < 4000, `odkaz má ${code.length} znaků`);
});

test("poškozený odkaz vyhodí chybu (aplikace pak ukáže hlášku)", async () => {
  await assert.rejects(() => app.decodeList("zNESMYSL"));
});
