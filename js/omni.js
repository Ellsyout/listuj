// ===================== Hledání knihy podle názvu (našeptávač) =====================
// Při psaní nabízí konkrétní knihy a autory; klik otevře stránku knihy (s díly série a podobnými knihami).
const omni = { timer: null, ctrl: null, items: [], active: -1, text: "" };

async function omniSuggest(text) {
  omni.ctrl?.abort();
  omni.ctrl = new AbortController();
  const signal = omni.ctrl.signal;
  const lang = $("lang").value;
  const ol = async (withLang) => {
    const p = new URLSearchParams({ q: text, limit: 8, sort: "readinglog", fields: FIELDS });
    if (withLang && lang) p.set("language", lang);
    return (await (await fetch(`${API}/search.json?${p}`, { signal })).json()).docs.map(toBook);
  };
  const gbLang = GB_LANG[lang];
  const [olLang, olAll, kc, authors, gb] = await Promise.allSettled([
    lang ? ol(true) : Promise.resolve([]),
    ol(false),
    KC_LANG[lang] || !lang ? kcSearch(text, "Title", 10, "") : Promise.resolve([]), // podle shody s názvem, ne podle data
    fetch(`${API}/search/authors.json?q=${encodeURIComponent(text)}&limit=5`, { signal }).then((r) => r.json()),
    // Google Books zná dobře české názvy („Hra o trůny“), které Open Library nemá
    GOOGLE_BOOKS_KEY ? gbFetch(`${GB_API}?${new URLSearchParams({ q: `intitle:${text}`, maxResults: 10, printType: "books", key: GOOGLE_BOOKS_KEY, ...(gbLang ? { langRestrict: gbLang } : {}) })}`, { signal })
      .then((r) => r.json()).then((d) => (d.items || []).filter((it) => it.volumeInfo.title && it.volumeInfo.authors && (!gbLang || it.volumeInfo.language === gbLang)).map(toGBook))
      : Promise.resolve([]),
  ]);
  if (signal.aborted) return null;
  // české vydání napřed, pak zbytek světa, pak nové české knihy z knihoven
  const books = [], keys = new Set();
  const q0 = plain(text);
  const starts = (b) => plain(b.title).startsWith(q0) || plain(b.original || "").startsWith(q0);
  const pool = [...(olLang.value || []), ...(olAll.value || []), ...(gb.value || []), ...(kc.value || [])];
  // knihy, jejichž název začíná hledaným textem, napřed; průvodce a „kompletní“ příručky až nakonec
  const guide = (b) => /průvodce|neoficiální|encyklopedie|kuchařka|omalovánk/i.test(b.title);
  pool.sort((a, b) => (guide(a) - guide(b)) || (starts(b) - starts(a)));
  for (const b of pool) {
    const k = normKey(b.title, b.author);
    const k2 = b.original ? normKey(b.original, b.author) : null;
    if (keys.has(k) || (k2 && keys.has(k2))) continue;
    keys.add(k); if (k2) keys.add(k2);
    books.push(b);
    if (books.length >= 7) break;
  }
  // autory ukážeme, jen když jméno opravdu odpovídá hledanému textu
  const words = plain(text).split(/\s+/).filter((w) => w.length > 1);
  const people = (authors.value?.docs || [])
    .filter((a) => a.work_count > 0 && words.every((w) => plain(a.name).includes(w)))
    .sort((a, b) => b.work_count - a.work_count)
    // „Harry Potter“ je název knihy, ne autor – autory pak ukážeme, jen když napsali některou z nalezených knih
    .filter((a) => !books.some((b) => plain(b.title).includes(plain(text))) || books.some((b) => sameAuthor(b, a.name)))
    .slice(0, 2);
  return { books, people };
}

function omniRender(res) {
  const list = $("omniList");
  omni.items = [];
  omni.active = -1;
  if (!res) return;
  const rows = [];
  if (res.people.length) {
    rows.push(`<div class="head">Autoři</div>`);
    res.people.forEach((a) => {
      omni.items.push({ type: "author", a });
      rows.push(`<button class="orow" role="option" data-i="${omni.items.length - 1}">
        <span class="av"><img alt="" src="https://covers.openlibrary.org/a/olid/${a.key}-S.jpg?default=false" onerror="this.replaceWith(document.createTextNode('${esc(initials(a.name)).replace(/'/g, "")}'))"></span>
        <span><b>${esc(a.name)}</b><small>${a.work_count} ${plural(a.work_count, "kniha", "knihy", "knih")}${a.top_work ? " · např. " + esc(a.top_work) : ""}</small></span></button>`);
    });
  }
  if (res.books.length) {
    rows.push(`<div class="head">Knihy</div>`);
    res.books.forEach((b) => {
      omni.items.push({ type: "book", b });
      rows.push(`<button class="orow" role="option" data-i="${omni.items.length - 1}">
        <span class="mini">${coverHtml(b, "S")}</span>
        <span><b>${esc(b.title)}</b><small>${esc(b.author || "Neznámý autor")}${b.year ? " · " + b.year : ""}${b.original ? " · " + esc(b.original) : ""}</small></span></button>`);
    });
  }
  if (!rows.length) rows.push(`<div class="omni-note">Nic jsme nenašli. Zkus jiný zápis názvu nebo jména.</div>`);
  rows.push(`<button class="btn ghost omni-all" data-all="1">Zobrazit všechny výsledky pro „${esc(omni.text)}“</button>`);
  list.innerHTML = rows.join("");
  list.hidden = false;
  list.querySelectorAll("[data-i]").forEach((el) => (el.onclick = () => omniPick(+el.dataset.i)));
  list.querySelector("[data-all]").onclick = omniAll;
}

