/* ════════════════════════════════════════════════════════
   RD Threat Matrix — dashboard logic
   Map · Live Feeds · Threat Hotspots · AI Brief
   ════════════════════════════════════════════════════════ */

/* ── helpers ── */
function esc(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function ago(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return "";
  const m = Math.round((Date.now() - d) / 60000);
  if (m < 1) return "now";
  if (m < 60) return m + "m";
  if (m < 1440) return Math.floor(m / 60) + "h";
  return Math.floor(m / 1440) + "d";
}

/* ── clock ── */
function tickClock() {
  const now = new Date();
  document.getElementById("clock").textContent =
    now.toUTCString().replace("GMT","UTC");
  document.getElementById("dateUtc").textContent =
    now.toUTCString().replace("GMT","UTC");
}
tickClock();
setInterval(tickClock, 1000);

/* ════════════════════════════════════════
   THREAT HOTSPOT DATA (curated + live-extendable)
   ════════════════════════════════════════ */
const HOTSPOTS = [
  { id:1, name:"Eastern Ukraine",   lat:48.5,  lng:37.8,  cat:"conflicts",     level:"critical", detail:"Active conflict zone — ongoing artillery, drone, and ground operations" },
  { id:2, name:"Gaza Strip",        lat:31.4,  lng:34.38, cat:"conflicts",     level:"critical", detail:"Ongoing military operations and humanitarian crisis" },
  { id:3, name:"Taiwan Strait",     lat:24.5,  lng:119.5, cat:"military",      level:"high",     detail:"Elevated military posture — naval exercises and air incursions" },
  { id:4, name:"South China Sea",   lat:14.5,  lng:114.0, cat:"military",      level:"elevated", detail:"Territorial disputes — coast guard and naval confrontations" },
  { id:5, name:"Iran Nuclear Sites",lat:33.7,  lng:51.4,  cat:"nuclear",       level:"high",     detail:"Uranium enrichment exceeding JCPOA limits — IAEA concern" },
  { id:6, name:"Red Sea / Houthi",  lat:14.0,  lng:42.5,  cat:"maritime",      level:"critical", detail:"Anti-shipping attacks disrupting global trade routes" },
  { id:7, name:"Sahel Region",      lat:14.5,  lng:-1.5,  cat:"conflicts",     level:"high",     detail:"Multi-state insurgency — Mali, Burkina Faso, Niger" },
  { id:8, name:"Korean Peninsula",  lat:38.3,  lng:127.0, cat:"military",      level:"elevated", detail:"Missile tests and cross-border provocations" },
  { id:9, name:"Strait of Hormuz",  lat:26.5,  lng:56.3,  cat:"maritime",      level:"elevated", detail:"Strategic oil chokepoint — periodic tanker seizures" },
  { id:10,name:"Eastern Mediterranean",lat:34.5,lng:33.0,  cat:"military",      level:"high",     detail:"Naval buildup — carrier groups and surveillance ops" },
  { id:11,name:"Ransomware (Global)",lat:40.0,  lng:-74.0, cat:"cyber",         level:"critical", detail:"Critical infrastructure targeted — healthcare, energy, finance" },
  { id:12,name:"APT Campaigns",     lat:39.9,  lng:116.4, cat:"cyber",         level:"high",     detail:"State-sponsored actors targeting defense and tech sectors" },
  { id:13,name:"Europe Grid Stress",lat:50.1,  lng:8.7,   cat:"infrastructure",level:"elevated", detail:"Energy grid under strain — gas supply disruptions" },
  { id:14,name:"Sudan Conflict",    lat:15.6,  lng:32.5,  cat:"conflicts",     level:"critical", detail:"Civil war between SAF and RSF — mass displacement" },
  { id:15,name:"Myanmar Civil War", lat:19.7,  lng:96.1,  cat:"conflicts",     level:"high",     detail:"Multi-front resistance against military junta" },
  { id:16,name:"Arctic Militarization",lat:71.0,lng:25.0, cat:"military",      level:"monitoring",detail:"Military base expansion — NATO and Russian posturing" },
  { id:17,name:"Mpox Outbreak",     lat:-4.3,  lng:15.3,  cat:"health",        level:"elevated", detail:"Clade Ib variant spreading across Central/East Africa" },
  { id:18,name:"Horn of Africa",    lat:9.0,   lng:42.0,  cat:"climate",       level:"elevated", detail:"Severe drought — food insecurity affecting millions" },
  { id:19,name:"Kashmir LoC",       lat:34.1,  lng:74.8,  cat:"conflicts",     level:"high",     detail:"Cross-border skirmishes and ceasefire violations" },
  { id:20,name:"Venezuela Border",  lat:7.8,   lng:-72.2, cat:"conflicts",     level:"elevated", detail:"Political instability and Essequibo territorial dispute" },
  { id:21,name:"Cape of Good Hope", lat:-34.35, lng:18.49, cat:"maritime",      level:"elevated", detail:"Increased shipping traffic as vessels reroute from Red Sea — strategic chokepoint for SA" },
  { id:22,name:"Mozambique Channel",lat:-17.0,  lng:41.0,  cat:"maritime",      level:"elevated", detail:"Key alternate route alongside Cape — piracy risk and LNG shipping corridor" },
];

const SEVERITY_ORDER = { critical:0, high:1, elevated:2, monitoring:3 };
const SEVERITY_COLORS = { critical:"#ef4444", high:"#f97316", elevated:"#eab308", monitoring:"#22c55e" };
const SEVERITY_CSS = { critical:"hl-critical", high:"hl-high", elevated:"hl-elevated", monitoring:"hl-monitoring" };

/* ════════════════════════════════════════
   MAP (Leaflet + CartoDB dark tiles — no API key)
   ════════════════════════════════════════ */
const map = L.map("map", {
  center: [25, 20],
  zoom: 2.5,
  minZoom: 2,
  maxZoom: 10,
  zoomControl: false,
  attributionControl: false,
});
L.control.zoom({ position: "topright" }).addTo(map);
L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
  subdomains: "abcd",
  maxZoom: 19,
}).addTo(map);

