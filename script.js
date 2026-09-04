const THEMES = [
  { id: "rose-pink", name: "Rose Pink", color: "#e56b92" },
  { id: "hot-pink", name: "Hot Pink", color: "#ff4da6" },
  { id: "red", name: "Red", color: "#ff3b3b" },
  { id: "orange", name: "Orange", color: "#ff7a1a" },
  { id: "yellow", name: "Yellow", color: "#f5c518" },
  { id: "green", name: "Green", color: "#22c55e" },
  { id: "blue", name: "Blue", color: "#3b82f6" },
  { id: "purple", name: "Purple", color: "#a855f7" }
];

const DEFAULTS = {
  theme: "rose-pink",
  card: "compact",
  desc: true,
  newtab: false,
  motion: false
};

let allGames = [];
let settings = loadSettings();

document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((t) => t.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
  });
});

function loadSettings() {
  try {
    const saved = { ...DEFAULTS, ...JSON.parse(localStorage.getItem("cuemoo-settings") || "{}") };
    if (saved.theme === "soft-pink") saved.theme = "rose-pink";
    if (!THEMES.some((t) => t.id === saved.theme)) saved.theme = DEFAULTS.theme;
    return saved;
  } catch (e) {
    return { ...DEFAULTS };
  }
}

function saveSettings() {
  localStorage.setItem("cuemoo-settings", JSON.stringify(settings));
}

function applySettings() {
  document.documentElement.setAttribute("data-theme", settings.theme);
  document.documentElement.setAttribute("data-card", settings.card);
  document.documentElement.setAttribute("data-desc", settings.desc ? "on" : "off");
  document.documentElement.setAttribute("data-motion", settings.motion ? "off" : "on");
  saveSettings();
  if (allGames.length) renderGames(currentFiltered());
}

function renderThemes() {
  const grid = document.getElementById("theme-grid");
  grid.innerHTML = "";
  THEMES.forEach((theme) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "theme-btn" + (settings.theme === theme.id ? " active" : "");
    const circle = document.createElement("span");
    circle.className = "theme-circle";
    circle.style.background = "linear-gradient(90deg, " + theme.color + " 50%, #000 50%)";
    const label = document.createElement("span");
    label.textContent = theme.name;
    btn.appendChild(circle);
    btn.appendChild(label);
    btn.addEventListener("click", function () {
      settings.theme = theme.id;
      applySettings();
      renderThemes();
    });
    grid.appendChild(btn);
  });
}

function wireSettings() {
  document.querySelectorAll("#card-size .chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.size === settings.card);
    chip.addEventListener("click", () => {
      settings.card = chip.dataset.size;
      document.querySelectorAll("#card-size .chip").forEach((c) => {
        c.classList.toggle("active", c.dataset.size === settings.card);
      });
      applySettings();
    });
  });

  const desc = document.getElementById("toggle-desc");
  const newtab = document.getElementById("toggle-newtab");
  const motion = document.getElementById("toggle-motion");

  desc.checked = settings.desc;
  newtab.checked = settings.newtab;
  motion.checked = settings.motion;

  desc.addEventListener("change", () => {
    settings.desc = desc.checked;
    applySettings();
  });
  newtab.addEventListener("change", () => {
    settings.newtab = newtab.checked;
    applySettings();
  });
  motion.addEventListener("change", () => {
    settings.motion = motion.checked;
    applySettings();
  });

  document.getElementById("reset-settings").addEventListener("click", () => {
    settings = { ...DEFAULTS };
    desc.checked = settings.desc;
    newtab.checked = settings.newtab;
    motion.checked = settings.motion;
    document.querySelectorAll("#card-size .chip").forEach((c) => {
      c.classList.toggle("active", c.dataset.size === settings.card);
    });
    applySettings();
    renderThemes();
  });
}

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
      '<p class="no-results">Could not load games.json. Make sure the file exists next to index.html.</p>';
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
  const parts = String(name || "Game").trim().split(/\s+/).slice(0, 2);
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
      thumbHTML = '<img src="' + game.thumbnail + '" alt="' + escapeHTML(game.name) + '" loading="lazy">';
    } else {
      thumbHTML = '<span class="thumb-fallback">' + escapeHTML(initials(game.name)) + "</span>";
    }

    const sourceLink = game.source
      ? '<a class="source-link" href="' + game.source + '" target="_blank" rel="noopener">Source</a>'
      : "";

    const target = settings.newtab ? ' target="_blank" rel="noopener"' : "";

    card.innerHTML =
      '<div class="game-thumb">' + thumbHTML + "</div>" +
      '<div class="game-body">' +
        "<h3>" + escapeHTML(game.name) + "</h3>" +
        "<p>" + escapeHTML(game.description || "") + "</p>" +
        '<div class="game-meta">' +
          '<span class="category-tag">' + escapeHTML(game.category || "Misc") + "</span>" +
          sourceLink +
        "</div>" +
        '<a class="play-btn" href="' + game.url + '"' + target + ">Play</a>" +
      "</div>";

    grid.appendChild(card);
  });
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function currentFiltered() {
  const query = document.getElementById("search").value.toLowerCase().trim();
  const category = document.getElementById("category-filter").value;
  return allGames.filter((game) => {
    const matchesSearch =
      !query ||
      game.name.toLowerCase().includes(query) ||
      (game.description || "").toLowerCase().includes(query) ||
      (game.category || "").toLowerCase().includes(query);
    const matchesCategory = category === "all" || game.category === category;
    return matchesSearch && matchesCategory;
  });
}

function applyFilters() {
  renderGames(currentFiltered());
}

document.getElementById("search").addEventListener("input", applyFilters);
document.getElementById("category-filter").addEventListener("change", applyFilters);

applySettings();
renderThemes();
wireSettings();
loadGames();
