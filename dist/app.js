const FACTOR = 0.740;
const PREINDUSTRIAL_CO2 = 278.0;
const TREE_ABSORPTION_KG_MONTH = 2.17;
const CARTO_DARK_TILE_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep"];
const BASE_USAGE = [343, 329, 335, 317, 326];

const PRECINCTS = [
  {
    id: "elmina-west",
    name: "Elmina West",
    subtitle: "Pilot precinct",
    lat: 3.1890,
    lon: 101.5090,
    baselineKwh: 345,
    fallback: { co2: 428.2, aqi: 42, co: 186, pm25: 11.8 }
  },
  {
    id: "elmina-east",
    name: "Elmina East",
    subtitle: "Residential precinct",
    lat: 3.1950,
    lon: 101.5280,
    baselineKwh: 330,
    fallback: { co2: 429.1, aqi: 48, co: 205, pm25: 13.4 }
  },
  {
    id: "elmina-business",
    name: "Elmina Business Park",
    subtitle: "Commercial context",
    lat: 3.2200,
    lon: 101.5150,
    baselineKwh: 365,
    fallback: { co2: 431.5, aqi: 61, co: 244, pm25: 18.7 }
  },
  {
    id: "bukit-raja",
    name: "Bandar Bukit Raja",
    subtitle: "Township context",
    lat: 3.0760,
    lon: 101.4480,
    baselineKwh: 315,
    fallback: { co2: 426.8, aqi: 39, co: 172, pm25: 10.2 }
  },
  {
    id: "serenia-city",
    name: "Serenia City",
    subtitle: "Township context",
    lat: 2.8420,
    lon: 101.7030,
    baselineKwh: 295,
    fallback: { co2: 427.6, aqi: 45, co: 193, pm25: 12.1 }
  }
];

const TIMELINE = [
  {
    year: "1850",
    badge: "Pre-industrial",
    ppm: 278.0,
    title: "The atmospheric reference point",
    description: "A 278 ppm pre-industrial reference anchors the long-term global story. It is context—not a local township reading.",
    comparison: "Pre-industrial reference"
  },
  {
    year: "2021",
    badge: "SDP baseline",
    ppm: 416.4,
    title: "A baseline for corporate action",
    description: "The SDP baseline helps frame a 2030 Scope 1 and 2 target. Household electricity remains a separate, consent-based estimate.",
    comparison: "+138.4 ppm from 1850"
  },
  {
    year: "2026",
    badge: "Live context",
    ppm: 427.4,
    title: "Global concentration, local choices",
    description: "Live global CO₂ is paired with Elmina microclimate context. It is not a local air-quality reading or a household impact metric.",
    comparison: "+149.4 ppm from 1850"
  },
  {
    year: "2030",
    badge: "SDP target",
    ppm: 427.4,
    title: "A portfolio target—not a ppm forecast",
    description: "The −40% Scope 1 and 2 target is shown beside resident scenarios without claiming that household estimates are automatically credited to it.",
    comparison: "Live ppm held as context · no global forecast"
  }
];

const state = {
  kwh: Number(localStorage.getItem("carbonpulse-kwh")) || 300,
  completed: JSON.parse(localStorage.getItem("carbonpulse-actions") || '["temperature"]'),
  mapLayer: "scope",
  globalCo2: 427.4,
  globalLive: false,
  weather: { temperature: 31.2, humidity: 72, live: false },
  locations: PRECINCTS.map(location => ({
    ...location,
    atmosphere: { ...location.fallback },
    live: false
  }))
};

let climateMap;
let climateMapStarted = false;
const climateMarkers = new Map();

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const formatNumber = value => new Intl.NumberFormat("en-MY", { maximumFractionDigits: 0 }).format(value);
const safeNumber = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function navigate(view) {
  $$(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.view === view));
  $$(".view").forEach(panel => panel.classList.toggle("active", panel.dataset.viewPanel === view));
  document.title = `CarbonPulse · ${view.charAt(0).toUpperCase() + view.slice(1)}`;
  window.scrollTo({ top: 0, behavior: "smooth" });
  $("#sidebar").classList.remove("open");
  $("#menuButton").setAttribute("aria-expanded", "false");
  if (window.location.hash !== `#${view}`) history.replaceState(null, "", `#${view}`);
  if (view === "precinct") setTimeout(ensureClimateMap, 80);
}

