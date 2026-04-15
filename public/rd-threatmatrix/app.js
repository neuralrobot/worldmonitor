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
  likelihoodValue: document.getElementById("likelihoodValue"),
  impactValue: document.getElementById("impactValue"),
  scoreValue: document.getElementById("scoreValue"),
  levelValue: document.getElementById("levelValue"),
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
  if (score >= 20) return "critical";
  if (score >= 12) return "high";
  if (score >= 6) return "med";
  return "low";
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

function renderThreatList() {
  el.threatList.innerHTML = "";

  if (!state.threats.length) {
    const empty = document.createElement("li");
    empty.textContent = "No threats yet. Add one above.";
    el.threatList.appendChild(empty);
    return;
  }

  state.threats.forEach((threat) => {
    const item = document.createElement("li");
    item.className = `threat-item${threat.id === state.selectedThreatId ? " active" : ""}`;

    const info = document.createElement("div");
    info.innerHTML = `
      <div class="threat-title">${escapeHtml(threat.name)}</div>
      <div class="threat-meta">${escapeHtml(threat.category || "Uncategorized")}</div>
    `;
    info.style.cursor = "pointer";
    info.addEventListener("click", () => {
      state.selectedThreatId = threat.id;
      save();
      renderAll();
    });

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "small-btn";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => {
      state.threats = state.threats.filter((t) => t.id !== threat.id);
      if (state.selectedThreatId === threat.id) {
        state.selectedThreatId = state.threats[0] ? state.threats[0].id : null;
      }
      save();
      renderAll();
    });

    item.appendChild(info);
    item.appendChild(removeBtn);
    el.threatList.appendChild(item);
  });
}

function renderMatrix() {
  el.matrix.innerHTML = "";
  const selected = selectedThreat();

  for (let likelihood = 5; likelihood >= 1; likelihood -= 1) {
    for (let impact = 1; impact <= 5; impact += 1) {
      const score = likelihood * impact;
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = `cell ${cellTone(score)}`;
      cell.textContent = `${likelihood}x${impact}`;
      cell.title = `Likelihood ${likelihood}, Impact ${impact}, Score ${score}`;

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
}

function renderSummary() {
  const selected = selectedThreat();

  if (!selected) {
    el.selectedThreatText.textContent = "No threat selected.";
    el.likelihoodValue.textContent = "-";
    el.impactValue.textContent = "-";
    el.scoreValue.textContent = "-";
    el.levelValue.textContent = "-";
    return;
  }

  const likelihood = Number(selected.likelihood) || 1;
  const impact = Number(selected.impact) || 1;
  const score = likelihood * impact;

  el.selectedThreatText.textContent = `${selected.name} (${selected.category || "Uncategorized"})`;
  el.likelihoodValue.textContent = String(likelihood);
  el.impactValue.textContent = String(impact);
  el.scoreValue.textContent = String(score);
  el.levelValue.textContent = riskLevel(score);
}

function renderAll() {
  renderThreatList();
  renderMatrix();
  renderSummary();
}

function addThreat() {
  const name = el.threatName.value.trim();
  const category = el.threatCategory.value.trim();

  if (!name) {
    el.threatName.focus();
    return;
  }

  const threat = {
    id: uid(),
    name,
    category,
    likelihood: 1,
    impact: 1,
  };

  state.threats.unshift(threat);
  state.selectedThreatId = threat.id;
  el.threatName.value = "";
  el.threatCategory.value = "";
  save();
  renderAll();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

el.addThreatBtn.addEventListener("click", addThreat);
el.threatName.addEventListener("keydown", (event) => {
  if (event.key === "Enter") addThreat();
});
el.threatCategory.addEventListener("keydown", (event) => {
  if (event.key === "Enter") addThreat();
});

load();
renderAll();