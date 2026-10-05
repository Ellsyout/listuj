// ===================== Žebříčky =====================
// 1) Letošní knihy, které si pořídilo nejvíc českých knihoven (Knihovny.cz – počet knihoven u záznamu)
// 2) Co se teď čte ve světě (Open Library trending)
// 3) Nejlépe hodnocené (Open Library, aspoň 500 hodnocení)
// Prodejní žebříčky knihkupectví nemají veřejné rozhraní – na ně jen odkazujeme.
const CHART_KC = [["romány", "Romány"], ["detektivní romány", "Detektivky"], ["fantasy", "Fantasy"], ["milostné romány", "Romantika"], ["příběhy pro děti", "Pro děti"], ["biografie", "Životopisy"]];
const CHART_OL = [["weekly", "Tento týden"], ["monthly", "Tento měsíc"], ["yearly", "Letos"]];
const charts = { kc: CHART_KC[0][0], ol: "weekly" };

function renderCharts() {
  const box = $("charts");
  box.innerHTML = `
    <div class="section" style="margin-top:0">
      <h2>🏛️ Nejžádanější novinky v českých knihovnách</h2>
      <p class="status">Knihy vydané v roce ${YEAR}, které si pořídilo nejvíc knihoven (podle katalogu Knihovny.cz).</p>
      <div class="years" style="margin:10px 0 16px">${CHART_KC.map(([v, l]) => `<button class="chip" data-kc="${esc(v)}" aria-pressed="${charts.kc === v}">${l}</button>`).join("")}</div>
      <div class="grid" id="chartKc">${skeletons(8)}</div>
    </div>

    <div class="section" style="margin-top:0">
      <h2>🌍 Co se teď čte ve světě</h2>
      <p class="status">Nejčtenější knihy čtenářů Open Library (většinou v originálním znění).</p>
      <div class="years" style="margin:10px 0 16px">${CHART_OL.map(([v, l]) => `<button class="chip" data-ol="${v}" aria-pressed="${charts.ol === v}">${l}</button>`).join("")}</div>
      <div class="grid" id="chartOl">${skeletons(8)}</div>
    </div>

    <div class="section" style="margin-top:0">
      <h2>⭐ Nejlépe hodnocené všech dob</h2>
      <p class="status">Knihy s nejvyšším hodnocením od čtenářů Open Library (aspoň 500 hodnocení).</p>
      <div class="grid" id="chartTop">${skeletons(8)}</div>
    </div>

    <div class="section" style="margin-top:0">
      <h2>🛒 Prodejní žebříčky knihkupectví</h2>
      <p class="status" style="margin-bottom:12px">Co se v Česku nejvíc prodává, zveřejňují knihkupectví na svých stránkách:</p>
      <div class="links">
        <a href="https://www.sckn.cz/r-p-b/" target="_blank" rel="noopener">📊 Týdenní žebříček Svazu českých knihkupců</a>
        <a href="https://www.kosmas.cz/bestsellery/" target="_blank" rel="noopener">Kosmas</a>
        <a href="https://www.knihydobrovsky.cz/bestsellery" target="_blank" rel="noopener">Knihy Dobrovský</a>
        <a href="https://www.martinus.cz/bestsellery" target="_blank" rel="noopener">Martinus</a>
      </div>
    </div>`;
  box.querySelectorAll("[data-kc]").forEach((b) => (b.onclick = () => { charts.kc = b.dataset.kc; renderCharts(); }));
  box.querySelectorAll("[data-ol]").forEach((b) => (b.onclick = () => { charts.ol = b.dataset.ol; renderCharts(); }));
  fillChart("chartKc", chartKc(charts.kc));
  fillChart("chartOl", chartOl(charts.ol));
  fillChart("chartTop", chartTop());
}

