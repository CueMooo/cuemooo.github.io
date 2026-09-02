const grid = document.getElementById("grid");
const search = document.getElementById("search");
const filtersEl = document.getElementById("filters");

let games = [];
let cat = "all";

async function load() {
  const res = await fetch("games.json");
  games = await res.json();
  const cats = ["all", ...new Set(games.map(g => g.category))];
  filtersEl.innerHTML = cats.map(c =>
    `<button class="chip ${c === "all" ? "on" : ""}" data-cat="${c}">${c}</button>`
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
  grid.innerHTML = list.length ? list.map(g => `
    <a class="card" href="${g.file}">
      <div class="emoji">${g.emoji}</div>
      <h3>${g.name}</h3>
      <p>${g.blurb}</p>
      <div class="meta"><span>${g.category}</span><span class="play">OPEN</span></div>
    </a>
  `).join("") : `<p class="empty">No lockers yet. Add a game to games.json.</p>`;
}

search.addEventListener("input", render);
load().catch(() => {
  grid.innerHTML = `<p class="empty">Couldn't load games.json. Use GitHub Pages, not a raw file.</p>`;
});
