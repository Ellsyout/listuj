// Testy čistých funkcí z js/pure.js (a nastavení z js/config.js).
// Spuštění:  node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(join(root, file), "utf8");

// config.js a pure.js nepracují se stránkou, takže je jde načíst i mimo prohlížeč
const ctx = vm.createContext({});
vm.runInContext(read("js/config.js") + "\n" + read("js/pure.js"), ctx);
const app = vm.runInContext(
  `({ plural, initials, esc, cleanDesc, realDesc, normKey, parseSeries, parseMood, moodQuery, olGenreQuery,
      kcAuthor, kcDesc, kcSubjects, sameAuthor, bookHash, plain, isoDate, fitsLength, seriesOrder,
      allocate, GENRES, OL_SUBJECT, GB_GENRES, KC_GENRES, MOODS, TOPICS, LENGTHS, PERIODS })`, ctx);
// objekty z jiného kontextu porovnáváme přes JSON
const plainObj = (x) => JSON.parse(JSON.stringify(x));

test("plural: české skloňování podle počtu", () => {
  assert.equal(app.plural(1, "kniha", "knihy", "knih"), "kniha");
  assert.equal(app.plural(3, "kniha", "knihy", "knih"), "knihy");
  assert.equal(app.plural(5, "kniha", "knihy", "knih"), "knih");
  assert.equal(app.plural(0, "kniha", "knihy", "knih"), "knih");
});

test("esc: nebezpečné znaky v názvu knihy", () => {
  assert.equal(app.esc(`<b>"Tom & Jerry's"</b>`), "&lt;b&gt;&quot;Tom &amp; Jerry&#39;s&quot;&lt;/b&gt;");
  assert.equal(app.esc(null), "");
});

test("normKey: stejná kniha z různých zdrojů má stejný klíč", () => {
  const a = app.normKey("Harry Potter a kámen mudrců", "J. K. Rowling");
  assert.equal(a, app.normKey("Harry Potter a Kámen mudrců", "Joanne K. Rowling"));
  assert.equal(a, app.normKey("Harry Potter & kámen mudrců", "J. K. Rowling"));
  assert.equal(a, app.normKey("Harry Potter a kámen mudrců (ilustrované vydání)", "J. K. Rowling, Jim Kay"));
});

test("normKey: díly jedné série se nesmí slít do jedné knihy", () => {
  assert.notEqual(
    app.normKey("Pekárna na pobřeží: Katastrofická sušenka", "Fiona Grace"),
    app.normKey("Pekárna na pobřeží: Zrádný koláček", "Fiona Grace"));
  assert.notEqual(app.normKey("Hobit", "J. R. R. Tolkien"), app.normKey("Hobit", "Armine Harutyunyan"));
});

test("parseSeries: název série a číslo dílu", () => {
  const cases = {
    "Krvavá říše. 5. díl": ["Krvavá říše", "5"],
    "Urla. 4": ["Urla", "4"],
    "Oči prázdnoty. 2, Architekti světů": ["Oči prázdnoty", "2"],
    "Edenovi. Díl 3., Garnet flats: na planině": ["Edenovi", "3"],
    "Měňavci ze Sherwoodu. Kniha 2.": ["Měňavci ze Sherwoodu", "2"],
    "V jeho autě (napínavý thriller ze série Lucy Crimsonová – 3. díl)": ["Lucy Crimsonová", "3"],
    "Věk nenávisti: Městské války 3": ["Věk nenávisti: Městské války", "3"],
  };
  for (const [title, [name, num]] of Object.entries(cases)) {
    assert.deepEqual(plainObj(app.parseSeries(title)), { name, num }, title);
  }
});

test("parseSeries: kniha bez čísla dílu není série", () => {
  assert.equal(app.parseSeries("Hobit"), null);
  assert.equal(app.parseSeries("Malý princ"), null);
  assert.equal(app.parseSeries("1984"), null);
});

test("seriesOrder: číslované díly podle pořadí, nečíslované nakonec", () => {
  const parts = [{ num: null, year: 1990 }, { num: "10" }, { num: "2" }, { num: null, year: 1980 }, { num: "1" }];
  const sorted = [...parts].sort(app.seriesOrder).map((x) => x.num ?? "–" + x.year);
  assert.deepEqual(sorted, ["1", "2", "10", "–1980", "–1990"]);
});

test("parseMood: žánr, zápor a délka", () => {
  const m = plainObj(app.parseMood("něco napínavého, ale ne horor, krátké"));
  assert.deepEqual(m.include, ["thrillers"]);
  assert.deepEqual(m.exclude, ["horror"]);
  assert.deepEqual(m.pages, [0, 250]);
});