function renderBarChart() {
  const values = [...BASE_USAGE, state.kwh];
  const max = Math.max(...values) * 1.08;
  $("#barChart").innerHTML = values.map((value, index) => `
    <div class="bar-column">
      <span class="bar-value">${value}</span>
      <span class="bar" style="height:${Math.max(12, (value / max) * 115)}px"></span>
      <span class="bar-label">${MONTHS[index]}</span>
    </div>`).join("");
}

function renderEnergy() {
  const emissions = state.kwh * FACTOR;
  $$('[data-kwh]').forEach(el => el.textContent = formatNumber(state.kwh));
  $$('[data-emissions]').forEach(el => el.textContent = emissions.toFixed(1));
  $$('[data-kwh-unit]').forEach(el => el.textContent = `${formatNumber(state.kwh)} kWh`);
  $$('[data-emissions-unit]').forEach(el => el.textContent = `${emissions.toFixed(1)} kg CO₂e`);
  $("#kwhInput").value = state.kwh;
  $("#emissionsBar").style.width = `${Math.min(100, emissions / 3)}%`;
  $("#goalBar").style.width = `${Math.min(100, 270 / state.kwh * 100)}%`;
  const gap = Math.max(0, state.kwh - 270);
  $("#goalGap").textContent = gap ? `${formatNumber(gap)} kWh` : "Goal reached";
  renderBarChart();
}

function renderActions() {
  $$(".plan-card").forEach(card => {
    const isDone = state.completed.includes(card.dataset.actionId);
    card.classList.toggle("completed", isDone);
    $(".action-check", card).textContent = isDone ? "✓" : "";
    $(".action-check", card).setAttribute("aria-label", `Mark ${card.dataset.actionId} action ${isDone ? "incomplete" : "complete"}`);
  });
  const done = state.completed.length;
  $("#actionDone").textContent = done;
  $("#actionCount").textContent = 3 - done;
  $("#planPercent").textContent = `${Math.round(done / 3 * 100)}%`;
  $$(".action-dots i").forEach((dot, index) => dot.classList.toggle("done", index < done));
  localStorage.setItem("carbonpulse-actions", JSON.stringify(state.completed));
}