async function fillChart(id, promise) {
  let books = [];
  try { books = await promise; } catch {}
  const grid = $(id);
  if (!grid) return;
  grid.innerHTML = books.length ? "" : `<p class="status">Žebříček se teď nepodařilo načíst. Zkus to prosím později.</p>`;
  books.slice(0, 20).forEach((b, i) => {
    const el = card(b);
    el.querySelector(".cover").insertAdjacentHTML("beforeend", `<span class="rankb" aria-label="${i + 1}. místo">${i + 1}.</span>`);
    if (b.libs) el.insertAdjacentHTML("beforeend", `<div class="cap">${plural(b.libs, "má", "mají", "má")} ${b.libs} ${plural(b.libs, "knihovna", "knihovny", "knihoven")}</div>`);
    grid.appendChild(el);
  });
}

async function chartKc(subject) {
  const get = async (from, to) => {
    const p = kcParams({ lookfor: subject, type: "Subject", limit: 100, sort: "publishDateSort desc" });
    p.append("filter[]", 'language:"Czech"');
    p.append("filter[]", `publishDate:[${from} TO ${to}]`);
    p.append("filter[]", 'record_format_facet_mv:"0/BOOKS/"');
    return ((await cachedJson(`${KC_API}/search?${p}`, 12)).records || []).filter((r) => r.title).map(toKCBook);
  };
  let books = await get(YEAR, YEAR);
  if (books.length < 15) books = [...books, ...(await get(YEAR - 1, YEAR - 1))]; // začátkem roku je letošních knih málo
  const seen = new Set();
  return books.filter((b) => { const k = normKey(b.title, b.author); return !seen.has(k) && seen.add(k); })
    .sort((a, b) => (b.libs || 0) - (a.libs || 0));
}

async function chartOl(period) {
  const data = await cachedJson(`${API}/trending/${period}.json?limit=30`, 6);
  return (data.works || []).map(toBook);
}

async function chartTop() {
  const p = new URLSearchParams({ q: "ratings_count:[500 TO *]", sort: "rating", limit: 30, fields: FIELDS });
  return (await cachedJson(`${API}/search.json?${p}`, 24)).docs.map(toBook);
}

// ===================== Sdílené seznamy =====================
// Seznam se celý uloží do odkazu (#seznam/…), takže ho jde poslat komukoli bez serveru.
const toB64 = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64 = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

function packBook(b) {
  const id = b.key.startsWith("gb:") ? "g:" + b.gbId : b.key.startsWith("kc:") ? "k:" + b.kcId : "o:" + b.key.replace("/works/", "");
  return [id, b.title, b.author || "", b.cover || b.coverUrl || 0, b.year || 0];
}
function unpackBook([id, title, author, cover, year]) {
  const [src, rest] = [id.slice(0, 1), id.slice(2)];
  const book = {
    key: src === "g" ? "gb:" + rest : src === "k" ? "kc:" + rest : "/works/" + rest,
    gbId: src === "g" ? rest : undefined, kcId: src === "k" ? rest : undefined,
    title, author, authorKeys: [], year: year || null,
    cover: typeof cover === "number" && cover ? cover : null,
    coverUrl: typeof cover === "string" ? cover : null,
  };
  cache.set(book.key, book);
  return book;
}

async function encodeList(name, books) {
  const json = JSON.stringify({ n: name, b: books.slice(0, 60).map(packBook) });
  const bytes = new TextEncoder().encode(json);
  if ("CompressionStream" in window) {
    const zipped = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer());
    return "z" + toB64(zipped);
  }
  return "j" + toB64(bytes);
}
async function decodeList(code) {
  let bytes = fromB64(code.slice(1));
  if (code[0] === "z") bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
  const data = JSON.parse(new TextDecoder().decode(bytes));
  return { name: String(data.n || "Seznam knih").slice(0, 80), books: (data.b || []).map(unpackBook) };
}

