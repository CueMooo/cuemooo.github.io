const grid = document.getElementById("grid");
const search = document.getElementById("search");
const filtersEl = document.getElementById("filters");

let games = [];
let cat = "all";

function label(c) {
  if (c === "all") return "all games";
  if (c === "arcade") return "games";
  return c;
}

async function load() {
  const res = await fetch("games.json");
  games = await res.json();
  const cats = ["all", ...new Set(games.map(g => g.category))];
  filtersEl.innerHTML = cats.map(c =>
    `<button class="chip ${c === "all" ? "on" : ""}" data-cat="${c}">${label(c)}</button>`
  ).join("");
  filtersEl.addEventListener("click", e => {
    const btn = e.target.closest("[data-cat]");
    if (!btn) return;
    cat = btn.dataset.cat;
    [...filtersEl.children].forEach(b => b.classList.toggle("on", b === btn));
    render();
  });
  render();
}

function render() {
  const q = (search.value || "").toLowerCase();
  const list = games.filter(g =>
    (cat === "all" || g.category === cat) &&
    (`${g.name} ${g.blurb} ${g.category}`).toLowerCase().includes(q)
  );
  grid.innerHTML = list.length ? list.map((g, i) => `
    <a class="card" href="${g.file}">
      <div class="num">DOOR ${String(i + 1).padStart(2, "0")}</div>
      <div class="emoji">${g.emoji}</div>
      <h3>${g.name}</h3>
      <p>${g.blurb}</p>
      <div class="meta"><span>${label(g.category)}</span><span class="play">OPEN</span></div>
    </a>
  `).join("") : `<p class="empty">${games.length ? "Nothing matches." : "This locker is empty."}</p>`;
}

search.addEventListener("input", render);
load().catch(() => {
  grid.innerHTML = `<p class="empty">This locker is empty.</p>`;
});