/* marker layers keyed by category */
const markerLayers = {};
const enabledLayers = new Set();

function buildMarkers() {
  /* clear existing */
  Object.values(markerLayers).forEach((lg) => map.removeLayer(lg));
  Object.keys(markerLayers).forEach((k) => delete markerLayers[k]);

  HOTSPOTS.forEach((h) => {
    if (!markerLayers[h.cat]) markerLayers[h.cat] = L.layerGroup();
    const color = SEVERITY_COLORS[h.level] || "#888";
    const radius = h.level === "critical" ? 10 : h.level === "high" ? 8 : 6;

    const marker = L.circleMarker([h.lat, h.lng], {
      radius,
      color,
      fillColor: color,
      fillOpacity: 0.55,
      weight: 1.5,
    });
    marker.bindPopup(
      `<div style="font-family:monospace;font-size:12px">` +
        `<strong>${esc(h.name)}</strong><br/>` +
        `<span style="color:${color};font-weight:700;text-transform:uppercase">${h.level}</span><br/>` +
        `<span style="color:#ccc">${esc(h.detail)}</span>` +
      `</div>`,
      { className: "dark-popup" }
    );
    marker.addTo(markerLayers[h.cat]);
  });

  /* add checked layers */
  document.querySelectorAll("#layersList input[type=checkbox]").forEach((cb) => {
    const cat = cb.dataset.layer;
    if (cb.checked) enabledLayers.add(cat);
    else enabledLayers.delete(cat);
  });
  enabledLayers.forEach((cat) => {
    if (markerLayers[cat]) markerLayers[cat].addTo(map);
  });
}

/* layer toggles */
document.getElementById("layersList").addEventListener("change", (e) => {
  if (!e.target.matches("input[type=checkbox]")) return;
  const cat = e.target.dataset.layer;
  if (e.target.checked) {
    enabledLayers.add(cat);
    if (markerLayers[cat]) markerLayers[cat].addTo(map);
  } else {
    enabledLayers.delete(cat);
    if (markerLayers[cat]) map.removeLayer(markerLayers[cat]);
  }
});

/* pulsing rings for critical hotspots */
function addPulseRings() {
  HOTSPOTS.filter((h) => h.level === "critical").forEach((h) => {
    L.circleMarker([h.lat, h.lng], {
      radius: 18,
      color: "#ef4444",
      fillColor: "transparent",
      weight: 1,
      opacity: 0.4,
      className: "pulse-ring",
    }).addTo(map);
  });
}

buildMarkers();
addPulseRings();