async function shareList(defaultName, books) {
  if (!books.length) return toast("Seznam je prázdný.");
  const name = prompt("Jak se má seznam jmenovat?", defaultName);
  if (name === null) return;
  const url = location.origin + location.pathname + "#seznam/" + (await encodeList(name.trim() || defaultName, books));
  const data = { title: name || defaultName, text: `${name || defaultName} – ${books.length} ${plural(books.length, "kniha", "knihy", "knih")} v aplikaci Listuj`, url };
  if (navigator.share) {
    try { await navigator.share(data); return; } catch (e) { if (e.name === "AbortError") return; }
  }
  try { await navigator.clipboard.writeText(url); toast("Odkaz na seznam zkopírován – pošli ho komu chceš"); }
  catch { prompt("Zkopíruj si odkaz na seznam:", url); }
}

async function openSharedList(code) {
  const page = $("listPage");
  closeBook();
  page.hidden = false;
  page.scrollTop = 0;
  document.body.style.overflow = "hidden";
  const back = `<div class="top"><button class="back" id="lBack">← Zpět</button></div>`;
  let data;
  try { data = await decodeList(code); } catch { data = null; }
  if (!data) {
    page.innerHTML = `<div class="wrap">${back}<div class="empty"><b>📚</b>Tenhle odkaz na seznam je poškozený nebo neúplný.</div></div>`;
    $("lBack").onclick = listBack;
    return;
  }
  page.innerHTML = `
    <div class="wrap" style="padding-bottom:calc(70px + env(safe-area-inset-bottom))">
      ${back}
      <h1>📚 ${esc(data.name)}</h1>
      <p class="by" style="color:var(--muted)">Sdílený seznam · ${data.books.length} ${plural(data.books.length, "kniha", "knihy", "knih")}</p>
      <div class="actions" style="margin:14px 0 20px">
        <button class="btn" id="lSaveAll">🔖 Uložit všechny do „Chci si přečíst“</button>
        <button class="btn ghost" id="lShare">📤 Poslat dál</button>
      </div>
      <div class="grid" id="lGrid"></div>
    </div>`;
  data.books.forEach((b) => $("lGrid").appendChild(card(b)));
  $("lBack").onclick = listBack;
  $("lShare").onclick = () => shareList(data.name, data.books);
  $("lSaveAll").onclick = () => {
    let n = 0;
    data.books.forEach((b) => { if (!STATUS.some((x) => inList(x, b.key))) { toggleList("want", b); n++; } });
    toast(n ? `Uloženo ${n} ${plural(n, "kniha", "knihy", "knih")} do „Chci si přečíst“` : "Všechny knihy už máš ve svých seznamech");
    $("lGrid").innerHTML = "";
    data.books.forEach((b) => $("lGrid").appendChild(card(b)));
  };
}
function listBack() { if (state.fromApp) history.back(); else location.hash = ""; }
function closeListPage() {
  const page = $("listPage");
  if (page.hidden) return;
  page.hidden = true;
  page.innerHTML = "";
  document.body.style.overflow = "";
}

// ===================== Odznaky =====================
const BADGES = [
  { id: "first", icon: "📖", name: "První kniha", desc: "Označ první knihu jako přečtenou", goal: 1, of: (s) => s.read },
  { id: "ten", icon: "📚", name: "Knihomol", desc: "Přečti 10 knih", goal: 10, of: (s) => s.read },
  { id: "q25", icon: "🏛️", name: "Bibliofil", desc: "Přečti 25 knih", goal: 25, of: (s) => s.read },
  { id: "q50", icon: "👑", name: "Knižní legenda", desc: "Přečti 50 knih", goal: 50, of: (s) => s.read },
  { id: "thick", icon: "🧱", name: "Tlustospis", desc: "Přečti knihu, která má přes 500 stran", goal: 1, of: (s) => s.thick },
  { id: "pages", icon: "📏", name: "Pět tisíc stran", desc: "Přečti dohromady 5 000 stran", goal: 5000, of: (s) => s.pages },
  { id: "authors", icon: "✍️", name: "Objevitel", desc: "Přečti knihy od 5 různých autorů", goal: 5, of: (s) => s.authors },
  { id: "classic", icon: "🎩", name: "Klasik", desc: "Přečti knihu vydanou před rokem 1950", goal: 1, of: (s) => s.classic },
  { id: "fresh", icon: "🆕", name: "Na vlně novinek", desc: "Přečti 3 knihy vydané letos nebo loni", goal: 3, of: (s) => s.fresh },
  { id: "series", icon: "🔗", name: "Sériový čtenář", desc: "Označ 3 přečtené díly sérií", goal: 3, of: (s) => s.parts },
  { id: "critic", icon: "⭐", name: "Kritik", desc: "Ohodnoť 10 knih", goal: 10, of: (s) => s.rated },
  { id: "streak", icon: "🔥", name: "Vytrvalost", desc: "Čti 3 měsíce po sobě (aspoň 1 kniha měsíčně)", goal: 3, of: (s) => s.streak },
  { id: "challenge", icon: "🏆", name: "Výzva splněna", desc: "Splň svou roční čtenářskou výzvu", goal: 1, of: (s) => s.challenge },
];

