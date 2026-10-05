// ===================== Série a navazující díly =====================
// 1) Wikidata (známé série s pořadím dílů), 2) jinak podle názvu („Krvavá říše. 5. díl“) v katalogu knihoven.
// Na stránce knihy je řada obálek s předchozím/dalším dílem, „Celá série“ otevře samostatnou stránku série.
const seriesCache = new Map();   // id série -> { id, name, author, parts }
const partCache = new Map();     // název dílu -> nalezená kniha
let readParts = new Set(store.get("prectene-dily", []));
const partKey = (x) => plain(x.title);

async function loadSeries(book) {
  let data = null;
  try { data = await seriesFromWikidata(book); } catch {}
  if (!data?.parts || data.parts.length < 2) { try { data = await seriesFromTitle(book); } catch {} }
  if (!data?.parts || data.parts.length < 2 || !$("bSeries")) return;
  data.author = data.author || (book.author || "").split(", ")[0];
  seriesCache.set(data.id, data);
  renderSeriesStrip(book, data);
}

function renderSeriesStrip(book, data) {
  data.parts.forEach((x) => { if (x.current && !x.book) x.book = book; }); // aktuální díl = otevřená kniha
  const parts = data.parts.filter((x) => x.num != null || x.current);
  const cur = parts.findIndex((x) => x.current);
  const prev = cur > 0 ? parts[cur - 1] : null;
  const next = cur >= 0 ? parts[cur + 1] : null;
  const box = $("bSeries");
  box.hidden = false;
  box.innerHTML = `
    <div class="series-head">
      <h2>📚 Série: ${esc(data.name)} <small>· ${parts.filter((x) => x.num != null).length} ${plural(parts.length, "díl", "díly", "dílů")}</small></h2>
      <a class="linkbtn" href="#serie/${encodeURIComponent(data.id)}" id="bSeriesAll">Celá série a moje čtení →</a>
    </div>
    <div class="series-strip">${parts.map((x) => `
      <button class="scard ${x.current ? "current" : ""}" data-i="${data.parts.indexOf(x)}" ${x.current ? 'aria-current="true"' : ""}>
        <div class="cover" id="sc-${data.parts.indexOf(x)}">${x.book ? coverHtml(x.book) : placeholderHtml(x.title, data.author)}</div>
        <span class="sbadge">${x.num != null ? esc(x.num) + ". díl" : "mimo pořadí"}${x.current ? " · tady jsi" : ""}</span>
        <b>${esc(x.title)}</b>
      </button>`).join("")}
    </div>
    <div class="snav">
      ${prev ? `<button class="btn ghost" data-i="${data.parts.indexOf(prev)}">← <span>${esc(prev.num)}. díl: ${esc(prev.title)}</span></button>` : "<span></span>"}
      ${next ? `<button class="btn" data-i="${data.parts.indexOf(next)}"><span>${esc(next.num)}. díl: ${esc(next.title)}</span> →</button>` : ""}
    </div>`;
  box.querySelectorAll("[data-i]").forEach((b) => (b.onclick = () => openPart(data, data.parts[b.dataset.i])));
  $("bSeriesAll").onclick = () => { state.fromApp = true; };
  box.querySelector(".scard.current")?.scrollIntoView({ inline: "center", block: "nearest" });
  if (cur >= 0 && parts[cur].num != null) {
    $("bSeriesFact").hidden = false;
    $("bSeriesFact").innerHTML = `<b>${esc(parts[cur].num)}. díl</b>z ${parts.filter((x) => x.num != null).length}`;
  }
  // obálky ostatních dílů dohledáme na pozadí
  parts.forEach(async (x) => {
    if (x.book || x.current) return;
    const b = await resolvePart(x, data.author);
    const el = $("sc-" + data.parts.indexOf(x));
    if (b && el) el.innerHTML = coverHtml(b);
  });
}

function openPart(data, x) {
  if (x.current) return;
  state.fromApp = true;
  if (x.book) { cache.set(x.book.key, x.book); location.hash = bookHash(x.book); }
  else location.hash = "najit/" + encodeURIComponent(x.title) + "/" + encodeURIComponent(data.author || "");
}

