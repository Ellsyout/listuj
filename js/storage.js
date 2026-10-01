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
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}
function slim(b) { // ukládáme jen to, co je potřeba pro kartičku
  const { key, title, original, author, authorKeys, year, cover, coverUrl, gbId, kcId, kcEbookId, kcAudioId, rating, ratings, editions, pages, ebook, ebookAvail, audioAvail, ia, libs } = b;
  return { key, title, original, author, authorKeys, year, cover, coverUrl, gbId, kcId, kcEbookId, kcAudioId, rating, ratings, editions, pages, ebook, ebookAvail, audioAvail, ia, libs };
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
