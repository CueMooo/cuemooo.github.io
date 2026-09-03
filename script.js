// CueMoo's Games - loads games from games.json

let allGames = [];

document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((t) => t.classList.remove("active"));

    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
  });
});

async function loadGames() {
  try {
    const res = await fetch("games.json");
    if (!res.ok) throw new Error("Failed to load games.json");
    allGames = await res.json();
    populateCategories();
    renderGames(allGames);
  } catch (err) {
    console.error(err);
    document.getElementById("games-grid").innerHTML =
      `<p class="no-results">Could not load games.json. Make sure the file exists next to index.html.</p>`;
  }
}

function populateCategories() {
  const select = document.getElementById("category-filter");
  const categories = [...new Set(allGames.map((g) => g.category).filter(Boolean))].sort();

  categories.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  });
}

function isImagePath(value) {
  if (!value || typeof value !== "string") return false;
  const v = value.trim();
  if (
    v.startsWith("http://") ||
    v.startsWith("https://") ||
    v.startsWith("./") ||
    v.startsWith("/") ||
    v.startsWith("thumbs/")
  ) {
    return true;
  }
  return /\.(png|jpe?g|webp|gif|svg)$/i.test(v);
}

function initials(name) {
  const parts = String(name || "Game")
    .trim()
    .split(/\s+/)
    .slice(0, 2);
  return parts.map((p) => p[0]).join("").toUpperCase();
}

function renderGames(games) {
  const grid = document.getElementById("games-grid");
  const noResults = document.getElementById("no-results");

  grid.innerHTML = "";

  if (games.length === 0) {
    noResults.classList.remove("hidden");
    return;
  }

  noResults.classList.add("hidden");

  games.forEach((game) => {
    const card = document.createElement("article");
    card.className = "game-card";

    let thumbHTML;
    if (isImagePath(game.thumbnail)) {
      const src = game.thumbnail;
      thumbHTML = `<img src="${src}" alt="${escapeHTML(game.name)}" loading="lazy">`;
    } else {
      thumbHTML = `<span class="thumb-fallback">${escapeHTML(initials(game.name))}</span>`;
    }

    const sourceLink = game.source
      ? `<a class="source-link" href="${game.source}" target="_blank" rel="noopener">Source</a>`
      : "";

    card.innerHTML = `
      <div class="game-thumb">${thumbHTML}</div>
      <div class="game-body">
        <h3>${escapeHTML(game.name)}</h3>
        <p>${escapeHTML(game.description || "")}</p>
        <div class="game-meta">
          <span class="category-tag">${escapeHTML(game.category || "Uncategorized")}</span>
          ${sourceLink}
        </div>
        <a class="play-btn" href="${game.url}">Play</a>
      </div>
    `;

    grid.appendChild(card);
  });
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function applyFilters() {
  const query = document.getElementById("search").value.toLowerCase().trim();
  const category = document.getElementById("category-filter").value;

  const filtered = allGames.filter((game) => {
    const matchesSearch =
      !query ||
      game.name.toLowerCase().includes(query) ||
      (game.description || "").toLowerCase().includes(query) ||
      (game.category || "").toLowerCase().includes(query);

    const matchesCategory = category === "all" || game.category === category;

    return matchesSearch && matchesCategory;
  });

  renderGames(filtered);
}

document.getElementById("search").addEventListener("input", applyFilters);
document.getElementById("category-filter").addEventListener("change", applyFilters);

loadGames();