/* inject pulse animation into page */
const pulseStyle = document.createElement("style");
pulseStyle.textContent = `
  .dark-popup .leaflet-popup-content-wrapper{background:#141414;color:#e8e8e8;border:1px solid #2a2a2a;border-radius:4px;box-shadow:0 4px 20px rgba(0,0,0,.6)}
  .dark-popup .leaflet-popup-tip{background:#141414;border:1px solid #2a2a2a}
  @keyframes pulse-ring{0%{r:18;opacity:.4}100%{r:30;opacity:0}}
  .pulse-ring{animation:pulse-ring 2s ease-out infinite}
`;
document.head.appendChild(pulseStyle);

/* ════════════════════════════════════════
   LIVE FEEDS (RSS via rss2json.com free tier)
   ════════════════════════════════════════ */
const FEEDS = {
  reuters: {
    url: "https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Ffeeds.reuters.com%2Freuters%2FworldNews",
    label: "Reuters", cssClass: "src-reuters",
  },
  bbc: {
    url: "https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Ffeeds.bbci.co.uk%2Fnews%2Fworld%2Frss.xml",
    label: "BBC", cssClass: "src-bbc",
  },
  cyber: {
    url: "https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Ffeeds.feedburner.com%2FTheHackersNews",
    label: "Cyber", cssClass: "src-cyber",
  },
};

let allFeedItems = [];
let activeFeedFilter = "all";

async function fetchFeeds() {
  const results = [];
  const keys = Object.keys(FEEDS);

  const fetches = keys.map(async (key) => {
    try {
      const resp = await fetch(FEEDS[key].url);
      if (!resp.ok) return;
      const data = await resp.json();
      if (data.status !== "ok" || !data.items) return;
      data.items.forEach((item) => {
        results.push({
          source: key,
          label: FEEDS[key].label,
          cssClass: FEEDS[key].cssClass,
          title: item.title,
          link: item.link,
          pubDate: item.pubDate,
        });
      });
    } catch { /* network fail — silent */ }
  });

  await Promise.all(fetches);

  /* sort newest first */
  results.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  allFeedItems = results;
  renderFeeds();
}

function renderFeeds() {
  const list = document.getElementById("feedList");
  const items = activeFeedFilter === "all"
    ? allFeedItems
    : allFeedItems.filter((f) => f.source === activeFeedFilter);

  if (!items.length) {
    list.innerHTML = '<div class="feed-loading">No items — feeds loading or unavailable.</div>';
    return;
  }

  list.innerHTML = items.slice(0, 40).map((f) =>
    `<a class="feed-item" href="${esc(f.link)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;color:inherit">` +
      `<span class="feed-time">${ago(f.pubDate)}</span>` +
      `<div class="feed-body">` +
        `<div class="feed-source ${f.cssClass}">${esc(f.label)}</div>` +
        `<div class="feed-headline">${esc(f.title)}</div>` +
      `</div>` +
    `</a>`
  ).join("");
}

/* feed tabs */
document.getElementById("feedTabs").addEventListener("click", (e) => {
  if (!e.target.matches(".feed-tab")) return;
  document.querySelectorAll(".feed-tab").forEach((t) => t.classList.remove("active"));
  e.target.classList.add("active");
  activeFeedFilter = e.target.dataset.feed;
  renderFeeds();
});

/* initial + auto-refresh every 5 min */
fetchFeeds();
setInterval(fetchFeeds, 300000);

/* ════════════════════════════════════════
   THREAT HOTSPOTS PANEL
   ════════════════════════════════════════ */
function renderHotspots() {
  const el = document.getElementById("hotspotList");
  const countEl = document.getElementById("hotspotCount");

  const visible = HOTSPOTS
    .filter((h) => enabledLayers.has(h.cat))
    .sort((a, b) => (SEVERITY_ORDER[a.level] ?? 9) - (SEVERITY_ORDER[b.level] ?? 9));

  countEl.textContent = String(visible.length);

  el.innerHTML = visible.map((h) =>
    `<div class="hotspot-item" data-lat="${h.lat}" data-lng="${h.lng}">` +
      `<span class="hotspot-severity" style="background:${SEVERITY_COLORS[h.level] || "#888"}"></span>` +
      `<div class="hotspot-info">` +
        `<div class="hotspot-name">${esc(h.name)}</div>` +
        `<div class="hotspot-detail">${esc(h.detail)}</div>` +
      `</div>` +
      `<span class="hotspot-level ${SEVERITY_CSS[h.level] || ""}">${h.level.toUpperCase()}</span>` +
    `</div>`
  ).join("");

  /* click to fly to location on map */
  el.querySelectorAll(".hotspot-item").forEach((item) => {
    item.style.cursor = "pointer";
    item.addEventListener("click", () => {
      const lat = parseFloat(item.dataset.lat);
      const lng = parseFloat(item.dataset.lng);
      map.flyTo([lat, lng], 6, { duration: 1.2 });
    });
  });
}