// dohledá knihu k dílu z Wikidat: Open Library (česky, pak jakkoli) → katalog knihoven
async function resolvePart(x, author) {
  if (x.book) return x.book;
  const k = plain(x.title) + "|" + plain(author || "");
  if (partCache.has(k)) return (x.book = partCache.get(k));
  let book = null;
  try {
    const p = new URLSearchParams({ q: `title:(${x.title})${author ? ` author:(${author})` : ""}`, limit: 1, fields: FIELDS });
    if ($("lang").value) p.set("language", $("lang").value);
    let doc = (await (await fetch(`${API}/search.json?${p}`)).json()).docs?.[0];
    if (!doc && $("lang").value) { p.delete("language"); doc = (await (await fetch(`${API}/search.json?${p}`)).json()).docs?.[0]; }
    if (doc) book = toBook(doc);
    else book = (await kcSearch(x.title, "Title", 5)).find((b) => !author || sameAuthor(b, author)) || null;
  } catch {}
  partCache.set(k, book);
  return (x.book = book);
}

const WD_TYPES = "wd:Q7725634 wd:Q8261 wd:Q47461344 wd:Q1667921 wd:Q571";
const sparql = async (query) => (await cachedJson("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(query), 24 * 7)).results.bindings;
async function wdSearch(text, lang) {
  if (!text) return [];
  const u = `https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&origin=*&type=item&limit=5&language=${lang}&search=${encodeURIComponent(text)}`;
  return ((await cachedJson(u, 24 * 7)).search || []).map((x) => x.id);
}
async function seriesFromWikidata(book) {
  const ids = [...new Set([...(await wdSearch(book.original, "en")), ...(await wdSearch(book.title, "cs"))])];
  if (!ids.length) return null;
  // jen knihy – stejnojmenný film nebo videohra mají vlastní „série“
  const rows = await sparql(`SELECT ?book ?series WHERE {
    VALUES ?book { ${ids.map((x) => "wd:" + x).join(" ")} }
    VALUES ?type { ${WD_TYPES} } ?book wdt:P31 ?type; wdt:P179 ?series. }`);
  if (!rows.length) return null;
  // série té knihy, která se ve vyhledávání Wikidat objevila nejvýš
  const rank = (r) => ids.indexOf(r.book.value.split("/").pop());
  const best = rows.reduce((a, b) => (rank(b) < rank(a) ? b : a));
  return wdSeriesParts(best.series.value.split("/").pop(), best.book.value.split("/").pop());
}
async function wdSeriesParts(seriesQid, bookQid = null) {
  const rows = await sparql(`SELECT ?seriesLabel ?item ?itemLabel ?ord ?year WHERE {
    BIND(wd:${seriesQid} AS ?series)
    ?item wdt:P179 ?series.
    VALUES ?type { ${WD_TYPES} } ?item wdt:P31 ?type.
    OPTIONAL { ?item p:P179 ?st. ?st ps:P179 ?series. OPTIONAL { ?st pq:P1545 ?ord. } }
    OPTIONAL { ?item wdt:P577 ?d. BIND(YEAR(?d) AS ?year) }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "cs,mul,en". }
  } LIMIT 80`);
  if (!rows.length) return null;
  const items = new Map();
  for (const r of rows) {
    const label = r.itemLabel.value;
    if (/^Q\d+$/.test(label)) continue;
    const prev = items.get(r.item.value);
    const num = r.ord?.value && /^\d+$/.test(r.ord.value) ? r.ord.value : null; // jen celá čísla; „0.5“ = prequel
    if (!prev || (num && !prev.num)) items.set(r.item.value, { title: label, num, year: +r.year?.value || prev?.year || null, qid: r.item.value.split("/").pop() });
  }
  const parts = [...items.values()];
  parts.forEach((x) => { x.current = x.qid === bookQid; });
  // díly se stejným pořadím (např. cizojazyčná vydání) necháme jen jednou
  const seenNum = new Set();
  const clean = parts.sort(seriesOrder).filter((x) => x.num == null || x.current || (!seenNum.has(x.num) && seenNum.add(x.num)));
  let name = rows[0].seriesLabel?.value || "";
  if (!name || /^Q\d+$/.test(name)) {
    const titles = clean.filter((x) => x.num != null).map((x) => x.title);
    name = titles.reduce((a, t) => { let i = 0; while (i < a.length && a[i] === t[i]) i++; return a.slice(0, i); }, titles[0] || "").replace(/[\s:.,–-]+\S{0,2}$/, "").trim() || "Série";
  }
  return { id: "wd|" + seriesQid, name, parts: clean.filter((x) => x.num != null || x.current).concat(clean.filter((x) => x.num == null && !x.current).slice(0, 15)) };
}

async function seriesFromTitle(book) {
  const me = parseSeries(book.title);
  if (!me) return null;
  const author = (book.author || "").split(", ")[0];
  return seriesByName(me.name, author, book, me.num);
}
async function seriesByName(name, author, book = null, myNum = null) {
  const found = await kcSearch(name, "Title", 40);
  const byNum = new Map();
  for (const b of found) {
    const x = parseSeries(b.title);
    if (!x || plain(x.name) !== plain(name)) continue;
    if (author && !sameAuthor(b, author)) continue;
    if (!byNum.has(x.num)) byNum.set(x.num, { title: b.title, num: x.num, year: b.year, book: b });
  }
  if (book && myNum) {
    if (!byNum.has(myNum)) byNum.set(myNum, { title: book.title, num: myNum, year: book.year, book });
    byNum.get(myNum).current = true;
  }
  return { id: ["t", name, author].join("|"), name, author, parts: [...byNum.values()].sort(seriesOrder) };
}
async function seriesById(id) {
  const [kind, a, b] = id.split("|");
  if (kind === "wd") return wdSeriesParts(a);
  if (kind === "t") return seriesByName(a, b);
  return null;
}

// ---------- samostatná stránka série ----------
async function openSeries(id) {
  const page = $("seriesPage");
  closeBook();
  page.hidden = false;
  page.scrollTop = 0;
  document.body.style.overflow = "hidden";
  const back = `<div class="top"><button class="back" id="sBack">← Zpět</button></div>`;
  page.innerHTML = `<div class="wrap">${back}<p class="status">Načítám sérii…</p></div>`;
  $("sBack").onclick = seriesBack;

  let data = seriesCache.get(id);
  if (!data) { try { data = await seriesById(id); } catch {} if (data) seriesCache.set(id, data); }
  if ($("seriesPage").hidden) return;
  if (!data?.parts?.length) {
    page.innerHTML = `<div class="wrap">${back}<div class="empty"><b>📚</b>Sérii se nepodařilo načíst.</div></div>`;
    $("sBack").onclick = seriesBack;
    return;
  }
  const numbered = data.parts.filter((x) => x.num != null);
  const other = data.parts.filter((x) => x.num == null);
  data.author = data.author || "";

  const rowHtml = (x) => {
    const i = data.parts.indexOf(x);
    return `
      <div class="srow" id="sr-${i}">
        <div class="cover" id="sc2-${i}">${x.book ? coverHtml(x.book) : placeholderHtml(x.title, data.author)}</div>
        <div>
          <span class="sbadge">${x.num != null ? esc(x.num) + ". díl" : "mimo pořadí"}</span> <small style="color:var(--muted)">${x.year || ""}</small>
          <h3>${esc(x.title)}</h3>
          <p class="sdesc" id="sd-${i}"></p>
          <div class="actions">
            <button class="btn ghost" data-open="${i}">📖 Otevřít knihu</button>
            <button class="btn ghost" data-read="${i}">✓ Přečteno</button>
          </div>
        </div>
      </div>`;
  };
  page.innerHTML = `
    <div class="wrap" style="padding-bottom:calc(70px + env(safe-area-inset-bottom))">
      ${back}
      <h1>📚 ${esc(data.name)}</h1>
      <p class="by">${numbered.length} ${plural(numbered.length, "díl", "díly", "dílů")}${data.author ? " · " + esc(data.author) : ""}</p>
      <div class="actions" style="margin:12px 0 0"><button class="btn ghost" id="sFollow" style="min-height:40px;padding:8px 14px"></button></div>
      <div class="sprog"><i id="sProgBar"></i></div>
      <p class="status" id="sProg"></p>
      <div class="actions" id="sNextBox"></div>
      <div class="srows">${numbered.map(rowHtml).join("")}</div>
      ${other.length ? `<details class="series-more" style="margin-top:24px"><summary>Další knihy ze stejného světa (${other.length})</summary><div class="srows">${other.map(rowHtml).join("")}</div></details>` : ""}
    </div>`;
  $("sBack").onclick = seriesBack;
  page.querySelectorAll("[data-open]").forEach((b) => (b.onclick = () => openPart(data, data.parts[b.dataset.open])));
  page.querySelectorAll("[data-read]").forEach((b) => (b.onclick = () => {
    const k = partKey(data.parts[b.dataset.read]);
    readParts.has(k) ? readParts.delete(k) : readParts.add(k);
    store.set("prectene-dily", [...readParts]);
    checkBadges();
    updateSeriesProgress(data);
  }));
  updateSeriesProgress(data);
  const syncFollow = () => {
    const f = follows.series.find((x) => x.id === data.id);
    if (f && f.count !== numbered.length) { f.count = numbered.length; store.set("sledovani", follows); } // otevřením série se „nový díl“ označí jako viděný
    $("sFollow").textContent = f ? "🔔 Sérii sleduješ" : "🔔 Sledovat sérii";
    $("sFollow").classList.toggle("on", !!f);
  };
  syncFollow();
  $("sFollow").onclick = () => {
    const on = follows.series.some((x) => x.id === data.id);
    follows.series = on ? follows.series.filter((x) => x.id !== data.id) : [...follows.series, { id: data.id, name: data.name, author: data.author, count: numbered.length }];
    store.set("sledovani", follows);
    toast(on ? "Sérii už nesleduješ" : "Sérii sleduješ – nový díl uvidíš na úvodní stránce");
    syncFollow();
  };

  // obálky a krátké popisy dílů na pozadí
  data.parts.forEach(async (x, i) => {
    const b = await resolvePart(x, data.author);
    if (!b || $("seriesPage").hidden) return;
    const cov = $("sc2-" + i);
    if (cov) cov.innerHTML = coverHtml(b);
    try {
      let d = b.key.startsWith("kc:") ? kcDesc((await (await fetch(kcRecordUrl(b.kcId))).json()).records?.[0])
        : realDesc(await (await fetch(`${API}${b.key}.json`)).json());
      if (!d) return;
      d = d.slice(0, 400);
      d = (await translate(d)) || d;
      if ($("sd-" + i)) $("sd-" + i).textContent = d.length > 260 ? d.slice(0, 260).replace(/\s+\S*$/, "") + "…" : d;
    } catch {}
  });
}

// ukazatel „přečteno X z N“ a tip, kterým dílem pokračovat
function updateSeriesProgress(data) {
  const numbered = data.parts.filter((x) => x.num != null);
  const done = numbered.filter((x) => readParts.has(partKey(x))).length;
  $("sProgBar").style.width = (numbered.length ? (done / numbered.length) * 100 : 0) + "%";
  $("sProg").textContent = done ? `Přečteno ${done} z ${numbered.length}${done === numbered.length ? " – celá série! 🎉" : ""}` : "Označ díly, které už máš přečtené, a uvidíš, kde pokračovat.";
  const next = numbered.find((x) => !readParts.has(partKey(x)));
  data.parts.forEach((x, i) => {
    const row = $("sr-" + i);
    if (!row) return;
    const read = readParts.has(partKey(x));
    row.classList.toggle("read", read);
    row.classList.toggle("next", x === next && done > 0);
    const btn = row.querySelector("[data-read]");
    btn.classList.toggle("done", read);
    btn.textContent = read ? "✓ Přečteno" : "Označit jako přečtené";
  });
  const box = $("sNextBox");
  box.innerHTML = next && done ? `<button class="btn" id="sNext">📍 Pokračuj: ${esc(next.num)}. díl – ${esc(next.title)}</button>` : "";
  $("sNext")?.addEventListener("click", () => openPart(data, next));
}

function seriesBack() { if (state.fromApp) history.back(); else location.hash = ""; }
function closeSeries() {
  const page = $("seriesPage");
  if (page.hidden) return;
  page.hidden = true;
  page.innerHTML = "";
  document.body.style.overflow = "";
}

// otevře knihu podle názvu (díly série z Wikidat): Open Library → knihovny → Google Books → obyčejné hledání
async function openByTitle(title, author) {
  try {
    const p = new URLSearchParams({ q: `title:(${title})${author ? ` author:(${author})` : ""}`, limit: 1, fields: FIELDS });
    if ($("lang").value) p.set("language", $("lang").value);
    let doc = (await (await fetch(`${API}/search.json?${p}`)).json()).docs?.[0];
    if (!doc && $("lang").value) { p.delete("language"); doc = (await (await fetch(`${API}/search.json?${p}`)).json()).docs?.[0]; }
    if (doc) return location.replace("#" + bookHash(toBook(doc)));
    const kc = (await kcSearch(`${title} ${author}`, "AllFields", 5))[0];
    if (kc) return location.replace("#" + bookHash(kc));
  } catch {}
  location.replace("#");
  setMode("genre");
  $("q").value = title;
  search();
}