test("parseMood: „bez“ a „nechci“ také vylučují", () => {
  assert.deepEqual(plainObj(app.parseMood("fantasy bez romantiky")).exclude, ["romance"]);
  assert.deepEqual(plainObj(app.parseMood("nechci nic smutného, radši vtipné")).exclude, ["grief"]);
  assert.deepEqual(plainObj(app.parseMood("nechci nic smutného, radši vtipné")).include, ["humor"]);
});

test("parseMood: romantasy nepřidá obyčejnou romantiku", () => {
  const m = plainObj(app.parseMood("romantasy s draky, ale ne horor"));
  assert.ok(m.include.includes("romantasy"));
  assert.ok(!m.include.includes("romance"), "romantika navíc: " + m.include);
  assert.deepEqual(m.exclude, ["horror"]);
});

test("parseMood: novinky, jazyk a dlouhé knihy", () => {
  const m = plainObj(app.parseMood("česká detektivka, novinky"));
  assert.deepEqual(m.include, ["detective_and_mystery_stories"]);
  assert.equal(m.period, "new");
  assert.equal(m.lang, "cze");
  assert.deepEqual(plainObj(app.parseMood("něco dlouhého a epického")).pages, [500, "*"]);
});

test("parseMood: „právě vyšlo“ a „čerstvé“ chtějí úplné novinky", () => {
  for (const t of ["něco napínavého, co právě vyšlo", "čerstvá romantasy", "nejnovější detektivka"]) {
    const m = plainObj(app.parseMood(t));
    assert.equal(m.fresh, true, t);
    assert.equal(m.period, "new", t);
    assert.equal(m.rest, "", t + " – slova o novosti se nemají hledat jako text");
  }
  const m = plainObj(app.parseMood("detektivka, novinky"));
  assert.equal(m.fresh, false);
  assert.equal(m.period, "new");
  assert.equal(plainObj(app.parseMood("něco napínavého")).fresh, false);
});

test("parseMood: motivy se hledají spolu se žánrem", () => {
  const m = plainObj(app.parseMood("romantika s upíry"));
  assert.deepEqual(m.include, ["romance"]);
  assert.deepEqual(m.topics.map((x) => x.ol), ["vampires"]);
  assert.equal(app.moodQuery(app.parseMood("romantika s upíry")), "subject:(romance) subject:(vampires)");
  assert.deepEqual(plainObj(app.parseMood("detektivka z Prahy")).topics.map((x) => x.kc), ["Praha"]);
  const w = plainObj(app.parseMood("kniha o druhé světové válce"));
  assert.deepEqual(w.include, ["war_stories"]);
  assert.deepEqual(w.topics.map((x) => x.label), ["2. světová válka"]);
  assert.equal(w.rest, "");
});

test("parseMood: slovo, které určilo žánr, není zároveň motiv", () => {
  const m = plainObj(app.parseMood("fantasy s draky pro mládež"));
  assert.deepEqual(m.include, ["fantasy", "young_adult_fiction"]);
  assert.deepEqual(m.topics.map((x) => x.ol), ["dragons"]);
  assert.deepEqual(plainObj(app.parseMood("o drakech")).topics, [], "„drakech“ už vzal žánr fantasy");
});

test("parseMood: „něco jako …“ hledá podobné knihy", () => {
  const m = plainObj(app.parseMood("něco jako Harry Potter, ale pro dospělé"));
  assert.equal(m.like, "Harry Potter");
  assert.deepEqual(m.exclude, ["juvenile_fiction"], "pro dospělé = bez knih pro děti");
  assert.equal(m.rest, "");
  assert.equal(plainObj(app.parseMood("podobné jako hobit")).like, "hobit");
  assert.equal(plainObj(app.parseMood("něco ve stylu Agathy Christie")).like, "Agathy Christie");
  const z = plainObj(app.parseMood("něco jako Zaklínač ale ne horor"));
  assert.equal(z.like, "Zaklínač");
  assert.deepEqual(z.exclude, ["horror"]);
});

test("parseMood: samotné „jako“ před obyčejným slovem není název knihy", () => {
  assert.equal(plainObj(app.parseMood("vtipná kniha jako dárek")).like, null);
  assert.deepEqual(plainObj(app.parseMood("vtipná kniha jako dárek")).include, ["humor"]);
});

