const RISK_COLOR = {
  normal: "#1B7FBF",
  watch: "#E8A33D",
  warning: "#E4572E",
  critical: "#C1272D",
};

let selectedCell = 37;
let isRunning = true;
let packGridBuilt = false;

const el = (id) => document.getElementById(id);

async function postControl(body) {
  await fetch("/api/control", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function loadScenarios() {
  const res = await fetch("/api/scenarios");
  const scenarios = await res.json();
  const select = el("scenarioSelect");
  select.innerHTML = "";
  for (const [key, s] of Object.entries(scenarios)) {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = `${s.name}`;
    opt.title = s.description;
    select.appendChild(opt);
  }
}

function buildPackGrid(cells) {
  const grid = el("packGrid");
  grid.innerHTML = "";
  for (const c of cells) {
    const tile = document.createElement("div");
    tile.className = "cell-tile";
    tile.id = `tile-${c.cell_id}`;
    tile.textContent = c.cell_id;
    tile.title = `Cell ${c.cell_id}`;
    if (c.cell_id === 37) tile.classList.add("degraded-target");
    tile.addEventListener("click", () => {
      selectedCell = c.cell_id;
      document.querySelectorAll(".cell-tile").forEach((t) => t.classList.remove("selected"));
      tile.classList.add("selected");
      el("selectedCellId").textContent = selectedCell;
      refreshHistory();
    });
    grid.appendChild(tile);
  }
  packGridBuilt = true;
}

function updatePackGrid(cells) {
  for (const c of cells) {
    const tile = el(`tile-${c.cell_id}`);
    if (!tile) continue;
    tile.style.background = RISK_COLOR[c.risk] || RISK_COLOR.normal;
    if (c.cell_id === selectedCell) tile.classList.add("selected");
  }
}

function updateStatusStrip(snap) {
  el("simTime").textContent = `${snap.sim_time.toFixed(1)} s`;
  el("cycleCount").textContent = snap.cycle_count;
  el("scenarioName").textContent = snap.scenario_name;
  el("medianT").textContent = `${snap.median_T.toFixed(1)} °C`;
  el("interventionBadgeWrap").hidden = !snap.intervention_active;
}

function updateCellMeta(cells) {
  const c = cells.find((x) => x.cell_id === selectedCell);
  if (!c) return;
  el("cellMeta").innerHTML = `
    <span>Risk: <b style="color:${RISK_COLOR[c.risk]}">${c.risk.toUpperCase()}</b></span>
    <span>Degradation: <b>${(c.degradation * 100).toFixed(1)}%</b></span>
    <span>Effective C-rate: <b>${c.eff_c_rate}C</b></span>
    <span>T: <b>${c.T_C.toFixed(1)}°C</b></span>
    <span>&sigma;<sub>r</sub>: <b>${c.sigma_r_MPa.toFixed(1)} MPa</b></span>
    <span>&sigma;<sub>&theta;</sub>: <b>${c.sigma_t_MPa.toFixed(1)} MPa</b></span>
  `;
}

function updateRanking(ranking, cells) {
  const tbody = document.querySelector("#rankTable tbody");
  tbody.innerHTML = "";
  ranking.forEach((r, i) => {
    const cell = cells.find((c) => c.cell_id === r.cell_id);
    const risk = cell ? cell.risk : "normal";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>Cell ${r.cell_id}</td>
      <td>${r.deviation_C >= 0 ? "+" : ""}${r.deviation_C.toFixed(2)} °C</td>
      <td><span class="risk-badge" style="background:${RISK_COLOR[risk]}">${risk}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function updateEvents(events) {
  const log = el("eventLog");
  log.innerHTML = "";
  for (const ev of events.slice(0, 40)) {
    const row = document.createElement("div");
    row.className = "event-row";
    row.innerHTML = `
      <span class="event-time">${ev.t}</span>
      <span class="event-title">${ev.title}</span>
      <span class="event-detail">${ev.detail}</span>
    `;
    log.appendChild(row);
  }
}

// ---- lightweight canvas line charts (no external deps) ----
function drawLineChart(canvas, points, color, label, unitFmt) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width = canvas.clientWidth * devicePixelRatio;
  const h = canvas.height = 90 * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  const W = canvas.clientWidth, H = 90;
  ctx.clearRect(0, 0, W, H);
  if (!points.length) return;

  const values = points.map((p) => p.v);
  let min = Math.min(...values), max = Math.max(...values);
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.12;
  min -= pad; max += pad;

  const xAt = (i) => (i / Math.max(points.length - 1, 1)) * (W - 40) + 30;
  const yAt = (v) => H - 14 - ((v - min) / (max - min)) * (H - 28);

  // grid
  ctx.strokeStyle = "#E4E9EF";
  ctx.lineWidth = 1;
  for (let g = 0; g <= 2; g++) {
    const y = 10 + g * (H - 28) / 2;
    ctx.beginPath(); ctx.moveTo(30, y); ctx.lineTo(W - 10, y); ctx.stroke();
  }

  // line
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = xAt(i), y = yAt(p.v);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // fill
  ctx.lineTo(xAt(points.length - 1), H - 14);
  ctx.lineTo(xAt(0), H - 14);
  ctx.closePath();
  ctx.fillStyle = color + "22";
  ctx.fill();

  // endpoint
  const last = points[points.length - 1];
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(xAt(points.length - 1), yAt(last.v), 3.2, 0, 2 * Math.PI);
  ctx.fill();

  // labels
  ctx.fillStyle = "#5A6472";
  ctx.font = "10px Segoe UI";
  ctx.textAlign = "left";
  ctx.fillText(max.toFixed(1), 2, 14);
  ctx.fillText(min.toFixed(1), 2, H - 16);
  ctx.textAlign = "right";
  ctx.fillStyle = color;
  ctx.font = "bold 11px Segoe UI";
  ctx.fillText(unitFmt(last.v), W - 6, 14);
}

async function refreshHistory() {
  const res = await fetch(`/api/history/${selectedCell}`);
  const data = await res.json();
  const pts = data.points;
  drawLineChart(el("chartTemp"), pts.map((p) => ({ v: p.T_C })), "#E4572E", "T", (v) => `${v.toFixed(1)}°C`);
  drawLineChart(el("chartStress"), pts.map((p) => ({ v: p.sigma_t_MPa })), "#8E44AD", "sigma", (v) => `${v.toFixed(1)} MPa`);
  drawLineChart(el("chartConc"), pts.map((p) => ({ v: p.c_surface_pct })), "#1B7FBF", "c", (v) => `${v.toFixed(1)}%`);
}

async function refreshEvents() {
  const res = await fetch("/api/events");
  const data = await res.json();
  updateEvents(data.events);
}

async function refreshSnapshot() {
  const res = await fetch("/api/snapshot");
  const snap = await res.json();

  if (!packGridBuilt) buildPackGrid(snap.cells);
  updatePackGrid(snap.cells);
  updateStatusStrip(snap);
  updateCellMeta(snap.cells);
  updateRanking(snap.ranking, snap.cells);

  el("scenarioSelect").value = snap.scenario;
}

function bindControls() {
  el("scenarioSelect").addEventListener("change", (e) => {
    postControl({ scenario: e.target.value });
  });
  el("playBtn").addEventListener("click", () => {
    isRunning = !isRunning;
    el("playBtn").textContent = isRunning ? "Pause" : "Resume";
    postControl({ running: isRunning });
  });
  el("speedSlider").addEventListener("input", (e) => {
    el("speedLabel").textContent = `${parseFloat(e.target.value).toFixed(2)}x`;
    postControl({ speed: e.target.value });
  });
  el("resetBtn").addEventListener("click", () => postControl({ reset: true }));
}

async function init() {
  await loadScenarios();
  bindControls();
  await refreshSnapshot();
  await refreshHistory();
  await refreshEvents();
  setInterval(refreshSnapshot, 600);
  setInterval(refreshHistory, 900);
  setInterval(refreshEvents, 2500);
  window.addEventListener("resize", refreshHistory);
}

init();