/* re-render hotspots when layers change */
document.getElementById("layersList").addEventListener("change", () => {
  setTimeout(renderHotspots, 0);
});

/* initial render — all checked layers */
document.querySelectorAll("#layersList input:checked").forEach((cb) =>
  enabledLayers.add(cb.dataset.layer)
);
renderHotspots();

/* ════════════════════════════════════════
   AI THREAT BRIEF (synthesized from hotspot data)
   ════════════════════════════════════════ */
/* SA Impact Domains — how global threats translate to South Africa */
const SA_DOMAINS = [
  { name: "Maritime & Cape Route",  hotspots: [6,9,21,22],  icon: "🚢", saNote: "Red Sea disruption reroutes vessels via Cape of Good Hope — increased port traffic but higher maritime risk" },
  { name: "Energy & Resources",     hotspots: [5,6,9,13],   icon: "⛽", saNote: "Oil supply chain pressure and Strait of Hormuz tensions affect fuel import costs" },
  { name: "Regional Stability",     hotspots: [7,14,17,18], icon: "🌍", saNote: "Sahel & Horn of Africa conflicts drive migration pressure and SADC peacekeeping demands" },
  { name: "Trade & Supply Chains",  hotspots: [1,2,3,10],   icon: "📦", saNote: "Global conflicts disrupt import/export flows — SA auto, agri, and metals sectors exposed" },
  { name: "Cyber & Infrastructure", hotspots: [11,12],      icon: "🔒", saNote: "SA critical infrastructure (Eskom, Transnet, banks) remains a ransomware target" },
  { name: "Food & Climate",         hotspots: [18,17],      icon: "🌾", saNote: "Regional drought and health crises strain borders and food supply" },
  { name: "Geopolitical Positioning",hotspots: [1,3,4,20],   icon: "🏛", saNote: "BRICS membership and non-aligned stance create diplomatic leverage but also pressure" },
];

function domainLevel(ids) {
  const levels = ids.map((id) => {
    const h = HOTSPOTS.find((x) => x.id === id);
    return h ? SEVERITY_ORDER[h.level] ?? 9 : 9;
  });
  const worst = Math.min(...levels);
  return ["CRIT","HIGH","ELEV","MON"][worst] || "—";
}

function domainBadge(lvl) {
  if (lvl === "CRIT") return "badge-crit";
  if (lvl === "HIGH") return "badge-high";
  if (lvl === "ELEV") return "badge-med";
  return "badge-low";
}

function renderPosture() {
  const list = document.getElementById("postureList");
  document.getElementById("postureNew").style.display = "inline";

  list.innerHTML = SA_DOMAINS.map((d) => {
    const lvl = domainLevel(d.hotspots);
    const badge = domainBadge(lvl);
    return (
      `<div class="posture-row">` +
        `<span class="posture-theater">${d.icon} ${esc(d.name)}</span>` +
        `<span class="posture-badge ${badge}">${lvl}</span>` +
      `</div>` +
      `<div class="posture-detail"><span>${esc(d.saNote)}</span></div>`
    );
  }).join("");
}

