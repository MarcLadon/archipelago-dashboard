const fileInput = document.querySelector("#spoiler-file");
const welcome = document.querySelector("#welcome");
const errorBox = document.querySelector("#error");
const dashboard = document.querySelector("#dashboard");
const playerFilter = document.querySelector("#player-filter");
const checkFilter = document.querySelector("#check-filter");
const searchInput = document.querySelector("#search");
const connectionForm = document.querySelector("#connection-form");
const serverUrlInput = document.querySelector("#server-url");
const passwordInput = document.querySelector("#server-password");
const mappingsContainer = document.querySelector("#slot-mappings");
const connectButton = document.querySelector("#connect-button");
const disconnectButton = document.querySelector("#disconnect-button");
const liveStatus = document.querySelector("#live-status");

let model = null;
let trackingGeneration = 0;
let live = createEmptyTracking();
let slotOverrides = new Map();

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;

  try {
    const nextModel = parseSpoiler(await file.text());
    disconnectLiveTracking(false);
    model = nextModel;
    slotOverrides = new Map();
    renderSlotMappings();
    showDashboard(model);
  } catch (error) {
    showError(error.message || "Impossible de lire ce spoiler.");
  }
});

playerFilter.addEventListener("change", renderLocations);
checkFilter.addEventListener("change", renderLocations);
searchInput.addEventListener("input", renderLocations);
connectionForm.addEventListener("submit", startLiveTracking);
disconnectButton.addEventListener("click", () => disconnectLiveTracking(true));

loadPublishedSpoiler();

async function loadPublishedSpoiler() {
  try {
    const response = await fetch("./Spoiler.txt");
    if (!response.ok) throw new Error(`Le spoiler publié n’a pas pu être chargé (HTTP ${response.status}).`);
    model = parseSpoiler(await response.text());
    renderSlotMappings();
    showDashboard(model);
  } catch (error) {
    showError(`${error.message} Vous pouvez aussi charger un fichier spoiler avec le bouton ci-dessus.`);
  }
}

function createEmptyTracking() {
  return {
    active: false,
    sockets: [],
    checkedByPlayer: new Map(),
    connectedPlayers: new Set(),
    failedPlayers: new Map()
  };
}

function renderSlotMappings() {
  if (!mappingsContainer || !model) return;
  mappingsContainer.replaceChildren(...model.players.map((player, index) => {
    const label = document.createElement("label");
    label.textContent = `${player.name} · ${player.game}`;
    const input = document.createElement("input");
    input.type = "text";
    input.autocomplete = "off";
    input.placeholder = player.name;
    input.value = slotOverrides.get(player.name) || "";
    input.dataset.playerName = player.name;
    input.setAttribute("aria-label", `Nom du slot Archipelago pour ${player.name}`);
    input.addEventListener("input", () => {
      const value = input.value.trim();
      if (value) slotOverrides.set(player.name, value);
      else slotOverrides.delete(player.name);
    });
    label.append(input);
    return label;
  }));
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
  if (!players.length) throw new Error("Aucun joueur trouvé. Vérifiez que le fichier est bien un spoiler Archipelago.");
  if (!locations.length) throw new Error("Aucune section de locations détectée. Le fichier ne semble pas correspondre au format attendu.");
  return { players, locations, seed, declaredTotal };
}

