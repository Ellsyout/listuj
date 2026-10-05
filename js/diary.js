// ===================== Čtenářský deník =====================
const MONTH_SHORT = ["led", "úno", "bře", "dub", "kvě", "čvn", "čvc", "srp", "zář", "říj", "lis", "pro"];

function renderDiary() {
  const box = $("diary");
  const goals = store.get("vyzva", {});
  const years = [...new Set([YEAR, ...lists.read.map((b) => new Date(b.at || Date.now()).getFullYear())])].sort((a, b) => b - a);
  const year = years.includes(state.diaryYear) ? state.diaryYear : YEAR;
  const done = lists.read.filter((b) => new Date(b.at || Date.now()).getFullYear() === year).sort((a, b) => (b.at || 0) - (a.at || 0));
  const goal = +goals[year] || 0;

  // tempo výzvy (jen u letošního roku)
  let pace = "";
  if (goal && year === YEAR) {
    const start = new Date(YEAR, 0, 1), end = new Date(YEAR + 1, 0, 1);
    const expected = Math.floor(goal * (Date.now() - start) / (end - start));
    const diff = done.length - expected;
    pace = done.length >= goal ? "Výzva splněna! 🎉"
      : diff > 0 ? `Jsi o ${diff} ${plural(diff, "knihu", "knihy", "knih")} napřed 👏`
      : diff < 0 ? `Do tempa ti ${plural(-diff, "chybí", "chybí", "chybí")} ${-diff} ${plural(-diff, "kniha", "knihy", "knih")} – to doženeš.`
      : "Držíš přesně tempo 👍";
  }

  // statistiky roku
  const pages = done.reduce((a, b) => a + (+b.pages || 0), 0);
  const noPages = done.filter((b) => !b.pages).length;
  const stars = done.map((b) => myRatings[b.key]?.stars).filter(Boolean);
  const byAuthor = {};
  done.forEach((b) => { const a = (b.author || "").split(", ")[0]; if (a) byAuthor[a] = (byAuthor[a] || 0) + 1; });
  const top = Object.entries(byAuthor).sort((a, b) => b[1] - a[1])[0];
  const perMonth = Array(12).fill(0);
  done.forEach((b) => perMonth[new Date(b.at || Date.now()).getMonth()]++);
  const maxMonth = Math.max(1, ...perMonth);

  box.innerHTML = `
    <div class="section" style="margin-top:0">
      <h2>🏆 Čtenářská výzva ${year}
        <span class="years">${years.map((y) => `<button class="chip" data-year="${y}" aria-pressed="${y === year}">${y}</button>`).join("")}</span></h2>
      ${goal ? `
        <div class="big">${done.length} <span style="font-size:1.2rem;color:var(--muted)">z ${goal} knih</span></div>
        <div class="sprog" style="max-width:none"><i style="width:${Math.min(100, done.length / goal * 100)}%"></i></div>
        <p class="status">${pace}</p>` : `<p class="status">Kolik knih chceš v roce ${year} přečíst? Nastav si cíl a deník bude hlídat tempo.</p>`}
      <div class="goal">
        <label for="goalInput">Můj cíl:</label>
        <input id="goalInput" type="number" min="1" max="999" inputmode="numeric" value="${goal || ""}" placeholder="např. 20">
        <span>knih</span>
        <button class="btn ghost" id="goalSave" style="min-height:40px;padding:8px 14px">Uložit cíl</button>
      </div>
    </div>

    <div class="section" style="margin-top:0">
      <h2>📊 Rok ${year} v číslech</h2>
      <div class="dtiles">
        <div class="dtile"><b>${done.length}</b><span>${plural(done.length, "přečtená kniha", "přečtené knihy", "přečtených knih")}</span></div>
        <div class="dtile"><b>${pages.toLocaleString("cs-CZ")}</b><span>stran${noPages && done.length ? ` (u ${noPages} ${plural(noPages, "knihy", "knih", "knih")} počet neznáme)` : ""}</span></div>
        <div class="dtile"><b>${stars.length ? "★ " + (stars.reduce((a, b) => a + b, 0) / stars.length).toFixed(1) : "–"}</b><span>tvoje průměrné hodnocení</span></div>
        <div class="dtile"><b style="font-size:1.15rem">${top ? esc(top[0]) : "–"}</b><span>${top ? `nejčtenější autor (${top[1]} ${plural(top[1], "kniha", "knihy", "knih")})` : "nejčtenější autor"}</span></div>
      </div>
      <div class="months" aria-label="Přečtené knihy po měsících">${perMonth.map((n, i) => `
        <div title="${n} ${plural(n, "kniha", "knihy", "knih")}"><span>${n || ""}</span><i class="${n ? "" : "zero"}" style="height:${n ? Math.max(8, n / maxMonth * 100) : 3}%"></i><span>${MONTH_SHORT[i]}</span></div>`).join("")}
      </div>
    </div>

    <div class="section" style="margin-top:0">
      <h2>📖 Právě čtu <small style="color:var(--muted);font-weight:500">${lists.reading.length || ""}</small></h2>
      ${lists.reading.length ? `<div class="grid" id="dReading"></div>` : `<p class="status">Nic rozečteného. Na stránce knihy klikni na „📖 Právě čtu“.</p>`}
    </div>

    <div class="section" style="margin-top:0">
      <h2>✅ Přečteno v roce ${year} <small style="color:var(--muted);font-weight:500">${done.length || ""}</small>
        ${done.length ? `<button class="linkbtn" id="shareRead">📤 Sdílet</button>` : ""}</h2>
      ${done.length ? `<div class="grid" id="dRead"></div>` : `<p class="status">V roce ${year} zatím nic. Dočtenou knihu označíš tlačítkem „✅ Přečteno“ na její stránce.</p>`}
    </div>

    ${badgesHtml()}

    <div class="section" style="margin-top:0">
      <h2>💾 Záloha a přenos na jiné zařízení</h2>
      <p class="status" style="margin-bottom:12px">Deník, seznamy i hodnocení jsou uložené jen v tomto prohlížeči. Zálohu si stáhni jako soubor a na jiném zařízení (nebo po smazání dat) ji nahraj zpět.</p>
      <div class="actions" style="margin:0">
        <button class="btn" id="backupExport">⬇️ Stáhnout zálohu</button>
        <button class="btn ghost" id="backupImport">⬆️ Nahrát zálohu</button>
        <input type="file" id="backupFile" accept="application/json,.json" hidden>
      </div>
    </div>`;

  box.querySelectorAll("[data-year]").forEach((b) => (b.onclick = () => { state.diaryYear = +b.dataset.year; renderDiary(); }));
  $("goalSave").onclick = () => {
    const n = Math.max(0, Math.min(999, parseInt($("goalInput").value) || 0));
    const g = store.get("vyzva", {});
    if (n) g[year] = n; else delete g[year];
    store.set("vyzva", g);
    checkBadges();
    toast(n ? `Cíl na rok ${year}: ${n} ${plural(n, "kniha", "knihy", "knih")}` : "Cíl zrušen");
    renderDiary();
  };
  lists.reading.forEach((book) => {
    const el = card(book);
    const btn = document.createElement("button");
    btn.className = "btn ghost mini-btn";
    btn.textContent = "✅ Dočteno";
    btn.onclick = (e) => { e.stopPropagation(); toggleList("read", book); toast(`„${book.title}“ je v přečtených 🎉`); render(); };
    el.appendChild(btn);
    $("dReading").appendChild(el);
  });
  done.forEach((book) => {
    const el = card(book);
    el.insertAdjacentHTML("beforeend", `<div class="cap">dočteno ${czDate(book.at || Date.now())}</div>`);
    $("dRead").appendChild(el);
  });
  $("backupExport").onclick = exportBackup;
  if ($("shareRead")) $("shareRead").onclick = () => shareList(`Co jsem přečetl/a v roce ${year}`, done);
  $("backupImport").onclick = () => $("backupFile").click();
  $("backupFile").onchange = (e) => { if (e.target.files[0]) importBackup(e.target.files[0]); };
}