async function fetchJson(url, timeoutMs = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Request failed with ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function loadClimateData() {
  const airRequests = state.locations.map(location => {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${location.lat}&longitude=${location.lon}&current=us_aqi,pm2_5,carbon_monoxide,carbon_dioxide&hourly=carbon_dioxide`;
    return fetchJson(url).then(data => ({ type: "air", id: location.id, data }));
  });
  const weatherRequest = fetchJson("https://api.open-meteo.com/v1/forecast?latitude=3.1890&longitude=101.5090&current=temperature_2m,relative_humidity_2m")
    .then(data => ({ type: "weather", data }));
  const globalRequest = fetchJson("https://global-warming.org/api/co2-api")
    .then(data => ({ type: "global", data }));

  const results = await Promise.allSettled([...airRequests, weatherRequest, globalRequest]);
  let liveAirCount = 0;

  results.forEach(result => {
    if (result.status !== "fulfilled") return;
    const payload = result.value;
    if (payload.type === "air") {
      const location = state.locations.find(item => item.id === payload.id);
      const current = payload.data?.current;
      if (!location || !current) return;
      location.atmosphere = {
        co2: safeNumber(current.carbon_dioxide, location.fallback.co2),
        aqi: safeNumber(current.us_aqi, location.fallback.aqi),
        co: safeNumber(current.carbon_monoxide, location.fallback.co),
        pm25: safeNumber(current.pm2_5, location.fallback.pm25)
      };
      location.live = true;
      liveAirCount += 1;
    }
    if (payload.type === "weather" && payload.data?.current) {
      state.weather = {
        temperature: safeNumber(payload.data.current.temperature_2m, state.weather.temperature),
        humidity: safeNumber(payload.data.current.relative_humidity_2m, state.weather.humidity),
        live: true
      };
    }
    if (payload.type === "global" && Array.isArray(payload.data?.co2)) {
      const latest = [...payload.data.co2].reverse().find(entry => Number.isFinite(Number(entry.trend)) || Number.isFinite(Number(entry.cycle)));
      if (latest) {
        state.globalCo2 = safeNumber(latest.trend, safeNumber(latest.cycle, state.globalCo2));
        state.globalLive = true;
      }
    }
  });

  const fullyLive = liveAirCount === state.locations.length && state.weather.live && state.globalLive;
  const status = $("#liveDataState");
  status.classList.add(fullyLive ? "live" : "fallback");
  status.innerHTML = fullyLive
    ? "<i></i><span><b>Live feeds connected</b>Updated atmospheric context</span>"
    : `<i></i><span><b>${liveAirCount ? "Partial live data" : "Fallback data active"}</b>${liveAirCount}/5 precinct feeds connected</span>`;
  renderClimateCards();
  renderTimeline(Number($("#timelineSlider").value));
  renderMapMarkers();
}

function ensureClimateMap() {
  if (climateMap) {
    climateMap.invalidateSize();
    return;
  }
  if (climateMapStarted) return;
  climateMapStarted = true;
  if (!window.L) {
    $("#mapFallback").hidden = false;
    return;
  }

  climateMap = L.map("climateMap", {
    zoomControl: true,
    attributionControl: true,
    minZoom: 8,
    maxZoom: 17
  });

  let tileErrors = 0;
  L.tileLayer(CARTO_DARK_TILE_URL, {
    subdomains: "abcd",
    maxZoom: 20,
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO"
  })
    .on("tileload", () => {
      tileErrors = 0;
      $("#mapFallback").hidden = true;
    })
    .on("tileerror", () => {
      tileErrors += 1;
      if (tileErrors > 8) $("#mapFallback").hidden = false;
    })
    .addTo(climateMap);

  state.locations.forEach(location => {
    const marker = L.marker([location.lat, location.lon], {
      icon: createMarkerIcon(location),
      riseOnHover: true,
      keyboard: true,
      title: location.name
    }).addTo(climateMap);
    climateMarkers.set(location.id, marker);
  });

  const bounds = L.latLngBounds(state.locations.map(location => [location.lat, location.lon]));
  climateMap.fitBounds(bounds, { padding: [70, 70], maxZoom: 11 });
  renderMapMarkers();
  setTimeout(() => {
    climateMap.invalidateSize();
    climateMap.fitBounds(bounds, { padding: [70, 70], maxZoom: 11 });
  }, 220);
}

function getScenarioSaving() {
  return safeNumber($("#savingSlider")?.value, 10);
}

function getMarkerMetric(location) {
  if (state.mapLayer === "co2") {
    const value = location.atmosphere.co2;
    return {
      value,
      display: value.toFixed(1),
      unit: "ppm CO₂",
      label: "Atmospheric CO₂",
      tone: value < 427 ? "emerald" : value <= 430 ? "amber" : "orange"
    };
  }
  if (state.mapLayer === "air") {
    const value = location.atmosphere.aqi;
    return {
      value,
      display: Math.round(value),
      unit: "US AQI",
      label: "Air quality",
      tone: value <= 50 ? "emerald" : value <= 100 ? "amber" : "orange"
    };
  }

  const saving = ["elmina-west", "elmina-east"].includes(location.id) ? getScenarioSaving() / 100 : 0;
  const value = location.baselineKwh * (1 - saving) * FACTOR;
  return {
    value,
    display: Math.round(value),
    unit: "kg CO₂e/home",
    label: "Household scenario",
    tone: value < 225 ? "emerald" : value <= 255 ? "amber" : "orange"
  };
}

function createMarkerIcon(location) {
  const metric = getMarkerMetric(location);
  return L.divIcon({
    className: "climate-div-icon",
    html: markerHtml(location, metric),
    iconSize: [140, 140],
    iconAnchor: [70, 70],
    popupAnchor: [0, -40]
  });
}

function markerHtml(location, metric) {
  return `<div class="glow-marker marker-${location.id} tone-${metric.tone}">
    <span class="marker-halo"></span>
    <span class="marker-core"><strong>${metric.display}</strong><small>${metric.unit}</small></span>
    <span class="marker-name">${location.name}</span>
  </div>`;
}

function markerPopup(location, metric) {
  const source = location.live ? "Live Open-Meteo / CAMS model" : "Fallback demonstration data";
  return `<strong>${location.name}</strong><br>${metric.label}: ${metric.display} ${metric.unit}<br>
    <small>PM2.5 ${location.atmosphere.pm25.toFixed(1)} µg/m³ · CO ${Math.round(location.atmosphere.co)} µg/m³<br>${source}</small>`;
}

function renderMapMarkers() {
  const scopeValues = state.locations.map(location => {
    const saving = ["elmina-west", "elmina-east"].includes(location.id) ? getScenarioSaving() / 100 : 0;
    return location.baselineKwh * (1 - saving) * FACTOR;
  });
  $("#mapAverageCarbon").textContent = Math.round(scopeValues.reduce((sum, value) => sum + value, 0) / scopeValues.length);

  if (!climateMap) return;
  state.locations.forEach(location => {
    const marker = climateMarkers.get(location.id);
    const metric = getMarkerMetric(location);
    const iconRoot = marker?.getElement()?.querySelector(".glow-marker");
    if (iconRoot) {
      iconRoot.className = `glow-marker marker-${location.id} tone-${metric.tone}`;
      $(".marker-core strong", iconRoot).textContent = metric.display;
      $(".marker-core small", iconRoot).textContent = metric.unit;
    } else if (marker) {
      marker.setIcon(createMarkerIcon(location));
    }
    marker?.bindPopup(markerPopup(location, metric));
  });
}

function setMapLayer(layer) {
  state.mapLayer = layer;
  $$("[data-map-layer]").forEach(button => button.classList.toggle("active", button.dataset.mapLayer === layer));
  const descriptions = {
    scope: "Illustrative household electricity footprint using the disclosed 0.740 grid factor.",
    co2: "Regional atmospheric CO₂ model estimates at approximately 11 km resolution.",
    air: "Live US AQI with carbon monoxide and PM2.5 context from CAMS ENSEMBLE."
  };
  const legends = {
    scope: [["Low / <225", "emerald"], ["225–255", "amber"], ["High / >255", "orange"]],
    co2: [["<427 ppm", "emerald"], ["427–430", "amber"], [">430 ppm", "orange"]],
    air: [["Good / ≤50", "emerald"], ["Moderate", "amber"], ["Unhealthy", "orange"]]
  };
  $("#mapLayerDescription").textContent = descriptions[layer];
  $("#mapLegend").innerHTML = legends[layer].map(([label, tone]) => `<span><i class="legend-${tone}"></i>${label}</span>`).join("");
  renderMapMarkers();
}

function renderClimateCards() {
  const elminaWest = state.locations.find(location => location.id === "elmina-west");
  const delta = (state.globalCo2 / PREINDUSTRIAL_CO2 - 1) * 100;
  $("#globalCo2Value").textContent = state.globalCo2.toFixed(1);
  $("#globalCo2Delta").textContent = `+${delta.toFixed(1)}%`;
  $("#globalDataTag").textContent = state.globalLive ? "Live feed" : "Fallback";
  $("#liveAqi").textContent = Math.round(elminaWest.atmosphere.aqi);
  $("#livePm25").textContent = elminaWest.atmosphere.pm25.toFixed(1);
  $("#airDataTag").textContent = elminaWest.live ? "Live model" : "Fallback";
  $("#liveTemperature").textContent = state.weather.temperature.toFixed(1);
  $("#liveHumidity").textContent = Math.round(state.weather.humidity);
}

function renderTimeline(index) {
  const selectedIndex = Math.max(0, Math.min(3, Number(index)));
  const item = { ...TIMELINE[selectedIndex] };
  if (selectedIndex >= 2) item.ppm = state.globalCo2;
  if (selectedIndex === 2) {
    item.comparison = `+${(item.ppm - PREINDUSTRIAL_CO2).toFixed(1)} ppm from 1850`;
  }
  $("#timelineSlider").value = selectedIndex;
  $("#timelineYear").textContent = item.year;
  $("#timelineBadge").textContent = item.badge;
  $("#timelineTitle").textContent = item.title;
  $("#timelineDescription").textContent = item.description;
  $("#timelinePpm").textContent = item.ppm.toFixed(1);
  $("#timelineComparison").textContent = item.comparison;
  $("#timelineAssets").style.opacity = selectedIndex === 0 ? ".38" : selectedIndex === 1 ? ".7" : "1";
  $$("[data-timeline-index]").forEach(button => button.classList.toggle("active", Number(button.dataset.timelineIndex) === selectedIndex));
}

function renderScenario() {
  const households = Number($("#householdSlider").value);
  const percent = Number($("#savingSlider").value);
  const perHome = 300 * (percent / 100);
  const savedKwh = households * perHome;
  const tonnes = savedKwh * FACTOR / 1000;
  const treeEquivalent = tonnes * 1000 / TREE_ABSORPTION_KG_MONTH;
  const treeProgress = treeEquivalent / 1450 * 100;

  $("#householdOutput").textContent = formatNumber(households);
  $("#savingOutput").textContent = `${percent}%`;
  $("#savedKwh").textContent = `${formatNumber(savedKwh)} kWh`;
  $("#savedCarbon").textContent = tonnes.toFixed(2);
  $("#annualCarbon").textContent = `${(tonnes * 12).toFixed(2)} t CO₂e`;
  $("#scenarioHouseholds").textContent = `${formatNumber(households)} homes`;
  $("#scenarioPerHome").textContent = `${formatNumber(perHome)} kWh saved`;
  $("#treeEquivalent").textContent = `${formatNumber(treeEquivalent)} trees`;
  $("#treeProgressLabel").textContent = `${Math.round(treeProgress)}%`;
  $("#treeProgressBar").style.width = `${Math.min(100, treeProgress)}%`;
  renderMapMarkers();
}

function openModal(modal) {
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  setTimeout(() => $("input,button", modal)?.focus(), 50);
}

function closeModal(modal) {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function showToast() {
  const toast = $("#toast");
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3800);
}

$$(".nav-item").forEach(item => item.addEventListener("click", () => navigate(item.dataset.view)));
$$('[data-nav-to]').forEach(item => item.addEventListener("click", () => navigate(item.dataset.navTo)));

$("#menuButton").addEventListener("click", () => {
  const open = $("#sidebar").classList.toggle("open");
  $("#menuButton").setAttribute("aria-expanded", String(open));
});

$$('[data-open-bill]').forEach(button => button.addEventListener("click", () => openModal($("#billModal"))));
$$('[data-close-modal]').forEach(button => button.addEventListener("click", () => closeModal($("#billModal"))));
$("#privacyButton").addEventListener("click", () => openModal($("#privacyModal")));
$$('[data-close-privacy]').forEach(button => button.addEventListener("click", () => closeModal($("#privacyModal"))));

$("#billFile").addEventListener("change", event => {
  const file = event.target.files[0];
  if (!file) return;
  $("#uploadTitle").textContent = file.name;
  $("#uploadHint").textContent = "Demo scan complete · suggested value ready for your confirmation";
});

$("#confirmBill").addEventListener("click", () => {
  const value = Number($("#kwhInput").value);
  if (!Number.isFinite(value) || value < 1 || value > 3000) {
    $("#formError").textContent = "Enter a valid value between 1 and 3,000 kWh.";
    return;
  }
  state.kwh = Math.round(value);
  localStorage.setItem("carbonpulse-kwh", state.kwh);
  $("#formError").textContent = "";
  renderEnergy();
  closeModal($("#billModal"));
  showToast();
});

$$('.action-check').forEach(button => button.addEventListener("click", () => {
  const id = button.closest(".plan-card").dataset.actionId;
  state.completed = state.completed.includes(id) ? state.completed.filter(item => item !== id) : [...state.completed, id];
  renderActions();
}));

$$('.tip-toggle').forEach(button => button.addEventListener("click", () => button.closest(".plan-card").classList.toggle("tip-open")));
[$("#householdSlider"), $("#savingSlider")].forEach(input => input.addEventListener("input", renderScenario));
$("#timelineSlider").addEventListener("input", event => renderTimeline(event.target.value));
$$('[data-timeline-index]').forEach(button => button.addEventListener("click", () => renderTimeline(button.dataset.timelineIndex)));
$$('[data-map-layer]').forEach(button => button.addEventListener("click", () => setMapLayer(button.dataset.mapLayer)));

document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  $$(".modal.open").forEach(closeModal);
  $("#sidebar").classList.remove("open");
});

renderEnergy();
renderActions();
renderClimateCards();
renderScenario();
renderTimeline(2);
loadClimateData();
const initialView = window.location.hash.slice(1);
if (["overview", "energy", "actions", "precinct", "learn"].includes(initialView)) navigate(initialView);
