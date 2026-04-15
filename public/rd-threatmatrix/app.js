const STORAGE_KEY = "rd-threat-matrix-v1";

const state = {
  threats: [],
  selectedThreatId: null,
};

const el = {
  threatName: document.getElementById("threatName"),
  threatCategory: document.getElementById("threatCategory"),
  addThreatBtn: document.getElementById("addThreatBtn"),
  threatList: document.getElementById("threatList"),
  matrix: document.getElementById("matrix"),
  selectedThreatText: document.getElementById("selectedThreatText"),
  selectedCatText: document.getElementById("selectedCatText"),
  likelihoodValue: document.getElementById("likelihoodValue"),
  impactValue: document.getElementById("impactValue"),
  scoreValue: document.getElementById("scoreValue"),
  levelValue: document.getElementById("levelValue"),
  countBadge: document.getElementById("countBadge"),
  levelBadge: document.getElementById("levelBadge"),
  overviewBody: document.getElementById("overviewBody"),
  clock: document.getElementById("clock"),
};

function uid() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function riskLevel(score) {
  if (score >= 20) return "Critical";
  if (score >= 12) return "High";
  if (score >= 6) return "Medium";
  return "Low";
}

function cellTone(score) {
  if (score >= 20) return "c-critical";
  if (score >= 12) return "c-high";
  if (score >= 6) return "c-med";
  return "c-low";
}

function valueClass(score) {
  if (score >= 20) return "v-critical";
  if (score >= 12) return "v-high";
  if (score >= 6) return "v-med";
  return "v-low";
}

function badgeClass(score) {
  if (score >= 20) return "badge-critical";
  if (score >= 12) return "badge-high";
  if (score >= 6) return "badge-medium";
  return "badge-low";
}

function pillBg(score) {
  if (score >= 20) return "background:#7f1d1d;color:#fca5a5";
  if (score >= 12) return "background:#6b3410;color:#fdba74";
  if (score >= 6) return "background:#5c5510;color:#fde047";
  return "background:#134e2a;color:#86efac";
}

function selectedThreat() {
  return state.threats.find((t) => t.id === state.selectedThreatId) || null;
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    state.threats = [
      { id: uid(), name: "Port disruption", category: "Supply Chain", likelihood: 3, impact: 4 },
      { id: uid(), name: "Grid outage", category: "Infrastructure", likelihood: 2, impact: 5 },
      { id: uid(), name: "Cyber intrusion", category: "Cyber", likelihood: 4, impact: 3 },
      { id: uid(), name: "Fuel embargo", category: "Energy", likelihood: 2, impact: 4 },
    ];
    state.selectedThreatId = state.threats[0].id;
    save();
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    state.threats = Array.isArray(parsed.threats) ? parsed.threats : [];
    state.selectedThreatId = parsed.selectedThreatId || (state.threats[0] && state.threats[0].id) || null;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    load();
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/* ── render: threat list ── */
function renderThreatList() {
  el.threatList.innerHTML = "";
  el.countBadge.textContent = String(state.threats.length);

  if (!state.threats.length) {
    const empty = document.createElement("li");
    empty.style.cssText = "color:#666;font-size:11px;padding:6px 0";
    empty.textContent = "No threats registered.";
    el.threatList.appendChild(empty);
    return;
  }

  state.threats.forEach((threat) => {
    const score = (Number(threat.likelihood) || 1) * (Number(threat.impact) || 1);
    const item = document.createElement("li");
    item.className = `threat-item${threat.id === state.selectedThreatId ? " active" : ""}`;

    const info = document.createElement("div");
    info.innerHTML =
      `<span class="threat-name">${escapeHtml(threat.name)}</span>` +
      `<span class="threat-cat">${escapeHtml(threat.category || "—")}</span>`;
    info.addEventListener("click", () => {
      state.selectedThreatId = threat.id;
      save();
      renderAll();
    });

    const right = document.createElement("div");
    right.style.cssText = "display:flex;align-items:center;gap:6px";

    const pill = document.createElement("span");
    pill.className = "threat-score-pill";
    pill.style.cssText = pillBg(score);
    pill.textContent = `${score} ${riskLevel(score).toUpperCase()}`;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn btn-danger";
    removeBtn.textContent = "×";
    removeBtn.title = "Remove threat";
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      state.threats = state.threats.filter((t) => t.id !== threat.id);
      if (state.selectedThreatId === threat.id) {
        state.selectedThreatId = state.threats[0] ? state.threats[0].id : null;
      }
      save();
      renderAll();
    });

    right.appendChild(pill);
    right.appendChild(removeBtn);
    item.appendChild(info);
    item.appendChild(right);
    el.threatList.appendChild(item);
  });
}