function parseLocation(line) {
  const separator = line.match(/^(.*):\s+(.+)$/);
  if (!separator) return null;
  const location = splitOwner(separator[1].trim());
  const item = splitOwner(separator[2].trim());
  if (!location.name || !item.name) return null;
  return { location: location.name, locationOwner: location.owner, item: item.name, itemOwner: item.owner, locationId: null };
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
    metric("Jeux", new Set(data.players.map((player) => player.game)).size),
    metric("Checks accomplis", live.active ? getKnownCheckedCount().toLocaleString("fr-FR") : "—")
  );
  document.querySelector("#seed-label").textContent = data.seed ? `Seed : ${data.seed}` : "";
  document.querySelector("#players").replaceChildren(...data.players.map((player) => {
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
    const checked = live.checkedByPlayer.get(player.name)?.size ?? 0;
    const percent = live.active && player.locations.length
      ? Math.min(100, checked / player.locations.length * 100)
      : player.declaredCount ? Math.min(100, player.locations.length / player.declaredCount * 100) : 0;
    fill.style.width = `${percent}%`;
    if (live.active) fill.classList.add("live-fill");
    track.append(fill);
    const note = document.createElement("small");
    const failure = live.failedPlayers.get(player.name);
    note.textContent = live.active
      ? `${checked} / ${player.locations.length} check(s) accomplis${failure ? ` · ${failure}` : live.connectedPlayers.has(player.name) ? "" : " · connexion en cours"}`
      : player.declaredCount ? `${player.locations.length} / ${player.declaredCount} emplacements décrits dans le spoiler` : "Nombre d’emplacements non indiqué";
    card.append(number, name, game, track, note);
    card.addEventListener("click", () => {
      playerFilter.value = player.name;
      renderLocations();
      document.querySelector("#locations").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return card;
  }));
  playerFilter.replaceChildren(new Option("Tous", ""), ...data.players.map((player) => new Option(player.name, player.name)));
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

function getKnownCheckedCount() {
  let count = 0;
  for (const checked of live.checkedByPlayer.values()) count += checked.size;
  return count;
}

function getCheckState(entry) {
  if (!live.active || !live.connectedPlayers.has(entry.player) || !Number.isInteger(entry.locationId)) return "unknown";
  return live.checkedByPlayer.get(entry.player)?.has(entry.locationId) ? "checked" : "unchecked";
}

function renderLocations() {
  if (!model) return;
  const selected = playerFilter.value;
  const stateFilter = checkFilter.value;
  const query = searchInput.value.trim().toLocaleLowerCase("fr-FR");
  const filtered = model.locations.filter((entry) => {
    if (selected && entry.player !== selected) return false;
    const state = getCheckState(entry);
    if (stateFilter === "checked" && state !== "checked") return false;
    if (stateFilter === "unchecked" && state !== "unchecked") return false;
    return `${entry.location} ${entry.item} ${entry.itemOwner} ${entry.player} ${entry.game}`.toLocaleLowerCase("fr-FR").includes(query);
  });
  const body = document.querySelector("#locations");
  body.replaceChildren(...filtered.map((entry) => {
    const row = document.createElement("tr");
    const state = getCheckState(entry);
    const stateText = state === "checked" ? "Accompli" : state === "unchecked" ? "À faire" : live.active ? "Indisponible" : "Non connecté";
    const values = [`${entry.player} · ${entry.game}`, entry.location, stateText, entry.item, entry.itemOwner || "—"];
    values.forEach((value, index) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      if (index === 2) cell.className = `check-state ${state}`;
      row.append(cell);
    });
    if (state === "checked") row.classList.add("checked-row");
    return row;
  }));
  document.querySelector("#result-count").textContent = `${filtered.length.toLocaleString("fr-FR")} emplacement(s) affiché(s)`;
}

function setStatus(message, state) {
  liveStatus.textContent = message;
  liveStatus.className = `live-status ${state}`;
}

async function startLiveTracking(event) {
  event.preventDefault();
  if (!model || live.active) return;

  let url;
  try {
    url = new URL(serverUrlInput.value.trim());
  } catch {
    setStatus("Adresse du serveur invalide.", "error");
    return;
  }
  const localWs = url.protocol === "ws:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "wss:" && !localWs) {
    setStatus("Utilisez une adresse wss:// (ws:// uniquement sur localhost).", "error");
    return;
  }

  for (const player of model.players) {
    const slot = slotOverrides.get(player.name) || player.name;
    if (!slot) {
      setStatus(`Nom de slot manquant pour ${player.name}.`, "error");
      return;
    }
  }

  const generation = ++trackingGeneration;
  live = createEmptyTracking();
  live.active = true;
  live.checkedByPlayer = new Map(model.players.map((player) => [player.name, new Set()]));
  connectButton.disabled = true;
  disconnectButton.disabled = false;
  serverUrlInput.disabled = true;
  passwordInput.disabled = true;
  mappingsContainer.querySelectorAll("input").forEach((input) => { input.disabled = true; });
  setStatus(`Connexion à ${model.players.length} slot(s)…`, "connecting");
  renderDashboard(model);

  const password = passwordInput.value || null;
  for (const player of model.players) connectPlayer(player, url.toString(), password, generation);
  passwordInput.value = "";
}

function connectPlayer(player, address, password, generation) {
  let socket;
  try {
    socket = new WebSocket(address);
  } catch (error) {
    failPlayer(player, error.message || "URL WebSocket invalide.", generation);
    return;
  }
  const record = { player, socket, phase: "room", version: { major: 0, minor: 6, build: 0 }, timeout: null };
  live.sockets.push(record);
  record.timeout = window.setTimeout(() => failPlayer(player, "Délai de connexion dépassé.", generation), 15000);

  socket.addEventListener("message", (event) => {
    if (generation !== trackingGeneration) return;
    let packets;
    try { packets = JSON.parse(event.data); }
    catch { failPlayer(player, "Réponse WebSocket illisible.", generation); return; }
    if (!Array.isArray(packets)) packets = [packets];
    for (const packet of packets) handleServerPacket(packet, record, password, generation);
  });
  socket.addEventListener("error", () => {
    if (generation === trackingGeneration && !live.connectedPlayers.has(player.name)) failPlayer(player, "WebSocket inaccessible : vérifiez adresse, TLS et réseau.", generation);
  });
  socket.addEventListener("close", () => {
    window.clearTimeout(record.timeout);
    if (generation !== trackingGeneration) return;
    if (live.connectedPlayers.has(player.name)) {
      live.connectedPlayers.delete(player.name);
      live.failedPlayers.set(player.name, "Connexion interrompue.");
      refreshTrackingView(generation);
    } else if (!live.failedPlayers.has(player.name)) {
      failPlayer(player, "Connexion fermée avant l’authentification.", generation);
    }
  });
}