// ===================== Záloha =====================
function exportBackup() {
  const data = {};
  BACKUP_KEYS.forEach((k) => { const v = store.get(k, null); if (v !== null) data[k] = v; });
  const blob = new Blob([JSON.stringify({ app: "Listuj", version: 1, date: new Date().toISOString(), data }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `listuj-zaloha-${isoDate(Date.now())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast("Záloha stažena");
}

// zálohu přidáme k tomu, co už v prohlížeči je (nic se nesmaže)
function mergeBackup(data) {
  const byKey = (cur, add) => { const have = new Set(cur.map((b) => b.key)); return [...cur, ...add.filter((b) => b && b.key && !have.has(b.key))]; };
  for (const k of ["oblibene", "chci-si-precist", "ctu", "precteno"]) {
    if (Array.isArray(data[k])) store.set(k, byKey(store.get(k, []), data[k]));
  }
  if (data["moje-hodnoceni"] && typeof data["moje-hodnoceni"] === "object") {
    const cur = store.get("moje-hodnoceni", {});
    for (const [key, r] of Object.entries(data["moje-hodnoceni"])) if (!cur[key] || (r.date || 0) > (cur[key].date || 0)) cur[key] = r;
    store.set("moje-hodnoceni", cur);
  }
  if (Array.isArray(data["vlastni-seznamy"])) {
    // seznamy podle id; u stejného seznamu sloučíme knihy
    const cur = store.get("vlastni-seznamy", []);
    for (const l of data["vlastni-seznamy"]) {
      if (!l?.id || !Array.isArray(l.books)) continue;
      const mine = cur.find((x) => x.id === l.id);
      if (!mine) cur.push(l);
      else { const have = new Set(mine.books.map((b) => b.key)); mine.books.push(...l.books.filter((b) => b?.key && !have.has(b.key))); }
    }
    store.set("vlastni-seznamy", cur);
  }
  if (data.odznaky && typeof data.odznaky === "object") store.set("odznaky", { ...data.odznaky, ...store.get("odznaky", {}) });
  if (Array.isArray(data["prectene-dily"])) store.set("prectene-dily", [...new Set([...store.get("prectene-dily", []), ...data["prectene-dily"]])]);
  if (data.vyzva && typeof data.vyzva === "object") store.set("vyzva", { ...data.vyzva, ...store.get("vyzva", {}) });
  if (data.uvitani && !store.get("uvitani", null)) store.set("uvitani", data.uvitani);
  if (data.sledovani) {
    const cur = store.get("sledovani", { authors: [], series: [] });
    const names = new Set(cur.authors.map((a) => plain(a.name)));
    const ids = new Set(cur.series.map((x) => x.id));
    cur.authors.push(...(data.sledovani.authors || []).filter((a) => a?.name && !names.has(plain(a.name))));
    cur.series.push(...(data.sledovani.series || []).filter((x) => x?.id && !ids.has(x.id)));
    store.set("sledovani", cur);
  }
}

async function importBackup(file) {
  let parsed;
  try { parsed = JSON.parse(await file.text()); } catch { return toast("Tenhle soubor se nepodařilo přečíst."); }
  if (parsed?.app !== "Listuj" || !parsed.data) return toast("Tohle není záloha z aplikace Listuj.");
  const n = (parsed.data.precteno || []).length + (parsed.data.oblibene || []).length + (parsed.data["chci-si-precist"] || []).length + (parsed.data.ctu || []).length;
  if (!confirm(`Záloha z ${czDate(parsed.date)} obsahuje ${n} ${plural(n, "knihu", "knihy", "knih")} v seznamech.\n\nPřidáme ji k tomu, co tu už máš – nic se nesmaže. Pokračovat?`)) return;
  mergeBackup(parsed.data);
  toast("Záloha nahrána ✓");
  setTimeout(() => location.reload(), 900);
}

// ===================== Sdílení knihy =====================
async function shareBook(book) {
  const url = location.origin + location.pathname + "#" + bookHash(book);
  const data = { title: book.title, text: `${book.title}${book.author ? " – " + book.author : ""} · tip z aplikace Listuj`, url };
  if (navigator.share) {
    try { await navigator.share(data); return; } catch (e) { if (e.name === "AbortError") return; }
  }
  try { await navigator.clipboard.writeText(url); toast("Odkaz zkopírován – vlož ho do zprávy"); }
  catch { prompt("Zkopíruj si odkaz na knihu:", url); }
}

// ===================== Sledování autorů a sérií =====================
let follows = store.get("sledovani", { authors: [], series: [] });
const followsAuthor = (a) => follows.authors.some((x) => (a.key && x.key === a.key) || plain(x.name) === plain(a.name || ""));
function mountAuthorFollow() {
  const slot = $("aFollowSlot");
  if (!slot || !state.author?.name) return;
  const me = { key: state.author.key || null, name: state.author.name };
  const on = followsAuthor(me);
  slot.innerHTML = `<button class="btn ghost ${on ? "on" : ""}" id="aFollow" style="min-height:38px;padding:6px 14px;margin:2px 0 10px">${on ? "🔔 Autora sleduješ" : "🔔 Sledovat autora"}</button>`;
  $("aFollow").onclick = () => {
    follows.authors = on ? follows.authors.filter((x) => !((me.key && x.key === me.key) || plain(x.name) === plain(me.name))) : [...follows.authors, me];
    store.set("sledovani", follows);
    toast(on ? "Autora už nesleduješ" : "Autora sleduješ – jeho novinky uvidíš na úvodní stránce");
    mountAuthorFollow();
  };
}

// úvodní stránka: novinky od sledovaných autorů (poslední 2 roky) a nové díly sledovaných sérií
async function loadFollowed() {
  const box = $("followed");
  if (!follows.authors.length && !follows.series.length) { box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = `
    <div class="bday-head"><h2>🔔 Sleduješ</h2><span>novinky od tvých autorů a sérií</span></div>
    <div class="genres" style="margin-bottom:10px">
      ${follows.authors.map((a) => `<a class="chip" href="${a.key ? "#autor/" + a.key : "#autor-jmeno/" + encodeURIComponent(a.name)}">✍️ ${esc(a.name)}</a>`).join("")}
      ${follows.series.map((x, i) => `<a class="chip" id="fs-${i}" href="#serie/${encodeURIComponent(x.id)}">📚 ${esc(x.name)}</a>`).join("")}
    </div>
    <div class="strip" id="followedStrip"></div>
    <p class="status" id="followedNote">${follows.authors.length ? "Hledám novinky…" : ""}</p>`;
  box.querySelectorAll("a.chip").forEach((a) => (a.onclick = () => { state.fromApp = true; }));

  const known = knownKeys();
  const per = await Promise.all(follows.authors.slice(0, 8).map(async (a) => {
    const out = [];
    try { out.push(...(await kcSearch(`"${a.name}"`, "Author", 12)).filter((b) => sameAuthor(b, a.name))); } catch {}
    if (a.key) {
      try {
        const p = new URLSearchParams({ author_key: a.key, sort: "new", limit: 6, fields: FIELDS });
        if ($("lang").value) p.set("language", $("lang").value);
        out.push(...(await (await fetch(`${API}/search.json?${p}`)).json()).docs.map(toBook));
      } catch {}
    }
    return out.filter((b) => b.year >= YEAR - 1).map((b) => ({ b, who: a.name }));
  }));
  // od každého autora nejvýš 4 nejnovější knihy, autoři se střídají
  const seen = new Set();
  const lanes = per.map((list) => list.sort((x, y) => (y.b.year || 0) - (x.b.year || 0)).filter(({ b }) => {
    const k = normKey(b.title, b.author);
    if (seen.has(k) || known.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 4));
  const fresh = [];
  for (let i = 0; i < 4; i++) lanes.forEach((lane) => lane[i] && fresh.length < 14 && fresh.push(lane[i]));
  if (!$("followedStrip")) return;
  fresh.forEach(({ b, who }) => {
    const el = card(b);
    el.insertAdjacentHTML("beforeend", `<div class="cap">nové od: ${esc(who)}</div>`);
    $("followedStrip").appendChild(el);
  });
  $("followedNote").textContent = fresh.length || !follows.authors.length ? "" : "Od sledovaných autorů teď není nic nového.";

  // série: přibyl díl od doby, kdy ji uživatel naposledy otevřel?
  follows.series.slice(0, 5).forEach(async (x, i) => {
    try {
      const d = await seriesById(x.id);
      const n = d?.parts.filter((y) => y.num != null).length || 0;
      if (d) seriesCache.set(x.id, d);
      if (n > (x.count || 0) && $("fs-" + i)) { $("fs-" + i).classList.add("new"); $("fs-" + i).textContent = `📚 ${x.name} · nový díl!`; }
    } catch {}
  });
}

// ===================== Pro tebe: doporučení podle oblíbených a dobře hodnocených knih =====================
async function loadForYou() {
  const box = $("forYou");
  const disliked = new Set(Object.entries(myRatings).filter(([, r]) => r.stars <= 2).map(([k]) => k));
  const likedAll = [...lists.fav, ...Object.values(myRatings).filter((r) => r.stars >= 4).map((r) => r.book), ...lists.read, ...lists.reading]
    .filter((b) => b && !disliked.has(b.key));
  const liked = [...new Map(likedAll.map((b) => [b.key, b])).values()];
  if (!liked.length) return forYouByGenres(box);
  box.hidden = false;
  box.innerHTML = `
    <div class="bday-head"><h2>✨ Pro tebe</h2><span>podle knih, které se ti líbily · <button class="linkbtn" id="forYouMore">↻ jiné tipy</button></span></div>
    <div class="strip" id="forYouStrip">${skeletons(6)}</div>`;
  $("forYouMore").onclick = loadForYou;

  const seeds = shuffle([...liked]).slice(0, 3);
  const known = knownKeys();
  const per = await Promise.all(seeds.map(async (seed) => {
    try { return (await similarFromInfo(seed, await bookInfo(seed))).map((b) => ({ b, seed })); } catch { return []; }
  }));
  // střídavě od každé „výchozí“ knihy, nejvýš 2 knihy od jednoho autora
  const picks = [], seen = new Set(), perAuthor = {};
  for (let i = 0; i < 20 && picks.length < 14; i++) {
    for (const list of per) {
      const x = list[i];
      if (!x) continue;
      const k = normKey(x.b.title, x.b.author), a = (x.b.author || "").split(", ")[0];
      if (seen.has(k) || known.has(k) || perAuthor[a] >= 2) continue;
      seen.add(k); perAuthor[a] = (perAuthor[a] || 0) + 1;
      picks.push(x);
    }
  }
  const strip = $("forYouStrip");
  if (!strip) return;
  strip.innerHTML = "";
  if (!picks.length) { strip.outerHTML = `<p class="status">Zatím jsme nenašli vhodné tipy. Přidej si pár knih do oblíbených nebo je ohodnoť.</p>`; return; }
  picks.forEach(({ b, seed }) => {
    const el = card(b);
    el.insertAdjacentHTML("beforeend", `<div class="cap">protože se ti líbí: ${esc(seed.title)}</div>`);
    strip.appendChild(el);
  });
}

// jak často uživatel žánry čte (z uvítání) – váhy 3 = pořád, 2 = často, 1 = občas, 0.5 = výjimečně
const FREQ = [[3, "Pořád"], [2, "Často"], [1, "Občas"], [0.5, "Výjimečně"]];
function genreWeights() {
  const u = store.get("uvitani", {}) || {};
  if (u.weights && Object.keys(u.weights).length) return u.weights;
  return Object.fromEntries((u.genres || []).map((g) => [g, 2])); // starší uvítání bez otázky na četnost
}

// populární knihy z oblíbených žánrů – oblíbenější žánr dostane víc míst
async function weightedGenreBooks(weights, total) {
  const counts = allocate(weights, total);
  const known = knownKeys();
  const lanes = await Promise.all(Object.entries(counts).map(async ([g, n]) => {
    let books = [];
    try {
      const gq = olGenreQuery([g], "any");
      if (gq) {
        const get = async (lang) => {
          const p = new URLSearchParams({ q: `${gq} cover_i:[* TO *]`, sort: "readinglog", limit: Math.max(12, n * 4), fields: FIELDS });
          if (lang) p.set("language", lang);
          return (await (await fetch(`${API}/search.json?${p}`)).json()).docs.map(toBook);
        };
        books = await get($("lang").value);
        if (books.length < n && $("lang").value) books = [...books, ...(await get(""))];
      } else if (KC_GENRES[g]) {
        books = (await kcSearch(KC_GENRES[g], "Subject", Math.max(20, n * 4), "")).filter((b) => b.coverUrl);
      }
    } catch {}
    return { n, books: shuffle(books.slice(0, Math.max(12, n * 3))) };
  }));
  const seen = new Set(), perAuthor = {}, out = [];
  const take = (b) => {
    const k = normKey(b.title, b.author), a = (b.author || "").split(", ")[0];
    if (seen.has(k) || known.has(k) || perAuthor[a] >= 2) return false;
    seen.add(k); perAuthor[a] = (perAuthor[a] || 0) + 1;
    return true;
  };
  const picked = lanes.map(({ n, books }) => books.filter(take).slice(0, n));
  for (let i = 0; i < total; i++) picked.forEach((lane) => lane[i] && out.push(lane[i])); // žánry se střídají
  return out.slice(0, total);
}

// nový uživatel ještě nemá oblíbené knihy – tipy podle žánrů, které si vybral při uvítání
async function forYouByGenres(box) {
  const weights = genreWeights();
  if (!Object.keys(weights).length) { box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = `
    <div class="bday-head"><h2>✨ Pro tebe</h2><span>podle žánrů, které čteš · <button class="linkbtn" id="forYouGenres">změnit žánry</button></span></div>
    <div class="strip" id="forYouStrip">${skeletons(6)}</div>`;
  $("forYouGenres").onclick = openWelcome;
  try {
    const books = await weightedGenreBooks(weights, 14);
    if (!$("forYouStrip")) return;
    $("forYouStrip").innerHTML = "";
    books.forEach((b) => $("forYouStrip").appendChild(card(b)));
    if (!books.length) box.hidden = true;
  } catch { box.hidden = true; }
}

// ===================== Uvítání nového uživatele =====================
// 1) které žánry čteš → 2) jak často který → 3) které knihy se ti líbily → 4) hotovo
const welcome = { step: 1, genres: [], weights: {}, picks: new Map(), books: null };
const WELCOME_STEPS = 4;

function maybeWelcome() {
  if (store.get("uvitani", null)) return;
  const hasData = Object.values(lists).some((l) => l.length) || Object.keys(myRatings).length;
  if (hasData) return store.set("uvitani", { done: true, genres: [], weights: {} }); // stávající uživatel uvítání nepotřebuje
  if (location.hash) return;                                                         // přišel přes odkaz na knihu – nerušíme
  openWelcome();
}
function openWelcome() {
  const u = store.get("uvitani", {}) || {};
  welcome.step = 1;
  welcome.genres = [...(u.genres || [])];
  welcome.weights = { ...genreWeights() };
  welcome.picks = new Map();
  welcome.books = null;
  renderWelcome();
  if (!$("welcome").open) $("welcome").showModal();
}
function finishWelcome(skip = false) {
  const prev = store.get("uvitani", {}) || {};
  const weights = Object.fromEntries(welcome.genres.map((g) => [g, welcome.weights[g] ?? 2]));
  store.set("uvitani", skip ? { done: true, genres: prev.genres || [], weights: prev.weights || {} } : { done: true, genres: welcome.genres, weights });
  if ($("welcome").open) $("welcome").close();
  if (skip) return;
  welcome.picks.forEach((b) => { if (!inList("fav", b.key)) toggleList("fav", b); });
  // na úvodní stránce rovnou žánry, které čte „pořád“ nebo „často“ (jinak tři nejčtenější)
  const main = welcome.genres.filter((g) => weights[g] >= 2);
  const start = (main.length ? main : [...welcome.genres].sort((a, b) => weights[b] - weights[a]).slice(0, 3));
  if (start.length) { setMode("genre"); state.genres = start; state.genreMode = "any"; syncGenres(); search(); }
  loadForYou();
  toast(welcome.picks.size ? `Uloženo ${welcome.picks.size} ${plural(welcome.picks.size, "oblíbená kniha", "oblíbené knihy", "oblíbených knih")} – tipy najdeš v sekci Pro tebe` : "Hotovo, můžeš listovat 📖");
}
async function welcomeBooks() {
  const weights = Object.fromEntries(welcome.genres.map((g) => [g, welcome.weights[g] ?? 2]));
  if (Object.keys(weights).length) return weightedGenreBooks(weights, 18);
  // bez žánrů: nejoblíbenější knihy vůbec
  const p = new URLSearchParams({ q: "cover_i:[* TO *] subject:fiction", sort: "readinglog", limit: 40, fields: FIELDS });
  if ($("lang").value) p.set("language", $("lang").value);
  const seen = new Set(), perAuthor = {};
  return (await (await fetch(`${API}/search.json?${p}`)).json()).docs.map(toBook).filter((b) => {
    const k = normKey(b.title, b.author), a = (b.author || "").split(", ")[0];
    if (seen.has(k) || perAuthor[a] >= 2) return false;
    seen.add(k); perAuthor[a] = (perAuthor[a] || 0) + 1;
    return true;
  }).slice(0, 18);
}
function renderWelcome() {
  const dlg = $("welcome");
  const dots = `<div class="wdots">${Array.from({ length: WELCOME_STEPS }, (_, i) => `<i class="${i < welcome.step ? "on" : ""}"></i>`).join("")}</div>`;
  const go = (step) => { welcome.step = step; renderWelcome(); };
  if (welcome.step === 1) {
    dlg.innerHTML = `<div class="wel">${dots}
      <h2>Vítej v Listuj 👋</h2>
      <p>Pomůžeme ti najít další knihu. Nejdřív nám řekni, <b>jaké žánry čteš</b> – vyber klidně víc.</p>
      <div class="genres">${GENRES.map(([e, l, id]) => `<button class="chip" data-g="${id}" aria-pressed="${welcome.genres.includes(id)}">${e} ${l}</button>`).join("")}</div>
      <div class="actions"><button class="linkbtn" id="wSkip">Přeskočit</button><button class="btn" id="wNext">Pokračovat →</button></div></div>`;
    dlg.querySelectorAll("[data-g]").forEach((b) => (b.onclick = () => {
      const id = b.dataset.g;
      welcome.genres = welcome.genres.includes(id) ? welcome.genres.filter((g) => g !== id) : [...welcome.genres, id];
      b.setAttribute("aria-pressed", String(welcome.genres.includes(id)));
      welcome.books = null;
    }));
    $("wSkip").onclick = () => finishWelcome(true);
    $("wNext").onclick = () => go(welcome.genres.length ? 2 : 3); // bez žánrů není na co se ptát
  } else if (welcome.step === 2) {
    dlg.innerHTML = `<div class="wel">${dots}
      <h2>Jak často tyhle žánry čteš?</h2>
      <p>Podle toho poznáme, co ti nabízet nejvíc.</p>
      <div class="freq">${welcome.genres.map((g) => `
        <div class="freq-row">
          <b>${esc(genreLabel(g))}</b>
          <div class="seg" role="radiogroup" aria-label="Jak často čteš ${esc(genreLabel(g))}">
            ${FREQ.map(([w, l]) => `<button role="radio" data-g="${g}" data-w="${w}" aria-pressed="${(welcome.weights[g] ?? 2) === w}" aria-checked="${(welcome.weights[g] ?? 2) === w}">${l}</button>`).join("")}
          </div>
        </div>`).join("")}
      </div>
      <div class="actions"><button class="btn ghost" id="wBack">← Zpět</button><button class="btn" id="wNext">Pokračovat →</button></div></div>`;
    dlg.querySelectorAll("[data-w]").forEach((b) => (b.onclick = () => {
      welcome.weights[b.dataset.g] = +b.dataset.w;
      welcome.books = null;
      dlg.querySelectorAll(`[data-g="${b.dataset.g}"]`).forEach((x) => {
        const on = +x.dataset.w === +b.dataset.w;
        x.setAttribute("aria-pressed", String(on));
        x.setAttribute("aria-checked", String(on));
      });
    }));
    $("wBack").onclick = () => go(1);
    $("wNext").onclick = () => go(3);
  } else if (welcome.step === 3) {
    dlg.innerHTML = `<div class="wel">${dots}
      <h2>Které z nich se ti líbily?</h2>
      <p>Ťukni na knihy, které máš ráda/rád. Uložíme je do oblíbených a podle nich ti budeme doporučovat další.</p>
      <div class="wgrid" id="wGrid"><p>Načítám knihy…</p></div>
      <div class="actions"><button class="btn ghost" id="wBack">← Zpět</button><button class="btn" id="wNext">Pokračovat →</button></div></div>`;
    $("wBack").onclick = () => go(welcome.genres.length ? 2 : 1);
    $("wNext").onclick = () => go(4);
    (async () => {
      try { welcome.books = welcome.books || await welcomeBooks(); } catch { welcome.books = []; }
      const grid = $("wGrid");
      if (!grid || welcome.step !== 3) return;
      if (!welcome.books.length) { grid.innerHTML = `<p>Knihy se nepodařilo načíst – nevadí, pokračuj dál.</p>`; return; }
      grid.innerHTML = welcome.books.map((b, i) => `
        <button class="wpick ${welcome.picks.has(b.key) ? "on" : ""}" data-i="${i}" aria-pressed="${welcome.picks.has(b.key)}">
          <span class="heart">♥</span><div class="cover">${coverHtml(b)}</div><small>${esc(b.title)}</small></button>`).join("");
      grid.querySelectorAll(".wpick").forEach((el) => (el.onclick = () => {
        const b = welcome.books[el.dataset.i];
        welcome.picks.has(b.key) ? welcome.picks.delete(b.key) : welcome.picks.set(b.key, b);
        el.classList.toggle("on", welcome.picks.has(b.key));
        el.setAttribute("aria-pressed", String(welcome.picks.has(b.key)));
      }));
    })();
  } else {
    dlg.innerHTML = `<div class="wel">${dots}
      <h2>Hotovo 🎉</h2>
      <p>Tohle všechno v Listuj najdeš:</p>
      <ul>
        <li>🔍 <b>Hledání</b> podle žánru, autora, názvu i nálady („romantika s upíry“, „něco jako Hobit“)</li>
        <li>✨ <b>Pro tebe</b> – tipy podle žánrů, které čteš nejčastěji, a knih, které se ti líbí</li>
        <li>📔 <b>Můj deník</b> – co čteš, co máš přečteno, a čtenářská výzva</li>
        <li>📚 <b>Série</b> – který díl následuje a kde pokračovat</li>
      </ul>
      <p>Všechno se ukládá jen ve tvém prohlížeči, bez registrace.</p>
      <div class="actions"><button class="btn ghost" id="wBack">← Zpět</button><button class="btn" id="wDone">Začít listovat 📖</button></div></div>`;
    $("wBack").onclick = () => go(3);
    $("wDone").onclick = () => finishWelcome(false);
  }
}
$("welcome").addEventListener("cancel", () => finishWelcome(true)); // Esc = přeskočit

// ===================== O aplikaci, soukromí a zpětná vazba =====================
function openAbout(toForm = false) {
  const page = $("about");
  closeBook();
  closeSeries();
  page.hidden = false;
  page.scrollTop = 0;
  document.body.style.overflow = "hidden";
  page.innerHTML = `
    <div class="wrap" style="padding-bottom:calc(70px + env(safe-area-inset-bottom))">
      <div class="top"><button class="back" id="aBack">← Zpět</button></div>
      <h1>📖 O aplikaci Listuj</h1>
      <p class="by" style="color:var(--muted)">Najdi svou další knihu – podle žánru, autora, názvu nebo nálady.</p>

      <div class="section">
        <h2>📚 Odkud jsou knihy</h2>
        <ul>
          <li><a href="https://www.knihovny.cz" target="_blank" rel="noopener">Knihovny.cz</a> – souhrnný katalog českých knihoven: české knihy, e-knihy a audioknihy s českými anotacemi</li>
          <li><a href="https://openlibrary.org" target="_blank" rel="noopener">Open Library</a> – knihy z celého světa, hodnocení čtenářů, e-knihy k vypůjčení</li>
          <li><a href="https://books.google.com" target="_blank" rel="noopener">Google Books</a> – nové knihy a ukázky</li>
          <li><a href="https://cs.wikipedia.org" target="_blank" rel="noopener">Wikipedie</a> a <a href="https://www.wikidata.org" target="_blank" rel="noopener">Wikidata</a> – narozeniny spisovatelů a pořadí dílů v sériích</li>
        </ul>
        <p class="note">Údaje přebíráme tak, jak je tyto zdroje uvádějí. Občas v nich může být chyba nebo kniha chybět.</p>
      </div>

      <div class="section">
        <h2>🔒 Soukromí</h2>
        <ul>
          <li><b>Žádná registrace ani účet.</b> Aplikace nepoužívá reklamní ani sledovací cookies.</li>
          <li><b>Tvoje data zůstávají u tebe.</b> Oblíbené knihy, deník, hodnocení, sledování a historie se ukládají jen do úložiště tohoto prohlížeče. Nikam je neposíláme a smazat je můžeš vymazáním dat prohlížeče.</li>
          <li><b>Co odchází ven:</b> když něco hledáš, pošle se hledaný text zdrojům uvedeným výše, aby vrátily knihy. Cizojazyčné popisy knih se posílají k překladu Překladači Google. Písmo se načítá ze služby Google Fonts.</li>
          ${GOATCOUNTER ? `<li><b>Počítání návštěv:</b> používáme <a href="https://www.goatcounter.com" target="_blank" rel="noopener">GoatCounter</a>, který bez cookies a bez ukládání osobních údajů počítá, kolikrát byla aplikace otevřena.</li>` : `<li><b>Návštěvy nepočítáme</b> a nesledujeme, co v aplikaci děláš.</li>`}
          ${AI_ENDPOINT ? `<li><b>Hledání podle nálady:</b> větu, kterou napíšeš, pošleme přes náš server umělé inteligenci Claude (Anthropic), aby z ní poznala žánry a motivy. Nic dalšího o tobě se neposílá.</li>` : ""}
          ${FEEDBACK_ENDPOINT ? `<li><b>Formulář „Napiš nám“:</b> zprávu (a e-mail, pokud ho vyplníš) nám doručí služba Formspree.</li>` : ""}
        </ul>
      </div>

      ${FEEDBACK_ENDPOINT ? `
      <div class="section" id="aboutFb">
        <h2>✉️ Napiš nám</h2>
        <form class="fb" id="fbForm">
          <label>O co jde?
            <select id="fbType"><option>Tip na vylepšení</option><option>Něco nefunguje</option><option>Chybí mi kniha</option><option>Něco jiného</option></select></label>
          <label>Zpráva
            <textarea id="fbText" required minlength="5" maxlength="2000" placeholder="Napiš, co bys chtěl/a zlepšit nebo co se pokazilo…"></textarea></label>
          <label>Tvůj e-mail (nepovinné, jen když chceš odpověď)
            <input id="fbMail" type="email" autocomplete="email" placeholder="jmeno@example.cz"></label>
          <input id="fbTrap" type="text" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px">
          <div class="actions" style="margin:0"><button class="btn" id="fbSend" type="submit">Odeslat zprávu</button></div>
        </form>
      </div>` : ""}

      <div class="section">
        <h2>⚙️ Nastavení</h2>
        <div class="actions" style="margin:0">
          <button class="btn ghost" id="aBackup">💾 Záloha dat</button>
          <button class="btn ghost" id="aWelcome">👋 Spustit uvítání znovu</button>
        </div>
      </div>
    </div>`;
  $("aBack").onclick = () => { if (state.fromApp) history.back(); else location.hash = ""; };
  $("aBackup").onclick = () => { location.hash = ""; setTimeout(goToBackup, 60); };
  $("aWelcome").onclick = () => { location.hash = ""; setTimeout(openWelcome, 60); };
  if ($("fbForm")) $("fbForm").onsubmit = sendFeedback;
  if (toForm && $("aboutFb")) $("aboutFb").scrollIntoView();
}
function closeAbout() {
  const page = $("about");
  if (page.hidden) return;
  page.hidden = true;
  page.innerHTML = "";
  document.body.style.overflow = "";
}
function goToBackup() {
  showView("diary");
  render();
  $("backupExport")?.closest(".section").scrollIntoView({ behavior: "smooth", block: "center" });
}
async function sendFeedback(e) {
  e.preventDefault();
  const text = $("fbText").value.trim();
  if ($("fbTrap").value) return;          // past na roboty
  if (text.length < 5) return toast("Napiš prosím aspoň pár slov.");
  $("fbSend").disabled = true;
  $("fbSend").textContent = "Odesílám…";
  try {
    const r = await fetch(FEEDBACK_ENDPOINT, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ typ: $("fbType").value, zprava: text, email: $("fbMail").value.trim() || undefined, _subject: "Listuj: " + $("fbType").value }),
    });
    if (!r.ok) throw new Error(r.status);
    $("fbForm").outerHTML = `<p>✅ <b>Děkujeme!</b> Zpráva je odeslaná.</p>`;
  } catch {
    $("fbSend").disabled = false;
    $("fbSend").textContent = "Odeslat zprávu";
    toast("Zprávu se nepodařilo odeslat. Zkus to prosím za chvíli.");
  }
}

// anonymní počítadlo návštěv (jen pokud je nastavené)
if (GOATCOUNTER) {
  const sc = document.createElement("script");
  sc.async = true;
  sc.src = "https://gc.zgo.at/count.js";
  sc.dataset.goatcounter = `https://${GOATCOUNTER}.goatcounter.com/count`;
  document.head.appendChild(sc);
}