test("parseMood: zápor u délky", () => {
  assert.deepEqual(plainObj(app.parseMood("psychologický thriller, ne moc dlouhý")).pages, [0, 350]);
  assert.deepEqual(plainObj(app.parseMood("psychologický thriller, ne moc dlouhý")).include, ["psychological_thrillers"]);
  assert.deepEqual(plainObj(app.parseMood("krátká romantika")).pages, [0, 250]);
  assert.deepEqual(plainObj(app.parseMood("dlouhá fantasy")).pages, [500, "*"]);
});

test("parseMood: nálady a další výrazy", () => {
  assert.deepEqual(plainObj(app.parseMood("oddechové čtení na dovolenou")).include, ["humor"]);
  assert.deepEqual(plainObj(app.parseMood("něco inspirativního")).include, ["self_help"]);
  assert.deepEqual(plainObj(app.parseMood("pořádná záhada")).include, ["detective_and_mystery_stories"]);
  assert.deepEqual(plainObj(app.parseMood("povídky o lásce")).topics.map((x) => x.ol), ["short stories"]);
});

test("allocate: oblíbenější žánr dostane víc míst, každý aspoň jedno", () => {
  const a = plainObj(app.allocate({ fantasy: 3, romance: 1, horror: 0.5 }, 18));
  assert.equal(Object.values(a).reduce((x, y) => x + y, 0), 18);
  assert.ok(a.fantasy > a.romance && a.romance >= a.horror && a.horror >= 1, JSON.stringify(a));
  const b = plainObj(app.allocate({ a: 2, b: 2, c: 2, d: 2 }, 3));
  assert.equal(Object.values(b).reduce((x, y) => x + y, 0), 3, "víc žánrů než míst");
  assert.deepEqual(plainObj(app.allocate({}, 10)), {});
});

test("nastavení: motivy mají téma pro oba zdroje", () => {
  for (const [re, ol, kc, label] of app.TOPICS) {
    assert.ok(typeof re.test === "function" && ol && kc && label, label);
    assert.ok(!/[()]/.test(kc), `téma „${kc}“ pro katalog knihoven nesmí obsahovat závorky`);
  }
});

test("parseMood: neznámá slova zůstanou jako text k hledání", () => {
  const m = plainObj(app.parseMood("kniha o včelách"));
  assert.deepEqual(m.include, []);
  assert.match(m.rest, /vcelach/);
});

test("moodQuery: dotaz pro Open Library", () => {
  assert.equal(app.moodQuery(app.parseMood("napínavé, ale ne horor")), "subject:(thrillers) -subject:(horror)");
  // samotný zápor potřebuje něco kladného, jinak by dotaz nic nevrátil
  assert.match(app.moodQuery(app.parseMood("ne horor")), /^subject:fiction /);
});

test("olGenreQuery: kterýkoli / všechny žánry", () => {
  assert.equal(app.olGenreQuery([], "any"), "");
  assert.equal(app.olGenreQuery(["fantasy"], "any"), "subject:(fantasy)");
  assert.equal(app.olGenreQuery(["fantasy", "horror"], "any"), "(subject:(fantasy) OR subject:(horror))");
  assert.equal(app.olGenreQuery(["fantasy", "horror"], "all"), "subject:(fantasy) subject:(horror)");
  assert.equal(app.olGenreQuery(["detective_and_mystery_stories"], "any"), "subject:(detective and mystery stories)");
  assert.equal(app.olGenreQuery(["romantasy"], "any"), "subject:(fantasy romance)");
});

test("olGenreQuery: žánr, který Open Library nezná", () => {
  assert.equal(app.olGenreQuery(["women"], "any"), null);
  assert.equal(app.olGenreQuery(["women", "fantasy"], "any"), "subject:(fantasy)");
  assert.equal(app.olGenreQuery(["women", "fantasy"], "all"), null);
});

test("fitsLength: kniha bez počtu stran filtrem neprojde", () => {
  assert.equal(app.fitsLength({ pages: 180 }, [0, 250]), true);
  assert.equal(app.fitsLength({ pages: 300 }, [0, 250]), false);
  assert.equal(app.fitsLength({ pages: null }, [0, 250]), false);
  assert.equal(app.fitsLength({}, [0, 250]), false);
  assert.equal(app.fitsLength({ pages: 900 }, [501, "*"]), true);
  assert.equal(app.fitsLength({ pages: null }, null), true, "bez filtru projde všechno");
});

