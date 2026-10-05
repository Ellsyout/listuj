// ===================== Vykreslení =====================
function render() {
  const grid = $("grid");
  grid.innerHTML = "";
  let books;
  const diary = state.view === "diary", chartsView = state.view === "charts", listsView = state.view === "mylists";
  $("mylists").hidden = !listsView;
  $("diary").hidden = !diary;
  $("charts").hidden = !chartsView;
  grid.hidden = diary || chartsView || listsView;
  if (diary || chartsView || listsView) {
    $("more").hidden = $("gridHint").hidden = true;
    $("status").textContent = "";
    return diary ? renderDiary() : chartsView ? renderCharts() : renderMyLists();
  }

  if (state.view === "results") {
    books = state.books;
    $("status").textContent = state.total ? `Nalezeno ${state.total.toLocaleString("cs-CZ")} ${plural(state.total, "kniha", "knihy", "knih")}` : "";
    $("more").hidden = !(state.olMore || state.gbMore || state.kcMore);
    if (!state.books.length) {
      $("status").textContent = "";
      grid.innerHTML = `<div class="empty"><b>🔍</b>Nic jsme nenašli. Zkus jiný žánr, jazyk nebo období${fmt() ? ", nebo přepni formát na „Všechny knihy“" : ""}.</div>`;
    }
    updateAuthorInfo();
    // v češtině je nových knih v databázi málo – nabídneme novinky ze světa nebo starší knihy
    const lang = $("lang").value;
    const few = state.mode === "genre" && lang && $("period").value === "new" && state.total < LIMIT;
    $("gridHint").hidden = !few;
    if (few) {
      $("gridHint").innerHTML = `<div class="hint">Novinek <b>${langIn(lang)}</b> je zatím v databázi málo.
        <button class="linkbtn" id="hintAll">Ukázat novinky ze světa</button> nebo
        <button class="linkbtn" id="hintOld">starší knihy ${langIn(lang)}</button></div>`;
      $("hintAll").onclick = () => { $("lang").value = ""; search(); };
      $("hintOld").onclick = () => { $("period").value = ""; search(); };
    }
  } else {
    books = state.view === "rated"
      ? Object.values(myRatings).sort((a, b) => b.date - a.date).map((r) => r.book)
      : lists[state.view];
    $("more").hidden = true;
    $("gridHint").hidden = !books.length || state.view === "rated";
    $("status").textContent = books.length ? `${books.length} ${plural(books.length, "kniha", "knihy", "knih")}` : "";
    if (books.length && state.view !== "rated") {
      // seznam jde poslat jako odkaz
      const listName = { fav: "Moje oblíbené knihy", want: "Chci si přečíst" }[state.view] || "Můj seznam knih";
      $("gridHint").innerHTML = `<div class="hint list-share"><span>Pošli tenhle seznam komukoli – odkaz se otevře v každém prohlížeči, i v mobilu.</span><button class="btn ghost" id="shareListBtn" style="min-height:38px;padding:6px 14px">📤 Sdílet seznam</button></div>`;
      $("shareListBtn").onclick = () => shareList(listName, books);
    }
    if (!books.length) {
      const msg = state.view === "rated" ? "Zatím jsi nic nehodnotil/a. Otevři knihu, kterou jsi přečetl/a, a dej jí hvězdičky ⭐." : LISTS[state.view].empty;
      grid.innerHTML = `<div class="empty"><b>${state.view === "rated" ? "⭐" : LISTS[state.view].icon}</b>${msg}</div>`;
    }
  }
  books.forEach((book) => grid.appendChild(card(book)));
}

function coverHtml(book, size = "M") {
  if (book.cover) return `<img loading="lazy" alt="" src="https://covers.openlibrary.org/b/id/${book.cover}-${size}.jpg">`;
  if (book.coverUrl) return `<img loading="lazy" alt="" src="${esc(book.coverUrl)}" data-t="${esc(book.title)}" data-a="${esc(book.author || "")}" onload="fixCover(this)" onerror="fixCover(this, true)">`;
  return placeholderHtml(book.title, book.author);
}

// barevná náhradní obálka podle názvu
function placeholderHtml(title, author) {
  const h = [...String(title)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
  return `<div class="ph" style="background:linear-gradient(160deg,hsl(${h} 70% 55%),hsl(${(h + 50) % 360} 75% 38%))">${esc(title)}<small>${esc(author || "")}</small></div>`;
}

// knihovny vrací místo chybějící obálky malý obrázek 65×80 – nahradíme ho vlastní obálkou
function fixCover(img, failed = false) {
  if (!failed && img.naturalWidth > 70) return;
  const box = document.createElement("div");
  box.innerHTML = placeholderHtml(img.dataset.t || "", img.dataset.a);
  img.replaceWith(box.firstElementChild);
}

function card(book) {
  const el = document.createElement("div");
  el.className = "card";
  el.tabIndex = 0;
  el.setAttribute("role", "link");
  const mine = myRatings[book.key];
  el.innerHTML = `
    <div class="cover">${coverHtml(book)}
      <div class="quick">
        ${Object.entries(LISTS).filter(([, l]) => l.quick).map(([id, l]) =>
          `<button class="qbtn ${inList(id, book.key) ? "on" : ""}" data-list="${id}" aria-label="${l.add}" title="${l.add}">${l.icon}</button>`).join("")}
      </div>
      ${mine ? `<span class="mine">Tvoje ★ ${mine.stars}</span>` : ""}
      ${book.ebookAvail || book.audioAvail ? `<span class="ebadge" title="Existuje i jako ${[book.ebookAvail && "e-kniha", book.audioAvail && "audiokniha"].filter(Boolean).join(" a ")}">${[book.ebookAvail && "📱 e-kniha", book.audioAvail && "🎧 audio"].filter(Boolean).join(" · ")}</span>` : ""}
    </div>
    <h3>${esc(book.title)}</h3>
    <p class="author">${esc(book.author || "Neznámý autor")}</p>
    <div class="small">${book.year ? `<span>${book.year}</span>` : ""}${book.rating ? `<span><span class="star">★</span> ${book.rating.toFixed(1)}</span>` : ""}</div>`;
  el.querySelectorAll(".qbtn").forEach((btn) => (btn.onclick = (e) => {
    e.stopPropagation();
    toggleList(btn.dataset.list, book);
    btn.classList.toggle("on", inList(btn.dataset.list, book.key));
    if (state.view === btn.dataset.list) render();
  }));
  const open = () => { cache.set(book.key, book); state.fromApp = true; location.hash = bookHash(book); };
  el.onclick = open;
  el.onkeydown = (e) => { if (e.key === "Enter") open(); };
  return el;
}


function skeletons(n) {
  return Array.from({ length: n }, () => `<div class="card skeleton"><div class="cover"></div><div class="line"></div><div class="line"></div></div>`).join("");
}
