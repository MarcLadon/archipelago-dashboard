const fileInput = document.querySelector("#spoiler-file");
const welcome = document.querySelector("#welcome");
const errorBox = document.querySelector("#error");
const dashboard = document.querySelector("#dashboard");
const playerFilter = document.querySelector("#player-filter");
const searchInput = document.querySelector("#search");
let model = null;

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    model = parseSpoiler(text);
    showDashboard(model);
  } catch (error) {
    showError(error.message || "Impossible de lire ce spoiler.");
  }
});

playerFilter.addEventListener("change", renderLocations);
searchInput.addEventListener("input", renderLocations);

loadPublishedSpoiler();

async function loadPublishedSpoiler() {
  try {
    const response = await fetch("./Spoiler.txt");
    if (!response.ok) throw new Error(`Le spoiler publié n’a pas pu être chargé (HTTP ${response.status}).`);
    model = parseSpoiler(await response.text());
    showDashboard(model);
  } catch (error) {
    showError(`${error.message} Vous pouvez aussi charger un fichier spoiler avec le bouton ci-dessus.`);
  }
}

function showDashboard(data) {
  renderDashboard(data);
  errorBox.hidden = true;
  welcome.hidden = true;
  dashboard.hidden = false;
}

function showError(message) {
  dashboard.hidden = true;
  welcome.hidden = true;
  errorBox.textContent = message;
  errorBox.hidden = false;
}

function parseSpoiler(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const players = [];
  const playersByName = new Map();
  let currentPlayer = null;
  let inLocations = false;
  let seed = "";
  let declaredTotal = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const seedMatch = line.match(/\bSeed:\s*(.+)$/);
    if (seedMatch) seed = seedMatch[1].trim();

    const totalMatch = line.match(/^Total Location Count:\s*(\d+)/);
    if (totalMatch) declaredTotal = Number(totalMatch[1]);

    const playerMatch = line.match(/^Player\s+\d+:\s*(.+)$/);
    if (playerMatch) {
      currentPlayer = {
        name: playerMatch[1].trim(),
        game: "Jeu non précisé",
        declaredCount: null,
        locations: []
      };
      players.push(currentPlayer);
      playersByName.set(currentPlayer.name, currentPlayer);
      inLocations = false;
      continue;
    }

    if (!currentPlayer) continue;

    const gameMatch = line.match(/^Game:\s*(.+)$/);
    if (gameMatch) currentPlayer.game = gameMatch[1].trim();

    const countMatch = line.match(/^Location Count:\s*(\d+)/);
    if (countMatch) currentPlayer.declaredCount = Number(countMatch[1]);

    if (/^Locations:\s*$/.test(line)) {
      inLocations = true;
      continue;
    }

    if (!inLocations) continue;

    const entry = parseLocation(line);
    if (!entry) continue;

    const owner = playersByName.get(entry.locationOwner);
    entry.player = owner?.name || entry.locationOwner || "Inconnu";
    entry.game = owner?.game || "Jeu inconnu";
    entry.locationCountOwner = Boolean(owner);

    if (owner) owner.locations.push(entry);
  }

  const locations = players.flatMap((player) => player.locations);

  if (!players.length) {
    throw new Error("Aucun joueur trouvé. Vérifiez que le fichier est bien un spoiler Archipelago.");
  }
  if (!locations.length) {
    throw new Error("Aucune section de locations détectée. Le fichier ne semble pas correspondre au format attendu.");
  }

  return { players, locations, seed, declaredTotal };
}

function parseLocation(line) {
  const separator = line.match(/^(.*):\s+(.+)$/);
  if (!separator) return null;

  const location = splitOwner(separator[1].trim());
  const item = splitOwner(separator[2].trim());

  if (!location.name || !item.name) return null;

  return {
    location: location.name,
    locationOwner: location.owner,
    item: item.name,
    itemOwner: item.owner
  };
}

function splitOwner(value) {
  const match = value.match(/^(.*)\s+\(([^()]*)\)$/);
  return match ? { name: match[1].trim(), owner: match[2].trim() } : { name: value, owner: "" };
}

function renderDashboard(data) {
  const total = data.declaredTotal ?? data.locations.length;

  document.querySelector("#summary").replaceChildren(
    metric("Joueurs", data.players.length),
    metric("Emplacements du spoiler", data.locations.length.toLocaleString("fr-FR")),
    metric("Emplacements annoncés", total.toLocaleString("fr-FR")),
    metric("Jeux", new Set(data.players.map((player) => player.game)).size)
  );

  document.querySelector("#seed-label").textContent = data.seed ? `Seed : ${data.seed}` : "";

  document.querySelector("#players").replaceChildren(
    ...data.players.map((player) => {
      const card = document.createElement("button");
      card.className = "player-card";
      card.type = "button";

      const number = document.createElement("span");
      number.className = "player-number";
      number.textContent = `${player.locations.length.toLocaleString("fr-FR")} emplacements`;

      const name = document.createElement("h3");
      name.textContent = player.name;

      const game = document.createElement("p");
      game.className = "muted";
      game.textContent = player.game;

      const track = document.createElement("span");
      track.className = "progress-track";
      const fill = document.createElement("span");
      const percent = player.declaredCount
        ? Math.min(100, (player.locations.length / player.declaredCount) * 100)
        : 0;
      fill.style.width = `${percent}%`;
      track.append(fill);

      const note = document.createElement("small");
      note.textContent = player.declaredCount
        ? `${player.locations.length} / ${player.declaredCount} emplacements décrits dans le spoiler`
        : "Nombre d’emplacements non indiqué";

      card.append(number, name, game, track, note);

      card.addEventListener("click", () => {
        playerFilter.value = player.name;
        renderLocations();
        document.querySelector("#locations").scrollIntoView({ behavior: "smooth", block: "start" });
      });

      return card;
    })
  );

  playerFilter.replaceChildren(
    new Option("Tous", ""),
    ...data.players.map((player) => new Option(player.name, player.name))
  );

  renderLocations();
}

function metric(label, value) {
  const card = document.createElement("article");
  card.className = "metric";
  const title = document.createElement("span");
  title.textContent = label;
  const number = document.createElement("strong");
  number.textContent = value;
  card.append(title, number);
  return card;
}

function renderLocations() {
  if (!model) return;

  const selected = playerFilter.value;
  const query = searchInput.value.trim().toLocaleLowerCase("fr-FR");

  const filtered = model.locations.filter((entry) => {
    if (selected && entry.player !== selected) return false;

    return `${entry.location} ${entry.item} ${entry.itemOwner} ${entry.player} ${entry.game}`
      .toLocaleLowerCase("fr-FR")
      .includes(query);
  });

  const body = document.querySelector("#locations");
  body.replaceChildren(
    ...filtered.map((entry) => {
      const row = document.createElement("tr");
      for (const value of [
        `${entry.player} · ${entry.game}`,
        entry.location,
        entry.item,
        entry.itemOwner || "—"
      ]) {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.append(cell);
      }
      return row;
    })
  );

  document.querySelector("#result-count").textContent =
    `${filtered.length.toLocaleString("fr-FR")} emplacement(s) affiché(s)`;
}