/* ── render: matrix grid ── */
function renderMatrix() {
  el.matrix.innerHTML = "";
  const selected = selectedThreat();

  for (let likelihood = 5; likelihood >= 1; likelihood -= 1) {
    // Y-axis label
    const yLabel = document.createElement("div");
    yLabel.className = "y-label";
    yLabel.textContent = String(likelihood);
    el.matrix.appendChild(yLabel);

    for (let impact = 1; impact <= 5; impact += 1) {
      const score = likelihood * impact;
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = `cell ${cellTone(score)}`;
      cell.textContent = String(score);
      cell.title = `L${likelihood} × I${impact} = ${score}`;

      if (selected && selected.likelihood === likelihood && selected.impact === impact) {
        cell.classList.add("selected");
      }

      cell.addEventListener("click", () => {
        if (!selected) return;
        selected.likelihood = likelihood;
        selected.impact = impact;
        save();
        renderAll();
      });

      el.matrix.appendChild(cell);
    }
  }

  // X-axis label row
  const corner = document.createElement("div");
  corner.className = "corner";
  el.matrix.appendChild(corner);
  for (let i = 1; i <= 5; i++) {
    const xLabel = document.createElement("div");
    xLabel.className = "x-label";
    xLabel.textContent = String(i);
    el.matrix.appendChild(xLabel);
  }
}

/* ── render: summary ── */
function renderSummary() {
  const selected = selectedThreat();

  if (!selected) {
    el.selectedThreatText.textContent = "No threat selected";
    el.selectedCatText.textContent = "";
    el.likelihoodValue.textContent = "–";
    el.likelihoodValue.className = "stat-value v-none";
    el.impactValue.textContent = "–";
    el.impactValue.className = "stat-value v-none";
    el.scoreValue.textContent = "–";
    el.scoreValue.className = "stat-value v-none";
    el.levelValue.textContent = "–";
    el.levelValue.className = "stat-value v-none";
    el.levelBadge.textContent = "—";
    el.levelBadge.className = "panel-badge badge-info";
    return;
  }

  const likelihood = Number(selected.likelihood) || 1;
  const impact = Number(selected.impact) || 1;
  const score = likelihood * impact;
  const level = riskLevel(score);
  const cls = valueClass(score);

  el.selectedThreatText.textContent = selected.name;
  el.selectedCatText.textContent = selected.category || "Uncategorized";
  el.likelihoodValue.textContent = String(likelihood);
  el.likelihoodValue.className = "stat-value " + cls;
  el.impactValue.textContent = String(impact);
  el.impactValue.className = "stat-value " + cls;
  el.scoreValue.textContent = String(score);
  el.scoreValue.className = "stat-value " + cls;
  el.levelValue.textContent = level;
  el.levelValue.className = "stat-value " + cls;
  el.levelBadge.textContent = level.toUpperCase();
  el.levelBadge.className = "panel-badge " + badgeClass(score);
}

/* ── render: overview table ── */
function renderOverview() {
  el.overviewBody.innerHTML = "";

  const sorted = state.threats
    .map((t) => {
      const s = (Number(t.likelihood) || 1) * (Number(t.impact) || 1);
      return { ...t, score: s };
    })
    .sort((a, b) => b.score - a.score);

  sorted.forEach((t) => {
    const row = document.createElement("tr");
    row.style.cssText = "border-bottom:1px solid #1a1a1a";
    const level = riskLevel(t.score);
    row.innerHTML =
      `<td style="padding:4px 6px;font-size:12px">${escapeHtml(t.name)}</td>` +
      `<td style="text-align:center;padding:4px 6px;font-size:12px;color:#ccc">${t.likelihood}</td>` +
      `<td style="text-align:center;padding:4px 6px;font-size:12px;color:#ccc">${t.impact}</td>` +
      `<td style="text-align:center;padding:4px 6px;font-size:12px;font-weight:700">${t.score}</td>` +
      `<td style="text-align:center;padding:4px 6px"><span class="threat-score-pill" style="${pillBg(t.score)}">${level}</span></td>`;
    el.overviewBody.appendChild(row);
  });
}

/* ── render all ── */
function renderAll() {
  renderThreatList();
  renderMatrix();
  renderSummary();
  renderOverview();
}

/* ── add threat ── */
function addThreat() {
  const name = el.threatName.value.trim();
  const category = el.threatCategory.value.trim();
  if (!name) { el.threatName.focus(); return; }

  const threat = { id: uid(), name, category, likelihood: 1, impact: 1 };
  state.threats.unshift(threat);
  state.selectedThreatId = threat.id;
  el.threatName.value = "";
  el.threatCategory.value = "";
  save();
  renderAll();
}

/* ── clock ── */
function tickClock() {
  el.clock.textContent = new Date().toUTCString().replace("GMT", "UTC");
}

el.addThreatBtn.addEventListener("click", addThreat);
el.threatName.addEventListener("keydown", (e) => { if (e.key === "Enter") addThreat(); });
el.threatCategory.addEventListener("keydown", (e) => { if (e.key === "Enter") addThreat(); });

load();
renderAll();
tickClock();
setInterval(tickClock, 1000);