// ===================== Překvap mě – jedna náhodná kniha =====================
// Losuje z Open Library (náhodné řazení) i z katalogu českých knihoven (náhodná stránka výsledků).
const lucky = { queue: [], seen: new Set(), filters: "", summaries: {} };

function luckyParams(level, genreQ) {
  // level 0 = všechny filtry, 1 = bez období, 2 = bez období i bez požadavku na oblíbenost
  const lang = $("lang").value;
  const p = new URLSearchParams({ limit: 20, sort: "random_" + Math.floor(Math.random() * 1e9), fields: FIELDS });
  if (lang) p.set("language", lang);
  p.set("q", [
    genreQ,
    $("q").value.trim(),
    "cover_i:[* TO *]",                                          // jen knihy s obálkou
    level < 2 ? `readinglog_count:[${lang ? 1 : 15} TO *]` : "",  // aspoň trochu známé knihy
    level < 1 ? periodQuery($("period").value) : "",
    fmt() === "ebook" ? "ebook_access:[borrowable TO *]" : "",
    lengthRange() ? `number_of_pages_median:[${lengthRange()[0]} TO ${lengthRange()[1]}]` : "",
  ].filter(Boolean).join(" "));
  return p;
}

async function luckyOL() {
  if (fmt() === "audio") return [];
  const genreQ = olGenreQuery(state.genres, state.genreMode);
  if (genreQ === null) return []; // vybraný žánr Open Library nezná – nelosujeme odjinud
  for (let level = 0; level < 3; level++) {
    const data = await (await fetch(`${API}/search.json?${luckyParams(level, genreQ)}`)).json();
    if (data.docs.length) return data.docs.map(toBook);
  }
  return [];
}

async function luckyKC() {
  const spec = kcSpec(true);
  if (!spec) return [];
  const range = PERIODS.find((x) => x[0] === $("period").value)?.[2];
  for (const withPeriod of range ? [true, false] : [false]) {
    const p = kcParams({ lookfor: spec.lookfor, type: spec.type, limit: 0 });
    const lang = KC_LANG[$("lang").value];
    if (lang) p.append("filter[]", `language:"${lang}"`);
    if (withPeriod) p.append("filter[]", `publishDate:[${range[0]} TO ${range[1]}]`);
    kcFormatFilter(p, fmt() || "print");
    const count = (await (await fetch(`${KC_API}/search?${p}`)).json()).resultCount || 0;
    if (!count) continue;
    p.set("limit", 20);
    p.set("page", 1 + Math.floor(Math.random() * Math.min(Math.ceil(count / 20), 50)));
    const recs = (await (await fetch(`${KC_API}/search?${p}`)).json()).records || [];
    recs.forEach((r) => { const d = kcDesc(r); if (d) lucky.summaries[r.id] = d; });
    // přednost mají knihy s obálkou a popisem
    return recs.filter((r) => r.title).map(toKCBook).filter((b) => b.coverUrl && lucky.summaries[b.kcId] && fitsLength(b, lengthRange()));
  }
  return [];
}


async function nextLucky() {
  const filters = [state.genres.join(","), state.genreMode, $("lang").value, $("period").value, $("q").value, fmt(), $("length").value].join("|");
  if (filters !== lucky.filters) { lucky.filters = filters; lucky.queue = []; }
  for (let attempt = 0; !lucky.queue.length && attempt < 2; attempt++) {
    const [ol, kc] = await Promise.allSettled([luckyOL(), luckyKC()]);
    const all = [...(ol.value || []), ...(kc.value || [])];
    const keys = new Set();
    lucky.queue = shuffle(all.filter((b) => {
      const k = normKey(b.title, b.author);
      if (lucky.seen.has(k) || keys.has(k)) return false;
      keys.add(k);
      return true;
    }));
    if (!lucky.queue.length && all.length) lucky.seen.clear(); // všechno už viděl – začneme znovu
  }
  const book = lucky.queue.shift();
  if (book) lucky.seen.add(normKey(book.title, book.author));
  return book;
}

async function surprise() {
  const dlg = $("lucky");
  dlg.innerHTML = `<div class="lucky loading"><div><span class="spin">🎲</span><p>Losuji knihu…</p></div></div>`;
  if (!dlg.open) dlg.showModal();
  let book;
  try { book = await nextLucky(); } catch {}
  if (!book) {
    dlg.innerHTML = `<div class="lucky loading"><button class="x" aria-label="Zavřít">✕</button><div><b style="font-size:2.4rem">😕</b><p>Nepodařilo se vylosovat knihu. Zkus jiný žánr nebo jazyk.</p></div></div>`;
    dlg.querySelector(".x").onclick = () => dlg.close();
    return;
  }
  const genre = state.genres.length ? state.genres.map(genreLabel).join(", ") : "";
  dlg.innerHTML = `
    <div class="lucky">
      <button class="x" aria-label="Zavřít">✕</button>
      <div class="cover">${coverHtml(book, "L")}</div>
      <div>
        <span class="badge">🎲 Tip pro tebe${genre ? " · " + esc(genre) : ""}</span>
        <h2>${esc(book.title)}</h2>
        <p class="meta">${esc(book.author || "Neznámý autor")}${book.year ? " · " + book.year : ""}${book.rating ? ` · <span class="star">★</span> ${book.rating.toFixed(1)}` : ""}</p>
        <p class="ldesc" id="lDesc" style="color:var(--muted)">Načítám popis…</p>
        <div class="actions">
          <button class="btn" id="lYes">📖 Tohle si přečtu</button>
          <button class="btn ghost" id="lNext">🎲 Jinou knihu</button>
        </div>
        <p style="margin:12px 0 0"><button class="linkbtn" id="lMore">Víc o knize</button></p>
      </div>
    </div>`;
  const openPage = () => { dlg.close(); state.fromApp = true; cache.set(book.key, book); location.hash = bookHash(book); };
  dlg.querySelector(".x").onclick = () => dlg.close();
  $("lNext").onclick = surprise;
  $("lMore").onclick = openPage;
  $("lYes").onclick = () => { if (!inList("want", book.key)) toggleList("want", book); openPage(); };

  // krátký (případně přeložený) popis
  try {
    const raw = book.key.startsWith("kc:")
      ? lucky.summaries[book.kcId] || kcDesc((await (await fetch(kcRecordUrl(book.kcId))).json()).records?.[0])
      : realDesc(await (await fetch(`${API}${book.key}.json`)).json());
    const el = $("lDesc");
    if (!el || !dlg.open) return;
    if (!raw) { el.textContent = ""; return; }
    let text = raw;
    text = (await translate(text)) || text;
    if (text.length > 320) text = text.slice(0, 320).replace(/\s+\S*$/, "") + "…";
    if ($("lDesc")) { el.style.color = ""; el.textContent = text; }
  } catch { if ($("lDesc")) $("lDesc").textContent = ""; }
}
$("lucky").addEventListener("click", (e) => { if (e.target === $("lucky")) $("lucky").close(); }); // klik vedle okna zavře

