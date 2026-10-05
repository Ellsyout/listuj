# 📖 Listuj

Webová aplikace, která ti pomůže najít další knihu ke čtení.

- **Podle žánru**: vyber, na co máš chuť, a omez výběr jazykem a obdobím.
- **Podle autora**: všechny knihy daného autora od nejnovější.
- **Vlastními slovy**: napiš třeba „něco napínavého, ale ne horor“.
- **🎲 Překvap mě**: jedna náhodná kniha.
- **🎂 Dnes mají narozeniny**: spisovatelé narození v dnešní den.
- **Hledání podle názvu**: našeptávač knih a autorů, série s navazujícími díly.
- **Čtenářský deník**: Právě čtu, Přečteno, roční přehled a čtenářská výzva.
- **Pro tebe**: tipy podle knih, které se ti líbily.
- **Sledování autorů a sérií**: novinky na úvodní stránce.
- **Oblíbené, Chci si přečíst a vlastní hodnocení**: ukládají se v prohlížeči, dají se zálohovat do souboru.

## Zdroje dat

- [Open Library](https://openlibrary.org): knihy z celého světa, hodnocení, e-knihy
- [Google Books](https://books.google.com): nové knihy a české popisy
- [Knihovny.cz](https://www.knihovny.cz): souhrnný katalog českých knihoven, nejnovější české knihy
- [Wikipedie](https://cs.wikipedia.org) a [Wikidata](https://www.wikidata.org): narozeniny spisovatelů

## Spuštění

Stačí otevřít `index.html` v prohlížeči, nebo spustit malý server:

```
python -m http.server 5174
```

a otevřít http://localhost:5174.

## Jak je kód uspořádaný

Aplikace nepotřebuje žádné sestavování, prohlížeč načítá soubory přímo.

| Soubor | Co v něm je |
|---|---|
| `index.html` | kostra stránky |
| `css/styles.css` | vzhled a barevná témata |
| `js/config.js` | nastavení: žánry, jazyky, období, klíče a adresy zdrojů |
| `js/pure.js` | pomocné funkce bez vazby na stránku (pokryté testy) |
| `js/storage.js` | ukládání do prohlížeče, seznamy, barevná témata |
| `js/search.js` | hledání ve všech třech zdrojích, režimy, autor |
| `js/render.js` | mřížka výsledků a kartičky knih |
| `js/book.js` | stránka knihy, podobné knihy, historie |
| `js/series.js` | série a navazující díly |
| `js/extras.js` | Překvap mě, narozeniny spisovatelů |
| `js/diary.js` | deník, záloha, sdílení, sledování, Pro tebe, uvítání, O aplikaci |
| `js/omni.js` | našeptávač podle názvu, překlad popisů |
| `js/social.js` | žebříčky, sdílené seznamy, odznaky |
| `js/main.js` | adresy stránek (trasy) a spuštění |

Soubory se načítají v tomto pořadí a sdílejí společné proměnné.

## Testy

```
node --test tests/pure.test.mjs tests/contrast.test.mjs tests/share.test.mjs
```

`contrast.test.mjs` hlídá, aby texty a tlačítka ve všech barevných tématech měly dostatečný kontrast (WCAG). Testy dál pokrývají funkce z `js/pure.js`: rozbor věty v hledání vlastními slovy, spojování stejných knih z více zdrojů, rozpoznání dílu série, filtr délky a nastavení žánrů.

## Vydání nové verze

```
node --test tests/pure.test.mjs tests/contrast.test.mjs tests/share.test.mjs
node tools/stamp.mjs
git add -A
git commit -m "popis změny"
git push
```

`tools/stamp.mjs` změní označení verze u css/js souborů, aby prohlížeče nenačítaly staré kopie. Web na GitHub Pages se aktualizuje asi do minuty.

## Zpětná vazba a statistika

V `js/config.js` jsou dvě nastavení, prázdná hodnota znamená vypnuto:

- `FEEDBACK_ENDPOINT`: adresa formuláře [Formspree](https://formspree.io) pro „Napiš nám“
- `GOATCOUNTER`: název účtu [GoatCounter](https://www.goatcounter.com) pro anonymní počítání návštěv
