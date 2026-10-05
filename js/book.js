// ===================== Stránka knihy =====================
async function openBook(id, src = "ol") {
  const isGB = src === "gb", isKC = src === "kc";
  const key = isGB ? "gb:" + id : isKC ? "kc:" + id : "/works/" + id;
  const page = $("book");
  let book = cache.get(key) || Object.values(lists).flat().find((b) => b.key === key) || myRatings[key]?.book;
  let vol = null, rec = null; // podrobnosti z Google Books / z knihoven
  if (isGB) {
    try { vol = await (await gbFetch(`${GB_API}/${id}?key=${GOOGLE_BOOKS_KEY}`)).json(); if (!vol.volumeInfo) vol = null; } catch {}
    if (!book && vol) book = toGBook(vol);
  } else if (isKC) {
    try { rec = (await (await fetch(kcRecordUrl(id))).json()).records?.[0] || null; } catch {}
    if (!book && rec) book = toKCBook(rec);
  } else if (!book) {
    try {
      const data = await (await fetch(`${API}/search.json?q=key:${encodeURIComponent(key)}&fields=${FIELDS}`)).json();
      book = data.docs[0] && toBook(data.docs[0]);
    } catch {}
  }
  if (!book) { location.hash = ""; return; }

  const q = encodeURIComponent(book.title);
  const names = (book.author || "").split(", ").filter(Boolean);
  const authorsHtml = names.length
    ? names.map((n, i) => `<a href="${authorHref(book, i)}" title="Všechny knihy autora">${esc(n)}</a>`).join(", ")
    : "Neznámý autor";
  const readBtn = book.ebook === "public" && book.ia
    ? `<a class="btn" href="https://archive.org/details/${book.ia}" target="_blank" rel="noopener">📖 Číst zdarma</a>`
    : book.ebook === "borrowable"
      ? `<a class="btn" href="${API}${book.key}" target="_blank" rel="noopener">📖 Půjčit e-knihu</a>`
      : "";
  const view = vol?.accessInfo?.viewability;
  const gbRead = (view === "PARTIAL" || view === "ALL_PAGES") && vol.volumeInfo.previewLink
    ? `<a class="btn" href="${esc(vol.volumeInfo.previewLink)}" target="_blank" rel="noopener">📖 ${view === "ALL_PAGES" ? "Číst" : "Ukázka z knihy"}</a>`
    : "";
  const publisher = vol?.volumeInfo?.publisher || rec?.publishers?.[0]?.replace(/[\s,:;]+$/, "");
  const kcId = isKC ? id : book.kcId;
  const libs = rec?.dedupIds?.length || book.libs || 0;
  rememberBook(book);

  page.style.setProperty("--bgimg", book.cover ? `url(https://covers.openlibrary.org/b/id/${book.cover}-M.jpg)` : book.coverUrl ? `url("${book.coverUrl}")` : "var(--grad)");
  page.innerHTML = `
    <div class="book-hero">
      <div class="wrap">
        <div class="top"><button class="back" id="back">← Zpět</button></div>
        <div class="book-main">
          <div class="cover">${coverHtml(book, "L")}</div>
          <div>
            <h1>${esc(book.title)}</h1>
            ${book.original ? `<p class="orig">${esc(book.original)}</p>` : ""}
            <p class="by">${authorsHtml}</p>
            <div class="facts">
              ${book.rating ? `<div class="fact"><b><span class="star">★</span> ${book.rating.toFixed(1)}</b>${book.ratings} hodnocení</div>` : ""}
              ${book.year ? `<div class="fact"><b>${book.year}</b>${isGB || isKC ? "rok vydání" : "první vydání"}</div>` : ""}
              ${book.pages ? `<div class="fact"><b>${book.pages}</b>stran</div>` : ""}
              ${publisher ? `<div class="fact"><b>${esc(publisher)}</b>nakladatel</div>` : ""}
              ${book.editions ? `<div class="fact"><b>${book.editions}</b>vydání</div>` : ""}
              ${book.ebookAvail ? `<div class="fact"><b>📱 ano</b>e-kniha</div>` : ""}
              ${book.audioAvail ? `<div class="fact"><b>🎧 ano</b>audiokniha</div>` : ""}
              <div class="fact" id="bSeriesFact" hidden></div>
            </div>
            <div class="actions" style="margin-top:0">
              ${readBtn || gbRead}
              ${Object.entries(LISTS).map(([lid, l]) => `<button class="btn ghost" data-list="${lid}">${l.icon} ${l.label}</button>`).join("")}
              <button class="btn ghost" id="bGoReviews">⭐ Recenze</button>
              <button class="btn ghost" id="bShare">📤 Sdílet</button>
            </div>
            <p class="date-row" id="bReadRow" hidden>✅ Dočteno <input type="date" id="bReadDate" aria-label="Datum dočtení"></p>
            <div class="tags" id="bTags"></div>
          </div>
        </div>
      </div>
    </div>
    <div class="wrap" style="padding-bottom:calc(70px + env(safe-area-inset-bottom))">
      <div class="section" id="bSeries" hidden></div>

      <div class="section">
        <h2>O knize <button class="linkbtn" id="bToggle" hidden>Zobrazit originál</button></h2>
        <p class="desc" id="bDesc" style="color:var(--muted)">Načítám popis…</p>
        <p class="note" id="bNote" hidden>🌐 Popis byl automaticky přeložen do češtiny.</p>
      </div>

      <div class="section" id="bReviews">
        <h2>⭐ Hodnocení a recenze</h2>
        <div class="reviews">
          <div>
            <span class="label">Hodnocení čtenářů z celého světa</span>
            <div id="bWorld" style="color:var(--muted)">Načítám…</div>
            <div class="links" style="margin-top:16px">
              <a href="https://www.databazeknih.cz/search?q=${q}" target="_blank" rel="noopener">🇨🇿 Recenze na Databázi knih</a>
              <a href="https://www.goodreads.com/search?q=${q}" target="_blank" rel="noopener">🌍 Recenze na Goodreads</a>
            </div>
          </div>
          <div>
            <span class="label">Tvoje hodnocení</span>
            <div class="stars-input" id="bStars" role="radiogroup" aria-label="Počet hvězdiček">
              ${[1, 2, 3, 4, 5].map((n) => `<button data-n="${n}" aria-label="${n} ${plural(n, "hvězdička", "hvězdičky", "hvězdiček")}">★</button>`).join("")}
            </div>
            <textarea id="bText" placeholder="Jak se ti kniha líbila? (nepovinné)"></textarea>
            <div class="actions" style="margin-top:12px; align-items:center">
              <button class="btn" id="bSave">Uložit hodnocení</button>
              <button class="btn ghost" id="bDel" hidden>Smazat</button>
              <span class="saved" id="bSaved"></span>
            </div>
            <p class="note">Tvoje hodnocení se ukládá v tomto prohlížeči.</p>
          </div>
        </div>
      </div>

      <div class="section">
        <h2>Kde ji sehnat</h2>
        <div class="links">
          ${kcId
            ? `<a href="https://www.knihovny.cz/Record/${encodeURIComponent(kcId)}" target="_blank" rel="noopener">🏛️ Půjčit v knihovně${libs > 1 ? ` (${plural(libs, "má", "mají", "má")} ji ${libs} ${plural(libs, "knihovna", "knihovny", "knihoven")})` : ""}</a>`
            : `<a href="https://www.knihovny.cz/Search/Results?lookfor=${q}" target="_blank" rel="noopener">🏛️ V knihovně</a>`}
          <a href="https://www.google.com/search?tbm=shop&q=${q}+kniha" target="_blank" rel="noopener">🛒 Koupit</a>
          ${vol?.saleInfo?.isEbook && vol.saleInfo.buyLink ? `<a href="${esc(vol.saleInfo.buyLink)}" target="_blank" rel="noopener">📱 E-kniha na Google Play</a>` : ""}
          ${(isKC && book.ebookAvail) || book.kcEbookId ? `<a href="https://www.knihovny.cz/Record/${encodeURIComponent(book.kcEbookId || id)}" target="_blank" rel="noopener">📱 E-výpůjčka v knihovně</a>` : ""}
          <a href="https://www.palmknihy.cz/vyhledavani?query=${q}" target="_blank" rel="noopener">📱 Hledat e-knihu (Palmknihy)</a>
          ${(isKC && book.audioAvail) || book.kcAudioId ? `<a href="https://www.knihovny.cz/Record/${encodeURIComponent(book.kcAudioId || id)}" target="_blank" rel="noopener">🎧 Audiokniha v knihovně</a>` : ""}
          <a href="https://www.audiolibrix.com/cs/Search/Results?query=${q}" target="_blank" rel="noopener">🎧 Hledat audioknihu (Audiolibrix)</a>
          <a href="https://www.databazeknih.cz/search?q=${q}" target="_blank" rel="noopener">📘 Databáze knih</a>
          ${isGB
            ? `<a href="${esc(vol?.volumeInfo?.infoLink || "https://books.google.com/books?id=" + id)}" target="_blank" rel="noopener">📗 Google Books</a>`
            : isKC ? "" : `<a href="${API}${book.key}" target="_blank" rel="noopener">🌍 Open Library</a>`}
        </div>
      </div>

      <div class="section" id="bMoreSec" hidden>
        <h2>Další knihy od autora
          ${book.author ? `<a class="linkbtn" href="${authorHref(book, 0)}">Zobrazit všechny →</a>` : ""}</h2>
        <div class="strip" id="bMore"></div>
      </div>

      <div class="section" id="bSimSec" hidden>
        <h2>🎯 Podobné knihy</h2>
        <div class="strip" id="bSim"></div>
      </div>
    </div>`;

  page.hidden = false;
  page.scrollTop = 0;
  document.body.style.overflow = "hidden";

  $("back").onclick = () => { if (state.fromApp) history.back(); else location.hash = state.author ? "autor/" + state.author.key : ""; };
  const listBtns = [...page.querySelectorAll(".book-main [data-list]")];
  const syncLists = () => {
    listBtns.forEach((b) => b.classList.toggle("on", inList(b.dataset.list, book.key)));
    const entry = lists.read.find((b) => b.key === book.key);
    $("bReadRow").hidden = !entry;
    if (entry) $("bReadDate").value = isoDate(entry.at);
  };
  syncLists();
  listBtns.forEach((b) => (b.onclick = () => { toggleList(b.dataset.list, book); syncLists(); }));
  $("bReadDate").max = isoDate(Date.now());
  $("bReadDate").onchange = (e) => {
    const entry = lists.read.find((b) => b.key === book.key);
    if (!entry || !e.target.value) return;
    entry.at = new Date(e.target.value + "T12:00").getTime();
    store.set(LISTS.read.store, lists.read);
  };
  $("bShare").onclick = () => shareBook(book);
  $("bGoReviews").onclick = () => $("bReviews").scrollIntoView({ behavior: "smooth" });
  setupMyRating(book);

  loadDescription(book, vol, rec).then((info) => loadSimilar(book, info));
  loadSeries(book);
  loadWorldRatings(book, vol);
  loadMoreByAuthor(book);
}

// odkaz na autora: podle klíče z Open Library, jinak podle jména
function authorHref(book, i) {
  const key = book.authorKeys?.[i];
  if (key) return "#autor/" + key;
  const name = (book.author || "").split(", ")[i];
  return "#autor-jmeno/" + encodeURIComponent(name || "");
}

function closeBook() {
  if ($("book").hidden) return;
  $("book").hidden = true;
  $("book").innerHTML = "";
  document.body.style.overflow = "";
  render(); // obnoví srdíčka, záložky a vlastní hodnocení na kartičkách
  renderRecent();
}

// ===================== Historie =====================
let historyData = store.get("historie", { books: [], queries: [] });
function rememberBook(book) {
  historyData.books = [slim(book), ...historyData.books.filter((b) => b.key !== book.key)].slice(0, 20);
  store.set("historie", historyData);
}
function rememberQuery(text) {
  if (!text) return;
  historyData.queries = [text, ...historyData.queries.filter((x) => plain(x) !== plain(text))].slice(0, 8);
  store.set("historie", historyData);
}
function renderRecent() {
  const box = $("recent");
  box.hidden = !historyData.books.length;
  if (box.hidden) return;
  box.innerHTML = `
    <div class="bday-head"><h2>🕘 Naposledy prohlížené</h2><span><button class="linkbtn" id="recentClear">smazat historii</button></span></div>
    <div class="strip" id="recentStrip"></div>`;
  historyData.books.forEach((b) => $("recentStrip").appendChild(card(b)));
  $("recentClear").onclick = () => { historyData = { books: [], queries: [] }; store.set("historie", historyData); renderRecent(); toast("Historie smazána"); };
}

function setupMyRating(book) {
  let stars = myRatings[book.key]?.stars || 0;
  $("bText").value = myRatings[book.key]?.text || "";
  const paint = (n) => $("bStars").querySelectorAll("button").forEach((b) => b.classList.toggle("on", +b.dataset.n <= n));
  paint(stars);
  $("bDel").hidden = !myRatings[book.key];
  $("bStars").querySelectorAll("button").forEach((b) => {
    b.onclick = () => { stars = +b.dataset.n; paint(stars); $("bSaved").textContent = ""; };
    b.onmouseenter = () => paint(+b.dataset.n);
    b.onmouseleave = () => paint(stars);
  });
  $("bSave").onclick = () => {
    if (!stars) { $("bSaved").textContent = "Vyber počet hvězdiček."; return; }
    myRatings[book.key] = { stars, text: $("bText").value.trim(), date: Date.now(), book: slim(book) };
    store.set("moje-hodnoceni", myRatings);
    checkBadges();
    $("bSaved").textContent = "✓ Uloženo";
    $("bDel").hidden = false;
    renderTabs();
  };
  $("bDel").onclick = () => {
    delete myRatings[book.key];
    store.set("moje-hodnoceni", myRatings);
    stars = 0; paint(0); $("bText").value = "";
    $("bSaved").textContent = "Smazáno";
    $("bDel").hidden = true;
    renderTabs();
  };
}

async function loadWorldRatings(book, vol) {
  if (book.key.startsWith("kc:")) {
    if ($("bWorld")) $("bWorld").textContent = "Pro tuto knihu zatím nemáme hodnocení ze světa. Mrkni na recenze českých čtenářů na Databázi knih.";
    return;
  }
  if (book.key.startsWith("gb:")) {
    const el = $("bWorld");
    const v = vol?.volumeInfo;
    if (!el) return;
    if (!v?.averageRating) { el.textContent = "Tuto knihu zatím nikdo neohodnotil."; return; }
    el.style.color = "";
    el.innerHTML = `
      <div style="display:flex;align-items:baseline;gap:10px">
        <span class="big">${v.averageRating.toFixed(1)}</span>
        <span><span class="star">${"★".repeat(Math.round(v.averageRating))}</span><br><small style="color:var(--muted)">${v.ratingsCount || 0} hodnocení</small></span>
      </div>
      <p class="note">Zdroj: Google Books</p>`;
    return;
  }
  try {
    const r = await (await fetch(`${API}${book.key}/ratings.json`)).json();
    const el = $("bWorld");
    if (!el) return;
    const count = r.summary?.count || 0;
    if (!count) { el.textContent = "Tuto knihu zatím nikdo neohodnotil."; return; }
    const max = Math.max(...Object.values(r.counts));
    el.style.color = "";
    el.innerHTML = `
      <div style="display:flex;align-items:baseline;gap:10px">
        <span class="big">${r.summary.average.toFixed(1)}</span>
        <span><span class="star">${"★".repeat(Math.round(r.summary.average))}</span><br><small style="color:var(--muted)">${count.toLocaleString("cs-CZ")} ${plural(count, "hodnocení", "hodnocení", "hodnocení")}</small></span>
      </div>
      <div class="dist">${[5, 4, 3, 2, 1].map((n) => `
        <div><span>${n} ★</span><i><b style="width:${(r.counts[n] || 0) / max * 100}%"></b></i><span>${r.counts[n] || 0}</span></div>`).join("")}
      </div>
      <p class="note">Zdroj: Open Library</p>`;
  } catch {
    if ($("bWorld")) $("bWorld").textContent = "Hodnocení se nepodařilo načíst.";
  }
}

async function loadDescription(book, vol, rec) {
  const info = {}; // podklady pro „Podobné knihy“
  try {
    let raw = null, tags = [];
    if (book.key.startsWith("gb:")) {
      raw = gbDesc(vol);
      tags = [...new Set((vol?.volumeInfo?.categories || []).map((c) => c.split(" / ").pop()))]; // „Fiction / Mystery / Cozy“ → „Cozy“
      info.cats = tags;
    } else if (book.key.startsWith("kc:")) {
      raw = kcDesc(rec);
      tags = info.kcSubjects = kcSubjects(rec);
    } else {
      const work = await cachedJson(`${API}${book.key}.json`, 24);
      raw = realDesc(work);
      tags = info.subjects = work.subjects || [];
      // český popis (z českých knihoven nebo z Google Books) má přednost před anglickým z Open Library
      let czech = false;
      if (book.kcId) {
        try {
          const k = kcDesc((await (await fetch(kcRecordUrl(book.kcId))).json()).records?.[0]);
          if (k) { raw = k; czech = true; }
        } catch {}
      }
      if (!czech && book.gbId && GOOGLE_BOOKS_KEY) {
        try {
          const v = await (await gbFetch(`${GB_API}/${book.gbId}?key=${GOOGLE_BOOKS_KEY}`)).json();
          const g = gbDesc(v);
          if (g && (v.volumeInfo.language === "cs" || !raw)) raw = g;
        } catch {}
      }
    }
    if (!$("bDesc")) return info;
    $("bTags").innerHTML = tags.slice(0, 8).map((s) => `<span class="tag">${esc(s)}</span>`).join("");
    const d = $("bDesc");
    if (!raw) { d.textContent = "K této knize zatím není popis."; return info; }
    const original = raw;
    d.textContent = "Překládám popis do češtiny…";
    const translated = await translate(original);
    if (!$("bDesc")) return info;
    d.style.color = "";
    if (!translated) { d.textContent = original; return info; }
    d.textContent = translated;
    if (translated !== original) {
      $("bNote").hidden = false;
      const t = $("bToggle");
      t.hidden = false;
      let showOrig = false;
      t.onclick = () => {
        showOrig = !showOrig;
        d.textContent = showOrig ? original : translated;
        t.textContent = showOrig ? "Zobrazit překlad" : "Zobrazit originál";
      };
    }
    return info;
  } catch {
    if ($("bDesc")) $("bDesc").textContent = "Popis se nepodařilo načíst.";
    return info;
  }
}

async function loadMoreByAuthor(book) {
  const akey = book.authorKeys?.[0];
  if (!akey) return book.key.startsWith("kc:") ? loadMoreByAuthorKC(book) : loadMoreByAuthorGB(book);
  const p = new URLSearchParams({ author_key: akey, limit: 12, sort: "readinglog", fields: FIELDS });
  if ($("lang").value) p.set("language", $("lang").value);
  try {
    const data = await (await fetch(`${API}/search.json?${p}`)).json();
    const books = data.docs.map(toBook).filter((b) => b.key !== book.key);
    if (!books.length || !$("bMore")) return;
    $("bMoreSec").hidden = false;
    books.forEach((b) => $("bMore").appendChild(card(b)));
  } catch {}
}

async function loadMoreByAuthorGB(book) {
  const name = (book.author || "").split(", ")[0];
  if (!name || !GOOGLE_BOOKS_KEY) return;
  const p = new URLSearchParams({ q: `inauthor:"${name}"`, maxResults: 20, printType: "books", key: GOOGLE_BOOKS_KEY });
  const lang = GB_LANG[$("lang").value];
  if (lang) p.set("langRestrict", lang);
  try {
    const items = (await (await gbFetch(`${GB_API}?${p}`)).json()).items || [];
    const seen = new Set([normKey(book.title, book.author)]);
    const books = items.filter((it) => it.volumeInfo.title && it.volumeInfo.authors).map(toGBook).filter((b) => {
      const k = normKey(b.title, b.author);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).slice(0, 12);
    if (!books.length || !$("bMore")) return;
    $("bMoreSec").hidden = false;
    books.forEach((b) => $("bMore").appendChild(card(b)));
  } catch {}
}

function showStrip(secId, stripId, book, books) {
  const seen = new Set([normKey(book.title, book.author)]);
  const perAuthor = {};
  const varied = secId === "bSimSec"; // u podobných knih nejvýš 2 od jednoho autora, ať je výběr pestrý
  const unique = books.filter((b) => {
    const k = normKey(b.title, b.author);
    const a = (b.author || "").split(", ")[0];
    if (seen.has(k) || (varied && perAuthor[a] >= 2)) return false;
    seen.add(k);
    perAuthor[a] = (perAuthor[a] || 0) + 1;
    return true;
  }).slice(0, 12);
  if (!unique.length || !$(stripId)) return;
  $(secId).hidden = false;
  unique.forEach((b) => $(stripId).appendChild(card(b)));
}

async function kcSearch(lookfor, type, limit = 20, sort = "publishDateSort desc") {
  const p = kcParams({ lookfor, type, limit });
  if (sort) p.set("sort", sort);
  const lang = KC_LANG[$("lang").value];
  if (lang) p.append("filter[]", `language:"${lang}"`);
  const data = await (await fetch(`${KC_API}/search?${p}`)).json();
  return (data.records || []).filter((x) => x.title && (x.formats || []).includes("0/BOOKS/")).map(toKCBook);
}

async function loadMoreByAuthorKC(book) {
  const name = (book.author || "").split(", ")[0];
  if (!name) return;
  try { showStrip("bMoreSec", "bMore", book, (await kcSearch(`"${name}"`, "Author")).filter((b) => sameAuthor(b, name))); } catch {}
}

// Podobné knihy: podle témat knihy, ale od jiných autorů
const GENERIC_SUBJECT = /^(fiction|fiction, general|general|english literature|american literature|accessible book|protected daisy|in library|large type books|lending library|open library staff picks|nyt:|reading level|literature|juvenile literature|romance fiction)/i;
// příliš obecná témata a formáty („E-knihy“) – podle nich podobné knihy nehledáme
const GENERIC_KC = /^(české romány|romány|české prózy|prózy|beletrie|ženy|muži|česká literatura|e-knihy|elektronické knihy|audioknihy|zvukové knihy|mluvené slovo|publikace pro děti|knihy)$/i;

async function loadSimilar(book, info = {}) {
  showStrip("bSimSec", "bSim", book, await similarFromInfo(book, info));
}

// témata knihy (pro doporučení), když zrovna není otevřená její stránka
async function bookInfo(book) {
  try {
    if (book.key.startsWith("gb:")) {
      const v = await (await gbFetch(`${GB_API}/${book.gbId}?key=${GOOGLE_BOOKS_KEY}`)).json();
      return { cats: [...new Set((v.volumeInfo?.categories || []).map((c) => c.split(" / ").pop()))] };
    }
    if (book.key.startsWith("kc:")) return { kcSubjects: kcSubjects((await (await fetch(kcRecordUrl(book.kcId))).json()).records?.[0]) };
    return { subjects: (await cachedJson(`${API}${book.key}.json`, 24)).subjects || [] };
  } catch { return {}; }
}

// jak moc téma vypovídá o druhu knihy: žánry a typické motivy nahoru, obecná a cizojazyčná slova dolů
const GENRE_WORDS = /fantasy|science fiction|mystery|detective|thriller|suspense|romance|love stories|horror|historical|adventure|humor|humorous|dystopi|magic|wizard|witch|dragon|vampire|school|friendship|spies|crime|war stories|fairy tales|space|time travel/i;
function subjectScore(x) {
  let s = 0;
  if (GENRE_WORDS.test(x)) s += 3;
  if (/ in fiction$|fiction$/i.test(x)) s += 1;
  if (/^[A-ZÁ-Ž\s]+$/.test(x)) s -= 2;          // „MAGIA“, „NOVELAS INGLESAS“ – cizojazyčné katalogové štítky
  if (/juvenile|children|bestseller|award|staff picks|accessible/i.test(x)) s -= 3;
  return s;
}

async function similarFromInfo(book, info = {}) {
  const lang = $("lang").value;
  const firstAuthor = (book.author || "").split(", ")[0];
  const other = (b) => b.key !== book.key && (b.author || "").split(", ")[0] !== firstAuthor;
  let books = [];
  try {
    if (info.subjects?.length) {
      // žánrová témata (fantasy, kouzla, škola…) mají přednost před nahodilými („Duchové“, „Bystrost“)
      const subs = info.subjects.filter((x) => !GENERIC_SUBJECT.test(x) && !/[:(]/.test(x) && x.length < 40)
        .map((x, i) => ({ x, i, score: subjectScore(x) })).sort((a, b) => b.score - a.score || a.i - b.i).map((o) => o.x).slice(0, 3);
      for (let n = subs.length; n >= 1 && books.length < 4; n--) {  // čím víc společných témat, tím podobnější
        const p = new URLSearchParams({ q: subs.slice(0, n).map((x) => `subject:"${x}"`).join(" "), limit: 20, sort: "readinglog", fields: FIELDS });
        if (lang) p.set("language", lang);
        books = (await (await fetch(`${API}/search.json?${p}`)).json()).docs.map(toBook).filter(other);
      }
    } else if (info.kcSubjects?.length) {
      // žánrová témata („vědecko-fantastické romány“) mají přednost před národnostními („kanadské romány“)
      const national = /^\S+(ské|cké)\s+(romány|prózy|povídky|poezie)$/i;
      const subjects = info.kcSubjects.filter((x) => !GENERIC_KC.test(x) && !x.includes("("))
        .sort((a, b) => national.test(a) - national.test(b));
      const seedKind = plain(info.kcSubjects.join(" "));
      const offKind = (b) => /komiks|manga|pro deti|detsk|pro mladez|leporel|omalovan/.test(b.tagsText || "") && !/komiks|manga|pro deti|detsk|pro mladez/.test(seedKind);
      for (const subject of subjects.slice(0, 3)) {
        // řazení podle toho, v kolika knihovnách kniha je = známější knihy napřed
        books = (await kcSearch(subject, "Subject", 50, "")).filter((b) => other(b) && !offKind(b)).sort((a, b) => (b.libs || 0) - (a.libs || 0));
        if (books.length >= 4) break;
      }
    } else if (info.cats?.length && GOOGLE_BOOKS_KEY) {
      const p = new URLSearchParams({ q: `subject:"${info.cats[0]}"`, maxResults: 20, printType: "books", key: GOOGLE_BOOKS_KEY });
      const gl = GB_LANG[lang];
      if (gl) p.set("langRestrict", gl);
      const items = (await (await gbFetch(`${GB_API}?${p}`)).json()).items || [];
      books = items.filter((it) => it.volumeInfo.title && it.volumeInfo.authors && (!gl || it.volumeInfo.language === gl)).map(toGBook).filter(other);
    }
  } catch {}
  return books;
}