test("kcAuthor: jméno bez letopočtů", () => {
  assert.equal(app.kcAuthor({ authors: { primary: { "Martino Chiacchiera, 1993-": [] } } }), "Martino Chiacchiera");
  assert.equal(app.kcAuthor({ authors: { primary: { "Dick Francis, 1920-2010": [], "Felix Francis, 1953-": [] } } }), "Dick Francis, Felix Francis");
  assert.equal(app.kcAuthor({ authors: { primary: {}, secondary: { "Jan Novák, 1950-": [] } } }), "Jan Novák");
  assert.equal(app.kcAuthor({}), "");
});

test("sameAuthor: podle příjmení, bez ohledu na diakritiku", () => {
  assert.equal(app.sameAuthor({ author: "Alena Mornštajnová" }, "Alena Mornstajnova"), true);
  assert.equal(app.sameAuthor({ author: "Alena Ježková" }, "Alena Mornštajnová"), false);
  assert.equal(app.sameAuthor({}, "Karel Čapek"), false);
});

test("realDesc: fyzický popis knihy není anotace", () => {
  assert.equal(app.realDesc({ description: "1 volume : 24 cm" }), null);
  assert.equal(app.realDesc({ description: "Krátké." }), null);
  assert.equal(app.realDesc({}), null);
  const long = "Bilbo Pytlík je hobit, který si užívá pohodlný život a nikdy necestuje dál než do své spižírny.";
  assert.equal(app.realDesc({ description: { value: long } }), long);
});

test("cleanDesc: odkazy a zdroj na konci popisu", () => {
  assert.equal(app.cleanDesc("Příběh [Bilba](https://example.org/bilbo).\n----------\nAlso contained in: X"), "Příběh Bilba.");
  assert.equal(app.cleanDesc("Text popisu ([source][1])"), "Text popisu");
});

test("kcDesc a kcSubjects: údaje z katalogu knihoven", () => {
  assert.equal(app.kcDesc({ summary: ["Krátké"] }), null);
  assert.equal(app.kcDesc({ summary: ["První odstavec anotace knihy z katalogu.", "Druhý odstavec."] }), "První odstavec anotace knihy z katalogu.\n\nDruhý odstavec.");
  assert.deepEqual(plainObj(app.kcSubjects({ subjects: [["fantasy"], ["české romány"], ["fantasy"]] })), ["fantasy", "české romány"]);
});

test("bookHash: adresa knihy podle zdroje", () => {
  assert.equal(app.bookHash({ key: "/works/OL82563W" }), "kniha/OL82563W");
  assert.equal(app.bookHash({ key: "gb:8XZctgEACAAJ", gbId: "8XZctgEACAAJ" }), "kniha/gb/8XZctgEACAAJ");
  assert.equal(app.bookHash({ key: "kc:cbvk.CbvkUsCat*1298706", kcId: "cbvk.CbvkUsCat*1298706" }), "kniha/kc/cbvk.CbvkUsCat*1298706");
});

test("isoDate: datum pro pole typu date", () => {
  assert.equal(app.isoDate(new Date(2026, 2, 5, 12).getTime()), "2026-03-05");
});

test("nastavení: každý žánr se dá hledat aspoň v jednom zdroji", () => {
  for (const [, label, id] of app.GENRES) {
    const ol = id in app.OL_SUBJECT ? app.OL_SUBJECT[id] : id;
    assert.ok(ol || app.KC_GENRES[id] || app.GB_GENRES[id], `žánr „${label}“ nemá žádný zdroj`);
  }
  const ids = app.GENRES.map((g) => g[2]);
  assert.equal(new Set(ids).size, ids.length, "žánry mají jedinečná id");
});

test("nastavení: žánry z rozboru věty existují", () => {
  const known = new Set([...app.GENRES.map((g) => g[2]), "dystopias", "grief"]);
  for (const [, subject, label] of app.MOODS) assert.ok(known.has(subject), `„${label}“ odkazuje na neznámý žánr ${subject}`);
});

test("index.html načítá všechny soubory z js/ a ty existují", () => {
  const html = read("index.html");
  const loaded = [...html.matchAll(/<script src="js\/([\w-]+\.js)\?v=[\w.-]+"><\/script>/g)].map((m) => m[1]);
  const onDisk = readdirSync(join(root, "js")).filter((f) => f.endsWith(".js"));
  assert.deepEqual([...loaded].sort(), [...onDisk].sort());
  assert.deepEqual(loaded.slice(0, 2), ["config.js", "pure.js"], "nastavení a čisté funkce se načítají první");
  assert.equal(loaded.at(-1), "main.js", "spouštěcí soubor se načítá poslední");
  assert.match(html, /<link rel="stylesheet" href="css\/styles\.css\?v=[\w.-]+">/);
});
