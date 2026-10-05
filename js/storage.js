// ===================== Úložiště =====================
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const lists = Object.fromEntries(Object.entries(LISTS).map(([id, l]) => [id, store.get(l.store, [])]));
let myRatings = store.get("moje-hodnoceni", {}); // key -> { stars, text, date, book }

const inList = (id, key) => lists[id].some((b) => b.key === key);
function toggleList(id, book) {
  const had = inList(id, book.key);
  if (!had && STATUS.includes(id)) {
    // „Přečteno“ knihu vyřadí z „Právě čtu“ a „Chci si přečíst“ apod.
    STATUS.filter((x) => x !== id && inList(x, book.key)).forEach((x) => {
      lists[x] = lists[x].filter((b) => b.key !== book.key);
      store.set(LISTS[x].store, lists[x]);
    });
  }
  lists[id] = had ? lists[id].filter((b) => b.key !== book.key) : [{ ...slim(book), at: Date.now() }, ...lists[id]];
  store.set(LISTS[id].store, lists[id]);
  renderTabs();
  if (id === "read" && !had) checkBadges();
}
// knihy, které už uživatel zná (v seznamech nebo ohodnocené) – ty nedoporučujeme
function knownKeys() {
  const all = [...Object.values(lists).flat(), ...Object.values(myRatings).map((r) => r.book)];
  return new Set(all.map((b) => normKey(b.title, b.author)));
}
function toast(text) {
  document.querySelector(".toast")?.remove();
  const el = document.createElement("div");
  el.className = "toast";
  el.setAttribute("role", "status");     // čtečka obrazovky hlášku přečte
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}
function slim(b) { // ukládáme jen to, co je potřeba pro kartičku
  const { key, title, original, author, authorKeys, year, cover, coverUrl, gbId, kcId, kcEbookId, kcAudioId, rating, ratings, editions, pages, ebook, ebookAvail, audioAvail, ia, libs } = b;
  return { key, title, original, author, authorKeys, year, cover, coverUrl, gbId, kcId, kcEbookId, kcAudioId, rating, ratings, editions, pages, ebook, ebookAvail, audioAvail, ia, libs };
}

// ===================== Paměť na výsledky =====================
// Výsledky, které se mění málo (série z Wikidat, popisy knih, překlady, žebříčky), si pamatujeme v prohlížeči,
// aby se příště zobrazily hned. Nejstarší záznamy se mažou, když jich je moc nebo dojde místo.
const CACHE_PREFIX = "c:";
const CACHE_MAX = 400;
const shortHash = (str) => { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + str.length.toString(36); };
function cacheGet(key, ttlHours) {
  try {
    const hit = JSON.parse(localStorage.getItem(CACHE_PREFIX + shortHash(key)) || "null");
    if (hit && hit.k === key && Date.now() - hit.t < ttlHours * 3600e3) return hit.v;
  } catch {}
  return undefined;
}
function cacheSet(key, value) {
  const item = JSON.stringify({ k: key, t: Date.now(), v: value });
  try { localStorage.setItem(CACHE_PREFIX + shortHash(key), item); }
  catch { cachePrune(true); try { localStorage.setItem(CACHE_PREFIX + shortHash(key), item); } catch {} }
  if (Math.random() < 0.05) cachePrune();
}
function cachePrune(force = false) {
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(CACHE_PREFIX));
    if (!force && keys.length <= CACHE_MAX) return;
    const byAge = keys.map((k) => { try { return [k, JSON.parse(localStorage.getItem(k)).t || 0]; } catch { return [k, 0]; } }).sort((a, b) => a[1] - b[1]);
    byAge.slice(0, Math.ceil(byAge.length / 3)).forEach(([k]) => localStorage.removeItem(k));
  } catch {}
}
// fetch + JSON s pamětí; ttlHours = jak dlouho výsledek platí
async function cachedJson(url, ttlHours, opts) {
  const hit = cacheGet(url, ttlHours);
  if (hit !== undefined) return hit;
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error(r.status);
  const value = await r.json();
  cacheSet(url, value);
  return value;
}

// ===================== Barevná témata =====================
function setTheme(id) {
  document.documentElement.dataset.theme = id;
  store.set("tema", id);
  document.querySelectorAll(".dot").forEach((d) => d.setAttribute("aria-pressed", String(d.dataset.theme === id)));
  const t = THEMES.find((x) => x[0] === id);
  document.querySelector('meta[name="theme-color"]').content = t ? t[2] : "#6d5dfc";
}
THEMES.forEach(([id, name, c1, c2]) => {
  const d = document.createElement("button");
  d.className = "dot";
  d.dataset.theme = id;
  d.title = name;
  d.setAttribute("aria-label", "Barevné téma " + name);
  d.style.background = `linear-gradient(135deg, ${c1}, ${c2})`;
  d.onclick = () => setTheme(id);
  $("themes").appendChild(d);
});
setTheme(store.get("tema", window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "noc" : "indigo"));
