// ===================== Ovládací prvky =====================
// žánrů jde vybrat víc najednou; kombinují se „kterýkoli z nich“ nebo „všechny najednou“
GENRES.forEach(([emoji, label, id]) => {
  const b = document.createElement("button");
  b.className = "chip";
  b.dataset.genre = id;
  b.textContent = `${emoji} ${label}`;
  b.setAttribute("aria-pressed", "false");
  b.onclick = () => {
    state.genres = state.genres.includes(id) ? state.genres.filter((g) => g !== id) : [...state.genres, id];
    syncGenres();
    search();
  };
  $("genres").appendChild(b);
});
function syncGenres() {
  document.querySelectorAll("#genres .chip").forEach((c) => c.setAttribute("aria-pressed", String(state.genres.includes(c.dataset.genre))));
  $("genreMode").hidden = state.genres.length < 2;
  $("genreCount").textContent = `Vybráno ${state.genres.length} ${plural(state.genres.length, "žánr", "žánry", "žánrů")}:`;
  document.querySelectorAll("#genreMode [data-gm]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.gm === state.genreMode)));
}
document.querySelectorAll("#genreMode [data-gm]").forEach((b) => (b.onclick = () => { state.genreMode = b.dataset.gm; syncGenres(); search(); }));
$("genreClear").onclick = () => { state.genres = []; syncGenres(); search(); };
const fmt = () => $("format").value; // "", "ebook" nebo "audio"
$("length").onchange = () => { if (state.searched || state.mode === "author") search(); };
// rozsah stran: z věty v režimu „vlastními slovy“, jinak z výběru Délka
function lengthRange() {
  if (state.mode === "mood" && state.mood?.pages) return state.mood.pages;
  return LENGTHS[$("length").value] || null;
}
$("format").onchange = () => { if (state.searched || state.mode === "author") search(); };
const genreLabel = (id) => { const g = GENRES.find((x) => x[2] === id); return g ? `${g[0]} ${g[1]}` : id; };
LANGS.forEach(([code, name]) => $("lang").add(new Option(name, code)));
PERIODS.forEach(([id, name]) => $("period").add(new Option(name, id)));
$("lang").onchange = () => { if (state.mode === "author" && state.author) search(); else if (state.searched) search(); };
$("period").onchange = () => search();
$("sort").onchange = () => { state.top = false; if (state.searched) search(); };

function setMode(mode) {
  state.mode = mode;
  $("panel").className = "panel mode-" + mode;
  document.querySelectorAll("#modeSeg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
  $("qLabel").textContent = { author: "Jméno autora", mood: "Na co máš náladu?" }[mode] || "Téma nebo klíčové slovo";
  $("q").placeholder = { author: "např. Karel Čapek, Agatha Christie…", mood: "např. něco napínavého a čerstvého, ale ne horor…" }[mode] || "např. draci, vesmír, Praha…";
  $("surprise").hidden = $("top").hidden = mode !== "genre";
  if (mode !== "mood") { $("moodParse").hidden = true; $("fresh").hidden = true; $("likeBox").hidden = true; }
  if (mode !== "author") { $("authorBox").hidden = true; state.author = null; }
}
document.querySelectorAll("#modeSeg button").forEach((b) => (b.onclick = () => {
  const mode = b.dataset.mode;
  if (state.mode === mode) return;
  setMode(mode);
  $("q").value = "";
  if (location.hash.startsWith("#autor")) location.hash = "";
  if (mode === "genre") { state.searched = false; search(); return; }
  state.books = []; state.total = 0; state.searched = false;
  showView("results");
  $("status").textContent = "";
  $("more").hidden = $("gridHint").hidden = true;
  $("grid").innerHTML = mode === "author"
    ? `<div class="empty"><b>✍️</b>Napiš jméno autora a ukážeme ti všechny jeho knihy.</div>`
    : `<div class="empty"><b>💬</b>Popiš vlastními slovy, na co máš chuť – třeba „něco napínavého, ale ne horor“.</div>`;
  $("q").focus();
}));
MOOD_EXAMPLES.forEach((text) => {
  const b = document.createElement("button");
  b.className = "chip";
  b.textContent = text;
  b.onclick = () => { $("q").value = text; search(); };
  $("moodExamples").appendChild(b);
});

// ===================== Hledání vlastními slovy =====================



function showMoodParse(m) {
  const el = $("moodParse");
  el.hidden = false;
  el.innerHTML = m.labels.length
    ? `Rozumím: ${m.labels.map((l) => `<span class="tag ${l.neg ? "no" : l.neg === false ? "yes" : ""}">${l.neg ? "✗ bez: " : l.neg === false ? "✓ " : ""}${esc(l.label)}</span>`).join("")}`
    : `Nepoznala jsem žádný žánr ani motiv, hledám podle slov „${esc(m.rest || $("q").value)}“. Zkus třeba „romantika s upíry“ nebo „něco jako Hobit“.`;
}

// „ne horor“ u knih z Google Books a knihoven: hledáme slovo v názvu, tématech a začátku popisu
function moodExcluded(book) {
  if (state.mode !== "mood" || !state.mood?.exclude.length) return false;
  return state.mood.exclude.some((subject) => MOODS.find((x) => x[1] === subject)?.[0].test(book.tagsText || ""));
}

// žánr a text pro Google Books a knihovny (v režimu „vlastními slovy“ podle rozboru věty)
function activeGenres() {
  if (state.mode === "mood") return { list: state.mood?.include || [], mode: "all" };
  return { list: state.genres, mode: state.genreMode };
}
function activeText() {
  if (state.mode !== "mood") return $("q").value.trim();
  return state.mood?.include.length ? "" : state.mood?.rest || "";
}

// ===================== Záložky =====================
function renderTabs() {
  const tabs = [
    ["results", "Výsledky"],
    ["diary", `📔 Můj deník (${lists.reading.length + lists.read.length})`],
    ["fav", `♥ Oblíbené (${lists.fav.length})`],
    ["want", `🔖 Chci si přečíst (${lists.want.length})`],
    ["rated", `⭐ Moje hodnocení (${Object.keys(myRatings).length})`],
  ];
  $("tabs").innerHTML = tabs.map(([id, label]) =>
    `<button class="tab" role="tab" data-view="${id}" aria-selected="${state.view === id}">${label}</button>`).join("");
  $("tabs").querySelectorAll(".tab").forEach((t) => (t.onclick = () => {
    showView(t.dataset.view);
    if (t.dataset.view === "results" && !state.searched && state.mode === "genre") search(); else render();
  }));
}
function showView(view) {
  state.view = view;
  $("tabs").querySelectorAll(".tab").forEach((t) => t.setAttribute("aria-selected", String(t.dataset.view === view)));
}

// ===================== Hledání knih =====================
function toBook(doc) {
  // název vydání jen tehdy, když je opravdu ve zvoleném jazyce (bez filtru jazyka vrací Open Library vydání v libovolném jazyce)
  const lang = $("lang").value;
  const edAny = doc.editions?.docs?.[0];
  const ed = edAny && (!lang || !edAny.language || edAny.language.includes(lang)) ? edAny : null;
  const title = lang && ed?.title ? ed.title : doc.title;
  const book = {
    key: doc.key, title,
    original: title !== doc.title ? doc.title : null,
    author: (doc.author_name || []).slice(0, 2).join(", "),
    authorKeys: (doc.author_key || []).slice(0, 2),
    year: doc.first_publish_year,
    cover: ed?.cover_i || doc.cover_i || null,
    rating: doc.ratings_average, ratings: doc.ratings_count,
    editions: doc.edition_count, pages: doc.number_of_pages_median,
    ebook: doc.ebook_access, ia: doc.ia?.[0],
    ebookAvail: ["public", "borrowable"].includes(doc.ebook_access),
  };
  cache.set(book.key, book);
  return book;
}

async function search({ append = false, random = false } = {}) {
  if (state.mode === "author" && !state.author) return findAuthor();
  const text = $("q").value.trim();
  if (state.mode === "genre" && !state.genres.length && !text && !$("period").value && $("sort").value !== "rating") {
    $("status").textContent = "";
    $("grid").innerHTML = `<div class="empty"><b>👆</b>Vyber žánr nebo napiš téma a najdeme ti knihy.</div>`;
    return;
  }
  if (state.mode === "mood" && !append) {
    if (!text) {
      $("grid").innerHTML = `<div class="empty"><b>💬</b>Popiš vlastními slovy, na co máš chuť – třeba „něco napínavého, ale ne horor“.</div>`;
      return;
    }
    state.mood = parseMood(text);
    // u nálady rozhoduje obsah: bez „novinky“ ve větě hledáme ve všech letech (novinky jsou zvlášť v „Právě vyšlo“)
    $("period").value = state.mood.period || "";
    if (state.mood.lang) $("lang").value = state.mood.lang;
    if (state.mood.fresh) $("sort").value = "new";
    showMoodParse(state.mood);
    // „něco jako Harry Potter“ bez dalších přání: výsledky jsou rovnou knihy podobné té zmíněné
    const onlyLike = state.mood.like && !state.mood.include.length && !state.mood.topics.length && !state.mood.rest;
    $("likeBox").hidden = true;
    if (state.mood.like) {
      const like = loadLike(state.mood.like, !onlyLike);
      if (onlyLike) {
        $("fresh").hidden = true;
        state.controller?.abort();
        state.searched = true;
        showView("results");
        $("status").textContent = "Hledám podobné knihy…";
        $("more").hidden = true;
        $("grid").innerHTML = skeletons(12);
        const books = await like;
        if (state.mode !== "mood" || $("q").value.trim() !== text) return; // mezitím přišlo jiné hledání
        state.books = books; state.total = books.length;
        state.olMore = state.gbMore = state.kcMore = false;
        return render();
      }
    }
    loadFresh(); // nahoře zvlášť to nejnovější, co k náladě sedí
  }
  state.searched = true;
  if (!append) {
    state.page = 1; state.books = []; state.seen = new Map();
    state.olMore = state.gbMore = state.kcMore = true; state.olTotal = state.gbCount = state.kcTotal = 0;
  }
  showView("results");

  const p = new URLSearchParams({ limit: LIMIT, page: state.page, fields: FIELDS });
  const lang = $("lang").value;
  let q = "";
  if (state.mode === "author") {
    p.set("author_key", state.author.key);
    p.set("sort", "new");
  } else {
    const sort = random ? "random_" + Date.now() : $("sort").value;
    if (sort) p.set("sort", sort);
    const genreQ = state.mode === "genre" ? olGenreQuery(state.genres, state.genreMode) : "";
    if (genreQ === null) state.olMore = false; // vybrané žánry Open Library nezná
    q = [
      genreQ,
      state.mode === "mood" ? moodQuery(state.mood) : text,
      periodQuery($("period").value),
      // u žebříčku jen knihy s dostatkem hodnocení, ať nevyhraje kniha s jediným hlasem
      sort === "rating" ? `ratings_count:[${lang ? 8 : 40} TO *]` : "",
    ].filter(Boolean).join(" ");
  }
  if (fmt() === "ebook") q = [q, "ebook_access:[borrowable TO *]"].filter(Boolean).join(" ");
  if (state.mode !== "mood" && lengthRange()) q = [q, `number_of_pages_median:[${lengthRange()[0]} TO ${lengthRange()[1]}]`].filter(Boolean).join(" ");
  if (fmt() === "audio") state.olMore = false; // Open Library audioknihy nemá
  if (q) p.set("q", q);
  if (lang) p.set("language", lang);

  state.controller?.abort();
  state.controller = new AbortController();
  const signal = state.controller.signal;
  $("status").textContent = "Hledám knihy…";
  $("more").hidden = true;
  if (!append) $("grid").innerHTML = skeletons(state.mode === "author" ? 8 : 12);

  // všechny tři databáze najednou; když některá selže, ukážeme aspoň ostatní
  const olSkip = !state.olMore || (state.mode === "author" && !state.author.key) || (!q && !p.has("author_key"));
  const none = { books: [], more: false, total: 0 };
  const [ol, gb, kc] = await Promise.allSettled([
    olSkip ? Promise.resolve(null) : fetch(`${API}/search.json?${p}`, { signal }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }),
    state.gbMore ? fetchGB(state.page, signal) : Promise.resolve(none),
    state.kcMore ? fetchKC(state.page, signal) : Promise.resolve(none),
  ]);
  if (signal.aborted) return;
  if (ol.status === "rejected" && gb.status === "rejected" && kc.status === "rejected") {
    $("status").textContent = "";
    $("grid").innerHTML = `<div class="empty"><b>😕</b>Nepodařilo se načíst knihy. Zkontroluj připojení a zkus to znovu.</div>`;
    return;
  }
  let olBooks = [];
  if (ol.status === "fulfilled" && ol.value) {
    olBooks = ol.value.docs.map(toBook);
    state.olTotal = ol.value.numFound;
    state.olMore = state.page * LIMIT < ol.value.numFound;
  } else state.olMore = false;
  const gbBooks = gb.status === "fulfilled" ? gb.value.books : [];
  state.gbMore = gb.status === "fulfilled" && gb.value.more;

  const kcBooks = kc.status === "fulfilled" ? kc.value.books : [];
  state.kcMore = kc.status === "fulfilled" && kc.value.more;
  if (state.page === 1 && kc.status === "fulfilled") state.kcTotal = kc.value.total;

  const merged = mergeBooks(olBooks, gbBooks, kcBooks);
  state.gbCount += merged.gbAdded;
  state.total = state.olTotal + state.gbCount + state.kcTotal;
  state.books.push(...merged.books);
  render();
}

// ===================== Google Books =====================
// Google Books občas odpoví 503 / 429 (přetížení) – po krátké pauze to zkusíme ještě jednou
async function gbFetch(url, opts) {
  const r = await fetch(url, opts);
  if (r.status !== 503 && r.status !== 429) return r;
  await new Promise((done) => setTimeout(done, 700 + Math.random() * 600));
  return fetch(url, opts);
}
// vrací seznam dotazů – u „kterýkoli z žánrů“ jeden dotaz na každý žánr
function gbSpecs() {
  if (!GOOGLE_BOOKS_KEY || fmt() === "audio") return [];
  if (state.mode === "author") return state.author?.name ? [{ q: `inauthor:"${state.author.name}"`, cat: null }] : [];
  if ($("sort").value === "rating") return []; // žebříček jen z Open Library, Google Books má málo hodnocení
  const lang = $("lang").value;
  const czech = lang === "cze" || lang === "slo";
  const text = activeText();
  let { list, mode } = activeGenres();
  if (czech) list = list.filter((g) => GB_GENRES[g]);
  if (mode === "all" && list.length > 1) list = list.slice(0, 1); // Google Books neumí „všechny najednou“ – vezmeme první
  const specs = list.map((g) => czech
    ? { q: [text, GB_GENRES[g][0]].filter(Boolean).join(" "), cat: GB_GENRES[g][1] }
    : { q: [text, "subject:" + (olSubject(g) || g.replace(/_/g, " "))].filter(Boolean).join(" "), cat: null });
  if (!specs.length && text) specs.push({ q: text, cat: null });
  // motivy z režimu „podle nálady“ přidáme ke každému dotazu
  const topics = state.mode === "mood" ? (state.mood?.topics || []).map((x) => (czech ? x.kc : x.ol)) : [];
  if (topics.length) {
    if (!specs.length) specs.push({ q: "", cat: null });
    specs.forEach((x) => { x.q = [x.q, ...topics].filter(Boolean).join(" "); });
  }
  if (!specs.length && activeGenres().list.length === 0 && !text) return [];
  return specs.slice(0, 4);
}

async function fetchGB(page, signal) {
  const specs = gbSpecs();
  if (!specs.length) return { books: [], more: false };
  if (page === 1) state.gbStarts = specs.map(() => 0);
  const lang = GB_LANG[$("lang").value];
  const range = state.mode !== "author" ? PERIODS.find((x) => x[0] === $("period").value)?.[2] : null;
  const ebooks = fmt() === "ebook";
  const newest = state.mode === "author" || $("sort").value === "new" || $("period").value === "new";
  // u jednoho dotazu dotáhneme až 3 várky (po odfiltrování často zbude málo), u více dotazů po jedné
  const rounds = specs.length === 1 ? 3 : 1;
  let more = false;
  const results = await Promise.all(specs.map(async (spec, si) => {
    const p = new URLSearchParams({ q: spec.q, maxResults: GB_PAGE, printType: "books", key: GOOGLE_BOOKS_KEY });
    if (lang) p.set("langRestrict", lang);
    if (newest) p.set("orderBy", "newest");
    if (ebooks) p.set("filter", "ebooks");
    const out = [];
    let has = true;
    for (let i = 0; i < rounds && has && out.length < 12; i++) {
      p.set("startIndex", state.gbStarts[si]);
      const r = await gbFetch(`${GB_API}?${p}`, { signal });
      if (!r.ok) throw new Error(r.status);
      const items = (await r.json()).items || [];
      state.gbStarts[si] += GB_PAGE;
      has = items.length === GB_PAGE;
      out.push(...filterGB(items, spec, lang, range).filter((b) => !moodExcluded(b)));
    }
    if (has) more = true;
    return out;
  }));
  // střídáme výsledky jednotlivých žánrů
  const books = [];
  for (let i = 0; i < Math.max(0, ...results.map((r) => r.length)); i++) results.forEach((r) => r[i] && books.push(r[i]));
  return { books, more };
}

function filterGB(items, spec, lang, range) {
  return items.filter((it) => {
    const v = it.volumeInfo;
    if (!v.title || !v.authors) return false;
    if (lang && v.language !== lang) return false;               // langRestrict není stoprocentní
    if (spec.cat && !spec.cat.test((v.categories || []).join(" "))) return false;
    if (range) {
      const y = parseInt(v.publishedDate);
      if (!y || y < (range[0] === "*" ? -Infinity : range[0]) || y > range[1]) return false;
    }
    if (!fitsLength({ pages: v.pageCount }, lengthRange())) return false;
    return true;
  }).map(toGBook);
}

function toGBook(item) {
  const v = item.volumeInfo;
  const img = v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail;
  const book = {
    key: "gb:" + item.id, gbId: item.id,
    title: v.title,
    author: (v.authors || []).slice(0, 2).join(", "),
    authorKeys: [],
    year: parseInt(v.publishedDate) || null,
    published: v.publishedDate || null, // u Google Books často i s měsícem a dnem
    coverUrl: img ? img.replace(/^http:/, "https:").replace("&edge=curl", "") : null,
    rating: v.averageRating, ratings: v.ratingsCount, pages: v.pageCount,
    ebookAvail: !!(item.saleInfo?.isEbook || item.accessInfo?.epub?.isAvailable || item.accessInfo?.pdf?.isAvailable),
    tagsText: plain([v.title, (v.categories || []).join(" "), (v.description || "").slice(0, 400)].join(" ")),
  };
  cache.set(book.key, book);
  return book;
}

// ===================== Knihovny.cz =====================
function kcSpec(forLucky = false) {
  const lang = $("lang").value;
  if (lang && !KC_LANG[lang]) return null;
  if (state.mode === "author") return state.author?.name ? { lookfor: `"${state.author.name}"`, type: "Author", author: state.author.name } : null;
  if (!forLucky && $("sort").value === "rating") return null; // žebříček jen podle hodnocení z Open Library
  const { list, mode } = activeGenres();
  const text = activeText();
  const known = list.filter((g) => KC_GENRES[g]);
  if (mode === "all" && known.length < list.length) return null; // některý z žánrů katalog nezná
  const topics = state.mode === "mood" ? (state.mood?.topics || []).map((x) => x.kc) : [];
  if (topics.length && !text) {
    const parts = [...known.map((g) => `(${KC_GENRES[g]})`), ...topics.map((x) => `(${x})`)];
    return { lookfor: parts.join(" AND "), type: "Subject" };
  }
  const genreQ = known.length > 1
    ? known.map((g) => `(${KC_GENRES[g]})`).join(mode === "all" ? " AND " : " OR ")
    : known[0] ? KC_GENRES[known[0]] : "";
  if (text) return { lookfor: [text, genreQ && `(${genreQ})`].filter(Boolean).join(" "), type: "AllFields" };
  if (genreQ) return { lookfor: genreQ, type: "Subject" };
  if (state.mode === "mood" || list.length) return null;
  return { lookfor: "romány", type: "Subject" }; // úvodní stránka: nejnovější české romány
}

// knihy, e-knihy a audioknihy (ne hry, filmy, články…)
const KC_BOOKISH = ["0/BOOKS/", "0/EBOOK/", "0/AUDIO/", "0/EAUDIOBOOK/"];
function kcFormatFilter(p, f) {
  if (f === "ebook") p.append("filter[]", 'record_format_facet_mv:"0/EBOOK/"');
  else if (f === "audio") {
    p.append("filter[]", '~record_format_facet_mv:"0/AUDIO/"');
    p.append("filter[]", '~record_format_facet_mv:"0/EAUDIOBOOK/"');
  } else if (f === "print") p.append("filter[]", 'record_format_facet_mv:"0/BOOKS/"');
}

const kcParams = (params) => {
  const p = new URLSearchParams(params);
  KC_FIELDS.forEach((f) => p.append("field[]", f));
  return p;
};
const kcRecordUrl = (id) => `${KC_API}/record?${kcParams({ id })}`;

async function fetchKC(page, signal) {
  const spec = kcSpec();
  if (!spec) return { books: [], more: false, total: 0 };
  const p = kcParams({ lookfor: spec.lookfor, type: spec.type, limit: KC_PAGE, page });
  const lang = KC_LANG[$("lang").value];
  if (lang) p.append("filter[]", `language:"${lang}"`);
  const range = state.mode !== "author" ? PERIODS.find((x) => x[0] === $("period").value)?.[2] : null;
  if (range) p.append("filter[]", `publishDate:[${range[0]} TO ${range[1]}]`);
  kcFormatFilter(p, fmt()); // jen e-knihy / audioknihy už v katalogu
  if (state.mode === "author" || $("sort").value === "new" || $("period").value === "new") p.set("sort", "publishDateSort desc");
  const r = await fetch(`${KC_API}/search?${p}`, { signal });
  if (!r.ok) throw new Error(r.status);
  const data = await r.json();
  const recs = data.records || [];
  let books = recs.filter((x) => x.title && (x.formats || []).some((f) => KC_BOOKISH.includes(f)))
    .map(toKCBook).filter((b) => !moodExcluded(b) && (!spec.author || sameAuthor(b, spec.author)));
  books = books.filter((b) => fitsLength(b, lengthRange()));
  return { books, more: recs.length === KC_PAGE, total: data.resultCount || 0 };
}


function toKCBook(r) {
  const isbn = (Array.isArray(r.cleanIsbn) ? r.cleanIsbn[0] : r.cleanIsbn) || null;
  const book = {
    key: "kc:" + r.id, kcId: r.id,
    title: String(r.title).replace(/\s+:\s+/g, ": ").replace(/\s+\/\s+/g, " – ").replace(/\s*[\/;:.]\s*$/, "").trim(),
    author: kcAuthor(r),
    authorKeys: [],
    year: +(String(r.publicationDates?.[0] || "").match(/\d{4}/) || [])[0] || null,
    coverUrl: isbn ? `https://www.knihovny.cz/Cover/Show?isbn=${isbn}&size=medium` : null,
    pages: +(String(r.physicalDescriptions?.[0] || "").match(/(\d+)\s*stran/) || [])[1] || null,
    libs: (r.dedupIds || []).length || null, // kolik knihoven má tuhle knihu v katalogu
    ebookAvail: (r.formats || []).includes("0/EBOOK/"),
    audioAvail: (r.formats || []).some((f) => f === "0/AUDIO/" || f === "0/EAUDIOBOOK/"),
    tagsText: plain([r.title, kcSubjects(r).join(" "), (r.summary || []).join(" ").slice(0, 400)].join(" ")),
  };
  cache.set(book.key, book);
  return book;
}




function mergeBooks(olBooks, gbBooks, kcBooks = []) {
  const seen = state.seen;
  const add = (list, enrich) => {
    const out = [];
    for (const b of list) {
      const k = normKey(b.title, b.author);
      const twin = seen.get(k);
      if (twin) { enrich?.(twin, b); continue; }
      seen.set(k, b);
      if (b.original) seen.set(normKey(b.original, b.author), b);
      out.push(b);
    }
    return out;
  };
  // stejná kniha z víc zdrojů – doplníme, co jí chybí (český popis, obálku)
  const olNew = add(olBooks);
  const kcNew = add(kcBooks, (twin, b) => {
    if (b.ebookAvail) { twin.ebookAvail = true; twin.kcEbookId = b.kcId; }
    if (b.audioAvail) { twin.audioAvail = true; twin.kcAudioId = b.kcId; }
    if (b.libs && !twin.libs) twin.libs = b.libs;
    if (!twin.kcId && !twin.key.startsWith("kc:")) twin.kcId = b.kcId;
    if (!twin.cover && !twin.coverUrl) twin.coverUrl = b.coverUrl;
  });
  const gbNew = add(gbBooks, (twin, b) => {
    if (b.ebookAvail) twin.ebookAvail = true;
    if (!twin.gbId && !twin.key.startsWith("gb:")) twin.gbId = b.gbId;
    if (!twin.cover && !twin.coverUrl) twin.coverUrl = b.coverUrl;
  });
  let books;
  if (state.mode === "author" || $("sort").value === "new") {
    books = [...olNew, ...kcNew, ...gbNew].sort((a, b) => (b.year || 0) - (a.year || 0));
  } else {
    books = [];  // střídáme, ať jsou vidět knihy ze všech zdrojů
    for (let i = 0; i < Math.max(olNew.length, kcNew.length, gbNew.length); i++) {
      if (olNew[i]) books.push(olNew[i]);
      if (kcNew[i]) books.push(kcNew[i]);
      if (gbNew[i]) books.push(gbNew[i]);
    }
  }
  return { books, gbAdded: gbNew.length };
}

// ===================== Autor =====================
async function findAuthor(replace = false) {
  const name = $("q").value.trim();
  if (!name) {
    $("grid").innerHTML = `<div class="empty"><b>✍️</b>Napiš jméno autora a ukážeme ti všechny jeho knihy.</div>`;
    return;
  }
  $("status").textContent = "Hledám autora…";
  $("grid").innerHTML = skeletons(8);
  try {
    const data = await (await fetch(`${API}/search/authors.json?q=${encodeURIComponent(name)}&limit=8`)).json();
    // nejdřív autoři s nejvíce díly – většinou je to ten hledaný
    const found = data.docs.filter((a) => a.work_count > 0).sort((a, b) => b.work_count - a.work_count);
    if (!found.length) return showNameAuthor(name); // Open Library ho nezná – najdeme ho v Google Books a českých knihovnách
    if (!found.length) {
      $("status").textContent = "";
      $("authorBox").hidden = true;
      $("grid").innerHTML = `<div class="empty"><b>🤷</b>Autora „${esc(name)}“ jsme nenašli. Zkus jiný zápis jména.</div>`;
      return;
    }
    state.authorAlternatives = found.slice(1, 5);
    if (replace) location.replace("#autor/" + found[0].key); else location.hash = "autor/" + found[0].key;
  } catch {
    $("status").textContent = "";
    $("grid").innerHTML = `<div class="empty"><b>😕</b>Nepodařilo se vyhledat autora.</div>`;
  }
}

// autor, kterého Open Library nezná (typicky noví čeští autoři) – knihy z Google Books a českých knihoven
function showNameAuthor(name) {
  setMode("author");
  state.author = { key: null, name };
  $("authorBox").hidden = false;
  $("authorBox").innerHTML = `
    <div class="avatar">${esc(initials(name))}</div>
    <div><h2>${esc(name)}</h2><p class="sub"><span id="aCount">…</span></p><span id="aFollowSlot"></span><div id="aHint"></div></div>`;
  mountAuthorFollow();
  search();
}

async function loadAuthor(id) {
  setMode("author");
  if (state.author?.key === id) return; // už je načtený (návrat ze stránky knihy)
  state.author = { key: id };
  const box = $("authorBox");
  box.hidden = false;
  box.innerHTML = `<div class="avatar">✍️</div><div><h2>Načítám autora…</h2></div>`;

  let a = null;
  try { a = await (await fetch(`${API}/authors/${id}.json`)).json(); } catch {}
  if (state.author?.key !== id) return;
  state.author.name = a?.name || a?.personal_name || $("q").value.trim() || null;
  search(); // jméno je potřeba pro hledání v Google Books

  try {
    if (!a) {
      box.innerHTML = `<div class="avatar">${esc(initials(state.author.name))}</div><div><h2>${esc(state.author.name || "Autor")}</h2><p class="sub"><span id="aCount">…</span></p><span id="aFollowSlot"></span><div id="aHint"></div></div>`;
      mountAuthorFollow();
      return;
    }
    if (!$("q").value) $("q").value = state.author.name;
    const years = [a.birth_date, a.death_date].filter(Boolean).join(" – ");
    const alts = (state.authorAlternatives || []).filter((x) => x.key !== id);
    box.innerHTML = `
      <div class="avatar" data-i="${esc(initials(state.author.name))}">
        <img alt="" src="https://covers.openlibrary.org/a/olid/${id}-M.jpg?default=false" onerror="this.parentNode.textContent = this.parentNode.dataset.i">
      </div>
      <div>
        <h2>${esc(state.author.name)}</h2>
        <p class="sub">${years ? esc(years) + " · " : ""}<span id="aCount">…</span></p>
        <span id="aFollowSlot"></span>
        <p class="bio" id="aBio"></p>
        <button class="linkbtn" id="aBioMore" hidden>Zobrazit celý životopis</button>
        <div id="aHint"></div>
        ${alts.length ? `<div class="others">Hledal/a jsi jiného autora? ${alts.map((x) => `<a class="linkbtn" href="#autor/${x.key}">${esc(x.name)}</a>`).join(" · ")}</div>` : ""}
      </div>`;
    mountAuthorFollow();
    updateAuthorInfo();
    const bio = typeof a.bio === "string" ? a.bio : a.bio?.value;
    if (bio) {
      const clean = cleanDesc(bio);
      $("aBio").textContent = clean;
      const tr = await translate(clean);
      if (tr && $("aBio")) $("aBio").textContent = tr;
      if ($("aBio") && $("aBio").scrollHeight > $("aBio").clientHeight + 4) {
        $("aBioMore").hidden = false;
        $("aBioMore").onclick = () => { $("aBio").classList.add("open"); $("aBioMore").hidden = true; };
      }
    }
  } catch {}
}

function updateAuthorInfo() {
  if (state.mode !== "author" || !$("aCount")) return;
  const lang = $("lang").value;
  $("aCount").textContent = `${state.total} ${plural(state.total, "kniha", "knihy", "knih")}` + (lang ? " " + langIn(lang) : "");
  $("aHint").innerHTML = lang
    ? `<div class="hint">Zobrazují se jen knihy, které vyšly <b>${langIn(lang)}</b>. <button class="linkbtn" id="allLangs">Zobrazit všechny jeho knihy</button></div>`
    : "";
  $("allLangs")?.addEventListener("click", () => { $("lang").value = ""; search(); });
}

// ===================== Právě vyšlo (k náladě) =====================
// Knihy vydané letos a loni, které odpovídají náladě – z katalogu knihoven (řazeno od nejnovějších)
// a z Google Books (u nich známe i přesné datum vydání).
async function loadFresh() {
  const box = $("fresh");
  const token = (state.freshToken = (state.freshToken || 0) + 1);
  if (!state.mood?.include.length && !state.mood?.topics.length && !state.mood?.rest && state.mood?.like) { box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = `
    <div class="bday-head"><h2>🆕 Právě vyšlo</h2><span>nejnovější knihy k tvé náladě (${YEAR - 1}–${YEAR})</span></div>
    <div class="strip" id="freshStrip">${skeletons(6)}</div>`;
  const range = [YEAR - 1, YEAR + 1];
  const fresh = (b) => b.year >= range[0] && !moodExcluded(b) && fitsLength(b, lengthRange());

  const kcTask = (async () => {
    // jen zápor („ne horor“) bez žánru: vezmeme nejnovější romány a horory z nich vyřadíme;
    // žánr, který katalog nezná (pohodová detektivka), necháme na Google Books
    const spec = kcSpec(true) || (!activeGenres().list.length && !activeText() ? { lookfor: "romány", type: "Subject" } : null);
    if (!spec) return [];
    const p = kcParams({ lookfor: spec.lookfor, type: spec.type, limit: 60, sort: "publishDateSort desc" });
    const lang = KC_LANG[$("lang").value];
    if (lang) p.append("filter[]", `language:"${lang}"`);
    p.append("filter[]", `publishDate:[${range[0]} TO ${range[1]}]`);
    kcFormatFilter(p, fmt());
    const recs = (await (await fetch(`${KC_API}/search?${p}`)).json()).records || [];
    return recs.filter((x) => x.title && (x.formats || []).some((f) => KC_BOOKISH.includes(f))).map(toKCBook).filter(fresh);
  })();
  const gbTask = Promise.all(gbSpecs().map(async (spec) => {
    const p = new URLSearchParams({ q: spec.q, maxResults: 40, orderBy: "newest", printType: "books", key: GOOGLE_BOOKS_KEY });
    const gl = GB_LANG[$("lang").value];
    if (gl) p.set("langRestrict", gl);
    if (fmt() === "ebook") p.set("filter", "ebooks");
    const items = (await (await gbFetch(`${GB_API}?${p}`)).json()).items || [];
    return filterGB(items, spec, gl, range).filter(fresh);
  })).then((x) => x.flat());

  const [kc, gb] = await Promise.allSettled([kcTask, gbTask]);
  if (token !== state.freshToken || !$("freshStrip")) return; // mezitím přišlo jiné hledání
  const seen = new Set();
  const books = [...(gb.value || []), ...(kc.value || [])].filter((b) => {
    const k = normKey(b.title, b.author);
    return !seen.has(k) && seen.add(k);
  });
  // nejnovější napřed; přesné datum (Google Books) má u stejného roku přednost
  const when = (b) => (b.published && /^\d{4}-\d{2}/.test(b.published) ? b.published : `${b.year}-00`);
  books.sort((a, b) => when(b).localeCompare(when(a)));
  const strip = $("freshStrip");
  strip.innerHTML = "";
  if (!books.length) {
    strip.outerHTML = `<p class="status">K téhle náladě jsme z posledních měsíců nic nenašli – níž jsou starší knihy.</p>`;
    return;
  }
  books.slice(0, 16).forEach((b) => {
    const el = card(b);
    const d = b.published && /^\d{4}-\d{2}-\d{2}/.test(b.published) ? czDate(b.published) : b.year;
    el.insertAdjacentHTML("beforeend", `<div class="cap">vyšlo ${d}</div>`);
    strip.appendChild(el);
  });
}

// ===================== Podobné jako … (režim podle nálady) =====================
// najde zmíněnou knihu („něco jako Harry Potter“) a vrátí knihy jí podobné
async function findSeed(title) {
  const want = plain(title);
  const lang = $("lang").value;
  const ol = async (l) => {
    const p = new URLSearchParams({ q: title, limit: 8, sort: "readinglog", fields: FIELDS });
    if (l) p.set("language", l);
    return (await (await fetch(`${API}/search.json?${p}`)).json()).docs.map(toBook);
  };
  const gb = async () => {
    if (!GOOGLE_BOOKS_KEY) return [];
    const p = new URLSearchParams({ q: `intitle:${title}`, maxResults: 8, printType: "books", key: GOOGLE_BOOKS_KEY });
    if (GB_LANG[lang]) p.set("langRestrict", GB_LANG[lang]);
    return ((await (await gbFetch(`${GB_API}?${p}`)).json()).items || []).filter((it) => it.volumeInfo.title && it.volumeInfo.authors).map(toGBook);
  };
  // kandidáti ze všech zdrojů – vyhraje nejlepší shoda názvu, kniha s autorem a ta, kterou má hodně knihoven / čtenářů
  const ask = () => Promise.allSettled([lang ? ol(lang) : Promise.resolve([]), ol(""), kcSearch(title, "Title", 30, ""), gb()]);
  let all = (await ask()).flatMap((x) => x.value || []);
  if (!all.length) { await new Promise((r) => setTimeout(r, 800)); all = (await ask()).flatMap((x) => x.value || []); } // přechodný výpadek
  if (!all.length) return null;
  // autor, který se mezi kandidáty opakuje (víc vydání, víc dílů), je nejspíš ten hledaný
  const first = (b) => plain((b.author || "").split(", ")[0]).split(/\s+/).pop();
  const freq = {};
  all.forEach((b) => { const a = first(b); if (a) freq[a] = (freq[a] || 0) + 1; });
  const score = (b) => {
    const t = plain(b.title), o = plain(b.original || "");
    let s = 0;
    if (t === want || o === want) s += 4;
    else if (t.startsWith(want) || o.startsWith(want)) s += 3;
    else if (t.includes(want) || o.includes(want)) s += 1;
    if (b.author) s += 2;
    if (b.ratings) s += Math.min(3, Math.log10(b.ratings + 1) * 1.5);  // hodnocení v Open Library
    if (b.libs) s += Math.min(3, b.libs / 10);                         // počet knihoven v katalogu
    if (b.author) s += Math.min(4, (freq[first(b)] - 1) * 0.5);
    if (/průvodce|encyklopedie|omalovánk|kuchařka|neoficiální/i.test(b.title)) s -= 3;
    return s;
  };
  return all.map((b, i) => ({ b, i, s: score(b) })).sort((x, y) => y.s - x.s || x.i - y.i)[0].b;
}

// stejná kniha v Open Library (podle autora a názvu) – kvůli podrobnějším tématům
async function olTwinOf(book) {
  const surname = (book.author || "").split(", ")[0].trim().split(/\s+/).pop();
  if (!surname) return null;
  const short = String(book.title).split(/[.:(–]/)[0].trim();
  try {
    for (const q of [`title:(${book.title}) author:(${surname})`, `${short} author:(${surname})`, `author:(${surname})`]) {
      const p = new URLSearchParams({ q, limit: 1, sort: "readinglog", fields: FIELDS });
      const doc = (await (await fetch(`${API}/search.json?${p}`)).json()).docs?.[0];
      if (doc) return toBook(doc);
    }
  } catch {}
  return null;
}

async function loadLike(title, asStrip) {
  const box = $("likeBox");
  const token = (state.likeToken = (state.likeToken || 0) + 1);
  box.hidden = false;
  box.innerHTML = `<div class="bday-head"><h2>📚 Podobné jako „${esc(title)}“</h2><span>hledám knihu…</span></div>`;
  const seed = await findSeed(title);
  if (token !== state.likeToken) return [];
  if (!seed) {
    box.innerHTML = `<div class="bday-head"><h2>📚 Podobné jako „${esc(title)}“</h2></div><p class="status">Knihu „${esc(title)}“ jsme nenašli. Zkus napsat přesnější název.</p>`;
    return [];
  }
  cache.set(seed.key, seed);
  box.innerHTML = `
    <div class="bday-head"><h2>📚 Podobné jako <a href="#${bookHash(seed)}" class="linkbtn" style="font-size:inherit">${esc(seed.title)}</a></h2><span>${esc(seed.author || "")}</span></div>
    ${asStrip ? `<div class="strip" id="likeStrip">${skeletons(6)}</div>` : `<p class="status">Níž jsou knihy s podobnými tématy od jiných autorů.</p>`}`;
  box.querySelector("a").onclick = () => { state.fromApp = true; };
  const known = knownKeys();
  let books = [];
  const sims = async (b) => { try { return await similarFromInfo(b, await bookInfo(b)); } catch { return []; } };
  const olTwin = seed.key.startsWith("/works/") ? null : await olTwinOf(seed);
  const lists2 = await Promise.all([olTwin ? sims(olTwin) : [], sims(seed)]);
  const seenK = new Set([normKey(seed.title, seed.author)]);
  books = lists2.flat().filter((b) => {
    const k = normKey(b.title, b.author);
    if (seenK.has(k) || known.has(k) || moodExcluded(b)) return false;
    seenK.add(k);
    return true;
  });
  // nejvýš 2 knihy od jednoho autora
  const perAuthor = {};
  books = books.filter((b) => { const a = (b.author || "").split(", ")[0]; perAuthor[a] = (perAuthor[a] || 0) + 1; return perAuthor[a] <= 2; });
  if (token !== state.likeToken) return books;
  if (asStrip && $("likeStrip")) {
    $("likeStrip").innerHTML = "";
    if (!books.length) $("likeStrip").outerHTML = `<p class="status">Podobné knihy se nepodařilo najít.</p>`;
    books.slice(0, 14).forEach((b) => $("likeStrip").appendChild(card(b)));
  }
  return books;
}
