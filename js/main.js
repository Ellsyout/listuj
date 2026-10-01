// ===================== Pomocné =====================
function gbDesc(vol) {
  const html = vol?.volumeInfo?.description;
  if (!html) return null;
  const doc = new DOMParser().parseFromString(html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n"), "text/html");
  const text = doc.body.textContent.replace(/\n{3,}/g, "\n\n").trim();
  return text.length >= 60 ? text : null;
}

function route() {
  const about = location.hash.match(/^#(o-aplikaci|napis-nam)$/);
  if (about) return openAbout(about[1] === "napis-nam");
  closeAbout();
  const seriesId = location.hash.match(/^#serie\/(.+)$/);
  if (seriesId) return openSeries(decodeURIComponent(seriesId[1]));
  closeSeries();
  const book = location.hash.match(/^#kniha\/(OL\w+W)$/);
  const gbook = location.hash.match(/^#kniha\/gb\/([\w-]+)$/);
  const kbook = location.hash.match(/^#kniha\/kc\/(.+)$/);
  const findTitle = location.hash.match(/^#najit\/([^/]+)\/(.*)$/);
  if (findTitle) return openByTitle(decodeURIComponent(findTitle[1]), decodeURIComponent(findTitle[2]));
  const author = location.hash.match(/^#autor\/(OL\w+A)$/);
  const authorName = location.hash.match(/^#autor-jmeno\/(.+)$/);
  if (book) return openBook(book[1]);
  if (gbook) return openBook(gbook[1], "gb");
  if (kbook) return openBook(decodeURIComponent(kbook[1]), "kc");
  closeBook();
  if (author) loadAuthor(author[1]);
  else if (authorName) {
    const name = decodeURIComponent(authorName[1]);
    if (state.author?.name !== name || state.author.key) {  // jinak je už načtený
      setMode("author");
      $("q").value = name;
      state.author = null;
      findAuthor(true);
    }
  }
  else if (state.mode === "author" && state.author) { setMode("genre"); state.searched = false; search(); }
}

$("search").onclick = () => { if (state.mode === "author") { state.author = null; findAuthor(); } else search(); };
$("surprise").onclick = surprise;
$("top").onclick = () => { $("sort").value = "rating"; search(); };
$("more").onclick = () => { state.page++; search({ append: true }); };
// další knihy se načtou samy, když se tlačítko „Načíst další“ blíží k okraji obrazovky
function autoMore() {
  const more = $("more");
  if (more.hidden || state.view !== "results" || $("status").textContent.startsWith("Hled") || !$("book").hidden || !$("seriesPage").hidden || !$("about").hidden) return;
  if (more.getBoundingClientRect().top < innerHeight + 600) more.click();
}
let autoMoreTimer = null;
addEventListener("scroll", () => { clearTimeout(autoMoreTimer); autoMoreTimer = setTimeout(autoMore, 150); }, { passive: true });
$("q").onkeydown = (e) => { if (e.key === "Enter") { e.target.blur(); $("search").click(); } };
$("logo").onclick = (e) => { e.preventDefault(); location.hash = ""; setMode("genre"); window.scrollTo({ top: 0, behavior: "smooth" }); };
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || $("lucky").open) return;
  if (!$("book").hidden) $("back").click();
  else if (!$("seriesPage").hidden) $("sBack")?.click();
  else if (!$("about").hidden) $("aBack")?.click();
});
$("footAbout").onclick = $("footFb").onclick = () => { state.fromApp = true; };
$("footBackup").onclick = goToBackup;
$("footFbWrap").hidden = !FEEDBACK_ENDPOINT;
window.addEventListener("hashchange", () => { route(); });

renderTabs();
if (!location.hash.startsWith("#autor")) search();
loadBirthdays();
loadForYou();
loadFollowed();
renderRecent();
route();
maybeWelcome();