function readingStats() {
  const read = lists.read;
  const months = new Set(read.map((b) => { const d = new Date(b.at || Date.now()); return d.getFullYear() * 12 + d.getMonth(); }));
  let streak = 0;
  for (const m of months) { let n = 1; while (months.has(m - n)) n++; streak = Math.max(streak, n); }
  const goals = store.get("vyzva", {});
  const perYear = {};
  read.forEach((b) => { const y = new Date(b.at || Date.now()).getFullYear(); perYear[y] = (perYear[y] || 0) + 1; });
  return {
    read: read.length,
    thick: read.filter((b) => b.pages > 500).length,
    pages: read.reduce((a, b) => a + (+b.pages || 0), 0),
    authors: new Set(read.map((b) => plain((b.author || "").split(", ")[0])).filter(Boolean)).size,
    classic: read.filter((b) => b.year && b.year < 1950).length,
    fresh: read.filter((b) => b.year >= YEAR - 1).length,
    parts: readParts.size,
    rated: Object.keys(myRatings).length,
    streak,
    challenge: Object.entries(goals).some(([y, g]) => g && (perYear[y] || 0) >= g) ? 1 : 0,
  };
}

// po každé změně deníku: nově získané odznaky uložíme a oznámíme
function checkBadges() {
  const earned = store.get("odznaky", {});
  const s = readingStats();
  const fresh = BADGES.filter((b) => !earned[b.id] && b.of(s) >= b.goal);
  if (!fresh.length) return;
  fresh.forEach((b) => { earned[b.id] = Date.now(); });
  store.set("odznaky", earned);
  toast(fresh.length === 1 ? `🏅 Nový odznak: ${fresh[0].icon} ${fresh[0].name}` : `🏅 Nové odznaky: ${fresh.map((b) => b.icon + " " + b.name).join(", ")}`);
}

function badgesHtml() {
  const earned = store.get("odznaky", {});
  const s = readingStats();
  const n = BADGES.filter((b) => earned[b.id]).length;
  return `
    <div class="section" style="margin-top:0">
      <h2>🏅 Odznaky <small style="color:var(--muted);font-weight:500">${n} z ${BADGES.length}</small></h2>
      <div class="badges">${BADGES.map((b) => {
        const have = earned[b.id];
        const val = Math.min(b.of(s), b.goal);
        return `
          <div class="badge ${have ? "have" : ""}" title="${esc(b.desc)}">
            <span class="bicon" aria-hidden="true">${b.icon}</span>
            <b>${esc(b.name)}</b>
            <small>${esc(b.desc)}</small>
            ${have ? `<small class="bdate">získáno ${czDate(have)}</small>`
              : `<span class="bprog" role="progressbar" aria-valuemin="0" aria-valuemax="${b.goal}" aria-valuenow="${val}" aria-label="${esc(b.name)}: ${val} z ${b.goal}"><i style="width:${(val / b.goal) * 100}%"></i></span>
                 <small>${val.toLocaleString("cs-CZ")} / ${b.goal.toLocaleString("cs-CZ")}</small>`}
          </div>`;
      }).join("")}</div>
    </div>`;
}
