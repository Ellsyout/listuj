// Čisté pomocné funkce – nepracují se stránkou ani se sítí, proto jdou testovat (viz tests/).

function plural(n, one, few, many) { return n === 1 ? one : n >= 2 && n <= 4 ? few : many; }

function initials(name) { return (name || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase(); }

function esc(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

function cleanDesc(s) {
  return s.split(/\n-{3,}|\(\[source\]|\[source\]/i)[0]
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\r/g, "").trim();
}

// popis, který není skutečný popis (např. „1 volume : 24 cm“), bereme jako žádný
function realDesc(work) {
  const raw = typeof work.description === "string" ? work.description : work.description?.value;
  if (!raw) return null;
  const text = cleanDesc(raw);
  return text.length < 60 || /^\s*\d+\s*(volume|v\.|p\.|pages)|\d+\s*cm/i.test(text) ? null : text;
}

// stejná kniha z obou databází: název (bez závorky) + příjmení autora, bez diakritiky
function normKey(title, author) {
  const t = String(title || "").split("(")[0].replace(/&/g, " a "); // „Harry Potter & kámen mudrců“ = „… a kámen mudrců“
  const a = String(author || "").split(", ")[0].trim().split(/\s+/).pop() || "";
  return (t + a).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// „Krvavá říše. 5. díl“, „Urla. 4“, „Oči prázdnoty. 2, Architekti světů“, „(… ze série X – 3. díl)“
function parseSeries(title) {
  const t = String(title || "");
  let m = t.match(/ze série (.+?)\s*[–-]\s*(\d+)\.\s*díl/i);
  if (m) return { name: m[1].trim(), num: m[2] };
  m = t.match(/^(.+?)\.\s*(?:díl|kniha|část|svazek)\s*(\d+)/i);
  if (m) return { name: m[1].trim(), num: m[2] };
  m = t.match(/^(.+?)[.,:]?\s+(\d+)\.?\s*(díl)?\s*(?:[,:–-]\s*.*)?$/i);
  if (m && m[1].length > 2 && !/^\d+$/.test(m[1])) return { name: m[1].replace(/[.:,\s]+$/, "").trim(), num: m[2] };
  m = t.match(/:\s*(.+?)\.?\s+(\d+)\.?$/);
  if (m) return { name: m[1].trim(), num: m[2] };
  return null;
}

function parseMood(text) {
  const t = " " + plain(text) + " ";
  const m = { include: [], exclude: [], labels: [], pages: null, period: null, lang: null, rest: "" };
  let left = t;
  for (const [re, subject, label] of MOODS) {
    const hit = left.match(re);
    if (!hit) continue;
    // „ne horor“, „bez romantiky“, „nechci nic smutného“ → vyloučit
    const before = left.slice(Math.max(0, hit.index - 16), hit.index);
    const neg = /(^|\s)(ne|bez|zadn\w*|nechci|ani|krome)\s+(\S+\s+)?\S*$/.test(before);
    const list = neg ? m.exclude : m.include;
    if (!list.includes(subject)) { list.push(subject); m.labels.push({ label, neg }); }
    left = left.replace(new RegExp("\\S*" + hit[0] + "\\S*"), " ");
  }
  if (/kratk|kratsi|na jeden vecer|jednohubk/.test(t)) { m.pages = [0, 250]; m.labels.push({ label: "krátká (do 250 stran)" }); }
  else if (/dlouh|tlust|obsahl|epick/.test(t)) { m.pages = [500, "*"]; m.labels.push({ label: "dlouhá (přes 500 stran)" }); }
  if (/(^|\s)(novink|nov[aeyou]\s|nejnovejs|letosn|cerstv|soucasn)/.test(t)) { m.period = "new"; m.labels.push({ label: "novinky" }); }
  if (/cesk|v cestine/.test(t)) { m.lang = "cze"; m.labels.push({ label: "v češtině" }); }
  else if (/anglick|v anglictine/.test(t)) { m.lang = "eng"; m.labels.push({ label: "v angličtině" }); }
  const STOP = /^(neco|nejak\w*|kniha|knihu|knihy|chci|chtel\w*|bych|mam|chut|na|ale|a|s|se|pro|od|do|ktery|ktera|ktere|precist|cist|dobr\w*|hezk\w*|nic|moc|hodne|trochu|nebo|kratk\w*|dlouh\w*|nov\w*|novink\w*|ceske|cesk\w*|pribeh|roman)$/;
  m.rest = left.split(/[\s,.;!?]+/).filter((w) => w.length > 2 && !STOP.test(w)).join(" ");
  return m;
}

function moodQuery(m) {
  const parts = m.include.filter(olSubject).map((s) => `subject:(${olSubject(s)})`)
    .concat(m.exclude.filter(olSubject).map((s) => `-subject:(${olSubject(s)})`));
  if (m.pages) parts.push(`number_of_pages_median:[${m.pages[0]} TO ${m.pages[1]}]`);
  if (!m.include.length) parts.unshift(m.rest || "subject:fiction"); // samotné „ne …“ potřebuje něco kladného
  return parts.join(" ");
}

// Open Library: „subject:(slova)“ hledá stejně jako parametr subject; null = Open Library tu kombinaci neumí
function olGenreQuery(list, mode) {
  const subjects = list.map(olSubject);
  if (mode === "all" && subjects.includes(null)) return null;
  const terms = subjects.filter(Boolean).map((x) => `subject:(${x})`);
  if (!terms.length) return list.length ? null : "";
  return mode === "all" ? terms.join(" ") : terms.length > 1 ? `(${terms.join(" OR ")})` : terms[0];
}

function kcAuthor(r) {
  const names = Object.keys(r.authors?.primary || {});
  const list = names.length ? names : Object.keys(r.authors?.secondary || {});
  return list.slice(0, 2).map((n) => n.replace(/,\s*[\d\s?.–-]*$/, "").replace(/,\s*$/, "").trim()).join(", ");
}

function kcDesc(r) {
  const text = (r?.summary || []).join("\n\n").trim();
  return text.length >= 40 ? text : null;
}

// katalog u autora najde i jmenovce („Alena …“) – necháme jen knihy, kde sedí příjmení
function sameAuthor(book, name) {
  const surname = plain(name).split(/\s+/).pop();
  return plain(book.author || "").includes(surname);
}

function bookHash(book) {
  if (book.key.startsWith("gb:")) return "kniha/gb/" + book.gbId;
  if (book.key.startsWith("kc:")) return "kniha/kc/" + encodeURIComponent(book.kcId);
  return "kniha" + book.key.replace("/works", "");
}

const plain = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const isoDate = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

const czDate = (t) => { const d = new Date(t); return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`; };

// knihy bez údaje o počtu stran filtrem neprojdou
const fitsLength = (book, r) => !r || (book.pages > 0 && book.pages >= r[0] && (r[1] === "*" || book.pages <= r[1]));

const seriesOrder = (a, b) => (a.num == null) - (b.num == null) || (+a.num || 0) - (+b.num || 0) || (a.year || 9999) - (b.year || 9999);

const kcSubjects = (r) => [...new Set((r?.subjects || []).map((x) => x[0]).filter(Boolean))];

const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
