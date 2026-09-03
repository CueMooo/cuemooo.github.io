// Game Hub - loads games from games.json

let allGames = [];

// Tab switching
document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((t) => t.classList.remove("active"));

    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
  });
});

// Load games
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

    // Thumbnail: use image if provided, otherwise emoji/fallback
    let thumbHTML;
    if (game.thumbnail && (game.thumbnail.startsWith("http") || game.thumbnail.startsWith("./") || game.thumbnail.startsWith("/"))) {
      thumbHTML = `<img src="${game.thumbnail}" alt="${game.name}" loading="lazy">`;
    } else {
      const emoji = game.thumbnail || "🎮";
      thumbHTML = emoji;
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
          <span class="category-tag">${escapeHTML(game.category || "Other")}</span>
          ${sourceLink}
        </div>
        <a class="play-btn" href="${game.url}">
          Play →
        </a>
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

// Search + filter
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

// Init
loadGames();