function omniPick(i) {
  const it = omni.items[i];
  if (!it) return omniAll();
  $("omniList").hidden = true;
  state.fromApp = true;
  rememberQuery(omni.text);
  if (it.type === "author") location.hash = "autor/" + it.a.key;
  else { cache.set(it.b.key, it.b); location.hash = bookHash(it.b); }
}

// Enter / „Zobrazit všechny výsledky“: klasické hledání podle textu bez omezení období a žánru
function omniAll() {
  const text = $("omni").value.trim();
  if (!text) return;
  $("omniList").hidden = true;
  rememberQuery(text);
  if (location.hash.startsWith("#autor")) location.hash = "";
  setMode("genre");
  state.genres = []; syncGenres();
  $("q").value = text;
  $("period").value = "";
  $("sort").value = "";
  search();
  $("tabs").scrollIntoView({ behavior: "smooth", block: "start" });
}

$("omni").addEventListener("input", () => {
  clearTimeout(omni.timer);
  const text = $("omni").value.trim();
  omni.text = text;
  if (text.length < 3) { omni.ctrl?.abort(); if (text) $("omniList").hidden = true; else omniRecent(); return; }
  $("omniList").hidden = false;
  $("omniList").innerHTML = `<div class="omni-note">Hledám „${esc(text)}“…</div>`;
  omni.timer = setTimeout(async () => {
    try { const res = await omniSuggest(text); if (res && text === omni.text) omniRender(res); }
    catch (e) { if (e.name !== "AbortError") $("omniList").innerHTML = `<div class="omni-note">Hledání se nepovedlo, zkus to znovu.</div>`; }
  }, 300);
});
$("omni").addEventListener("keydown", (e) => {
  const rows = [...$("omniList").querySelectorAll("[data-i]")];
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    if (!rows.length) return;
    e.preventDefault();
    omni.active = (omni.active + (e.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length;
    rows.forEach((r, i) => r.classList.toggle("active", i === omni.active));
    rows[omni.active].scrollIntoView({ block: "nearest" });
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (omni.active >= 0 && !$("omniList").hidden) omniPick(+rows[omni.active].dataset.i); else omniAll();
    $("omni").blur();
  } else if (e.key === "Escape") {
    $("omniList").hidden = true;
  }
});
$("omni").addEventListener("focus", () => {
  if (!$("omni").value.trim()) omniRecent();
  else if (omni.items.length && $("omni").value.trim().length >= 3) $("omniList").hidden = false;
});
// prázdné pole: nabídneme poslední hledání
function omniRecent() {
  const list = $("omniList");
  if (!historyData.queries.length) { list.hidden = true; return; }
  omni.items = [];
  list.innerHTML = `<div class="head">Naposledy hledané</div>` + historyData.queries.map((x) =>
    `<button class="orow" data-q="${esc(x)}" style="grid-template-columns:28px 1fr"><span>🕘</span><span><b>${esc(x)}</b></span></button>`).join("");
  list.hidden = false;
  list.querySelectorAll("[data-q]").forEach((b) => (b.onclick = () => { $("omni").value = b.dataset.q; $("omni").dispatchEvent(new Event("input")); $("omni").focus(); }));
}
document.addEventListener("click", (e) => { if (!e.target.closest(".omni")) $("omniList").hidden = true; });

// ===================== Automatický překlad =====================
const translations = new Map();
async function translate(text) {
  if (translations.has(text)) return translations.get(text);
  try {
    const chunks = text.match(/[\s\S]{1,1800}(?=\s|$)/g) || [text];
    const results = await Promise.all(chunks.map(async (chunk) => {
      const url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=cs&dt=t&q=" + encodeURIComponent(chunk);
      return (await fetch(url)).json();
    }));
    if (results[0][2] === "cs") return text; // už je česky
    const out = results.map((j) => j[0].map((x) => x[0]).join("")).join(" ");
    translations.set(text, out);
    return out;
  } catch {
    return null;
  }
}