function handleServerPacket(packet, record, password, generation) {
  if (!packet || typeof packet.cmd !== "string") return;
  const { player } = record;
  if (packet.cmd === "RoomInfo" && record.phase === "room") {
    if (Array.isArray(packet.games) && !packet.games.includes(player.game)) {
      failPlayer(player, `Jeu absent de la salle : ${player.game}.`, generation);
      return;
    }
    if (packet.version) record.version = packet.version;
    record.phase = "package";
    record.socket.send(JSON.stringify([{ cmd: "GetDataPackage", games: [player.game] }]));
    return;
  }
  if (packet.cmd === "DataPackage" && record.phase === "package") {
    const gameData = packet.data?.games?.[player.game];
    if (!gameData?.location_name_to_id) {
      failPlayer(player, `Data Package sans locations pour ${player.game}.`, generation);
      return;
    }
    const ids = new Map(Object.entries(gameData.location_name_to_id).map(([name, id]) => [name, Number(id)]));
    let mapped = 0;
    for (const entry of player.locations) {
      entry.locationId = ids.has(entry.location) ? ids.get(entry.location) : null;
      if (entry.locationId !== null) mapped += 1;
    }
    if (!mapped) {
      failPlayer(player, `Aucun emplacement du spoiler ne correspond au Data Package de ${player.game}.`, generation);
      return;
    }
    record.phase = "connect";
    const version = record.version;
    record.socket.send(JSON.stringify([{
      cmd: "Connect",
      game: player.game,
      name: slotOverrides.get(player.name) || player.name,
      password,
      uuid: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      version: { class: "Version", major: version.major, minor: version.minor, build: version.build },
      items_handling: 0,
      tags: ["Tracker", "NoText"],
      slot_data: false
    }]));
    return;
  }
  if (packet.cmd === "ConnectionRefused") {
    failPlayer(player, `Connexion refusée (${(packet.errors || ["erreur inconnue"]).join(", ")}). Vérifiez le slot, le jeu et le mot de passe.`, generation);
    return;
  }
  if (packet.cmd === "Connected") {
    window.clearTimeout(record.timeout);
    record.phase = "connected";
    live.connectedPlayers.add(player.name);
    live.failedPlayers.delete(player.name);
    mergeChecked(player, packet.checked_locations || []);
    const unmapped = player.locations.filter((entry) => entry.locationId === null).length;
    if (unmapped) live.failedPlayers.set(player.name, `${unmapped} emplacement(s) non associé(s)`);
    refreshTrackingView(generation);
    return;
  }
  if (packet.cmd === "RoomUpdate" && record.phase === "connected" && Array.isArray(packet.checked_locations)) {
    mergeChecked(player, packet.checked_locations);
    refreshTrackingView(generation);
  }
}

function mergeChecked(player, locationIds) {
  const checked = live.checkedByPlayer.get(player.name) || new Set();
  for (const id of locationIds) if (Number.isInteger(Number(id))) checked.add(Number(id));
  live.checkedByPlayer.set(player.name, checked);
}

function failPlayer(player, message, generation) {
  if (generation !== trackingGeneration || live.failedPlayers.has(player.name)) return;
  live.failedPlayers.set(player.name, message);
  const record = live.sockets.find((item) => item.player.name === player.name);
  if (record) {
    window.clearTimeout(record.timeout);
    if (record.socket.readyState < WebSocket.CLOSING) record.socket.close();
  }
  refreshTrackingView(generation);
}

function refreshTrackingView(generation) {
  if (generation !== trackingGeneration || !model) return;
  const connected = live.connectedPlayers.size;
  const failed = live.failedPlayers.size;
  if (connected === model.players.length && !failed) setStatus(`Connecté · ${connected}/${model.players.length} joueur(s)`, "connected");
  else if (connected) setStatus(`Suivi partiel · ${connected}/${model.players.length} connecté(s) · ${failed} erreur(s)`, "connecting");
  else if (failed === model.players.length) setStatus(`Échec : ${live.failedPlayers.values().next().value}`, "error");
  else setStatus(`Connexion… ${connected}/${model.players.length}`, "connecting");
  renderDashboard(model);
}

function disconnectLiveTracking(showMessage) {
  trackingGeneration += 1;
  for (const record of live.sockets) {
    window.clearTimeout(record.timeout);
    if (record.socket.readyState < WebSocket.CLOSING) record.socket.close();
  }
  live = createEmptyTracking();
  if (connectButton) connectButton.disabled = false;
  if (disconnectButton) disconnectButton.disabled = true;
  if (serverUrlInput) serverUrlInput.disabled = false;
  if (passwordInput) passwordInput.disabled = false;
  if (mappingsContainer) mappingsContainer.querySelectorAll("input").forEach((input) => { input.disabled = false; });
  if (liveStatus) setStatus(showMessage ? "Déconnecté" : "Non connecté", "idle");
  if (model) renderDashboard(model);
}

window.addEventListener("beforeunload", () => {
  for (const record of live.sockets) record.socket.close();
});