// ===================== Dnes mají narozeniny (česká Wikipedie) =====================
const MONTHS = ["ledna", "února", "března", "dubna", "května", "června", "července", "srpna", "září", "října", "listopadu", "prosince"];
const WRITER = /spisovatel|básník|básnířk|prozai|dramatik|romanopis|povídkář|esejist/i;
const AUTHOR = /autor/i, NOT_WRITER = /zpěv|hudeb|skladatel|kytar|písní|písně|rapper|herec|hereč/i;
// „autor písní“ ani zpěvák, který píše i básně (hlavní popis „zpěvák“), není spisovatel
const isWriter = (t) => WRITER.test(t) || (AUTHOR.test(t) && !NOT_WRITER.test(t));

async function loadBirthdays() {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0"), dd = String(now.getDate()).padStart(2, "0");
  const storeKey = "narozeniny-" + mm + dd;
  let list = store.get(storeKey, null);
  if (!list) {
    try {
      const data = await (await fetch(`https://api.wikimedia.org/feed/v1/wikipedia/cs/onthisday/births/${mm}/${dd}`)).json();
      list = (data.births || []).filter((x) => x.year > 0 && isWriter(x.text) && !NOT_WRITER.test(x.pages?.[0]?.description || "")).map((x) => {
        const p = x.pages?.[0] || {};
        const [name, ...rest] = x.text.split(", ");
        const about = rest.join(", ").replace(/\s*\(†.*$/, "");
        return {
          name: name.trim(),
          year: x.year,
          dead: x.text.includes("†"),
          deathYear: +(x.text.match(/†[^)]*?(\d{3,4})\s*\)/) || [])[1] || null,
          desc: p.description || about,
          img: p.thumbnail?.source || null,
          czech: /^česk/i.test(p.description || about),
          qid: p.wikibase_item,
        };
      });
      // známost = v kolika jazycích o autorovi píše Wikipedie (Wikidata); čeští autoři mají bonus
      try {
        const ids = list.map((a) => a.qid).filter(Boolean).slice(0, 50);
        const wd = await (await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&props=sitelinks&format=json&origin=*&ids=${ids.join("|")}`)).json();
        list.forEach((a) => { a.fame = Object.keys(wd.entities?.[a.qid]?.sitelinks || {}).length; });
      } catch {}
      try { Object.keys(localStorage).filter((k) => k.startsWith("narozeniny-")).forEach((k) => localStorage.removeItem(k)); } catch {}
      store.set(storeKey, list);
    } catch { return; }
  }
  if (!list.length) return;

  // kulaté výročí: u žijících každých 10 let (kulaté narozeniny), u zemřelých každých 25 let
  const isRound = (a) => { const age = YEAR - a.year; return a.dead ? age % 25 === 0 : age % 10 === 0; };
  // pořadí: kulatá výročí napřed, pak podle známosti (čeští autoři a autoři s fotkou mají bonus)
  const score = (a) => (isRound(a) ? 1000 : 0) + (a.fame || 0) + (a.czech ? 25 : 0) + (a.img ? 5 : 0);
  list.sort((a, b) => score(b) - score(a));

  const box = $("bday");
  box.hidden = false;
  box.innerHTML = `
    <div class="bday-head">
      <h2>🎂 Dnes mají narozeniny</h2>
      <span>${now.getDate()}. ${MONTHS[now.getMonth()]} · zdroj: Wikipedie</span>
    </div>
    <div class="bday-strip">${list.map((a, i) => {
      const age = YEAR - a.year;
      const round = isRound(a);
      const label = a.dead ? `${age} let od narození` : `slaví ${age}. narozeniny`;
      return `
        <button class="bcard" data-i="${i}" title="Zobrazit knihy autora">
          <div class="bphoto">${a.img ? `<img loading="lazy" alt="" src="${esc(a.img)}">` : esc(initials(a.name))}</div>
          <b>${esc(a.name)}</b>
          <small>${esc(a.desc)}</small>
          <small>${a.year}${a.deathYear ? " – " + a.deathYear : ""}</small>
          <span class="bage ${round ? "round" : ""}">${round ? "🎉 " : ""}${label}</span>
        </button>`;
    }).join("")}</div>`;
  box.querySelectorAll(".bcard").forEach((b) => (b.onclick = () => {
    location.hash = "autor-jmeno/" + encodeURIComponent(list[b.dataset.i].name);
    setTimeout(() => $("authorBox").scrollIntoView({ behavior: "smooth", block: "start" }), 400);
  }));
}