function renderBrief() {
  const crits = HOTSPOTS.filter((h) => h.level === "critical");
  const highs = HOTSPOTS.filter((h) => h.level === "high");
  const maritime = HOTSPOTS.filter((h) => h.cat === "maritime");

  const lines = [];

  /* headline */
  lines.push(`SOUTH AFRICA THREAT ASSESSMENT — ${crits.length} critical and ${highs.length} high-severity situations monitored globally.`);

  /* Cape of Good Hope / maritime */
  const redSea = HOTSPOTS.find((h) => h.id === 6);
  if (redSea && (redSea.level === "critical" || redSea.level === "high")) {
    lines.push(
      "Red Sea anti-shipping attacks are forcing major carriers to reroute via the Cape of Good Hope, " +
      "increasing vessel traffic through South African waters by an estimated 40-60%. " +
      "This raises collision risk, search-and-rescue demands, and environmental exposure along the Western Cape coast, " +
      "but also generates significant port revenue uplift for Cape Town, Saldanha Bay, and Richards Bay."
    );
  }

  /* energy impact */
  lines.push(
    "Strait of Hormuz tensions and Middle East instability continue to pressure global oil prices. " +
    "South Africa, as a net fuel importer, faces direct cost-of-living impact through higher petrol and diesel prices."
  );

  /* regional Africa */
  const africaConflicts = HOTSPOTS.filter((h) => [7,14,17,18].includes(h.id) && (h.level === "critical" || h.level === "high"));
  if (africaConflicts.length) {
    lines.push(
      `Regional instability in ${africaConflicts.map((h) => h.name).join(", ")} increases migration pressure on SA borders ` +
      "and stretches SANDF peacekeeping commitments within SADC."
    );
  }

  /* cyber */
  lines.push(
    "Global ransomware campaigns targeting critical infrastructure remain at critical level. " +
    "SA entities — particularly Eskom, Transnet, and the financial sector — are in the active target set."
  );

  document.getElementById("aiBrief").textContent = lines.join(" ");
}

/* ═══════ OPPORTUNITIES FOR SA ═══════ */
const SA_OPPORTUNITIES = [
  { icon: "🚢", title: "Cape Route Revenue Surge",
    detail: "Red Sea rerouting drives 40-60% more vessel transits past the Cape — port fees, bunkering, ship repair, and logistics services at Cape Town, Saldanha Bay, and Richards Bay see direct uplift." },
  { icon: "⛏", title: "Critical Minerals Demand",
    detail: "SA holds 80% of global platinum, 70% of manganese, and major chromium reserves. Geopolitical supply chain diversification away from China/Russia increases demand and pricing power for SA mining exports." },
  { icon: "🔋", title: "Green Energy Transition",
    detail: "Global push for renewables and battery storage creates export demand for SA's vanadium, lithium, and rare earths. Green hydrogen projects in the Northern Cape position SA as a future clean energy exporter." },
  { icon: "🏛", title: "BRICS+ Diplomatic Leverage",
    detail: "SA's BRICS membership and non-aligned stance provide diplomatic leverage. Trade corridors with India, Brazil, and UAE expand beyond traditional Western markets." },
  { icon: "🌾", title: "Agricultural Export Window",
    detail: "Climate disruptions in competing regions (Horn of Africa drought, Black Sea grain blockades) open export windows for SA citrus, wine, maize, and deciduous fruit to premium markets." },
  { icon: "🛡", title: "Maritime Security Hub",
    detail: "Increased Cape traffic creates opportunity for SA Navy and private sector to offer maritime security, surveillance, and escort services — positioning SA as the Indian Ocean's western anchor." },
  { icon: "💻", title: "Tech & Cybersecurity Growth",
    detail: "Rising global cyber threats drive demand for cybersecurity talent. SA's growing tech sector in Cape Town and Johannesburg can capture outsourced security operations work." },
];

function renderOpportunities() {
  const el = document.getElementById("opportunitiesList");
  if (!el) return;
  el.innerHTML = SA_OPPORTUNITIES.map((o) =>
    `<div class="opp-item">` +
      `<span class="opp-icon">${o.icon}</span>` +
      `<div class="opp-info">` +
        `<div class="opp-title">${esc(o.title)}</div>` +
        `<div class="opp-detail">${esc(o.detail)}</div>` +
      `</div>` +
    `</div>`
  ).join("");
}

/* compute overall DEFCON-style threat level */
function renderDefcon() {
  const crits = HOTSPOTS.filter((h) => h.level === "critical").length;
  const highs = HOTSPOTS.filter((h) => h.level === "high").length;
  let lvl = 5, cls = "defcon-5", text = "THREAT LVL 5";
  if (crits >= 4) { lvl = 1; cls = "defcon-1"; text = "THREAT LVL 1"; }
  else if (crits >= 2) { lvl = 2; cls = "defcon-2"; text = "THREAT LVL 2"; }
  else if (crits >= 1 || highs >= 4) { lvl = 3; cls = "defcon-3"; text = "THREAT LVL 3"; }
  else if (highs >= 1) { lvl = 4; cls = "defcon-4"; text = "THREAT LVL 4"; }
  const pill = document.getElementById("defconPill");
  pill.className = "defcon-pill " + cls;
  pill.textContent = text;
}

renderBrief();
renderPosture();
renderOpportunities();
renderDefcon();