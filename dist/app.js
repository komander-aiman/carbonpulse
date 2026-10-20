const FACTOR = 0.740;
const BASELINE_KWH = 300;
const TARGET_KWH = Math.round(BASELINE_KWH * 0.90);
const AUGUST_KWH = 326;
const APRIL_KWH = 343;
const PREINDUSTRIAL_CO2 = 278.0;
const TREE_ABSORPTION_KG_MONTH = 2.17;
const CARTO_TILE_URLS = {
  dark: "https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png",
  light: "https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png"
};
const ESRI_TILE_URLS = {
  dark: {
    base: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    reference: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
  },
  light: {
    base: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    reference: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
  }
};
const MALAYSIA_BOUNDS = [[0.65, 99.0], [7.85, 119.8]];
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
  kwh: Number(localStorage.getItem("carbonpulse-kwh")) || BASELINE_KWH,
  completed: JSON.parse(localStorage.getItem("carbonpulse-actions") || '["temperature"]'),
  mapLayer: "scope",
  mapTheme: localStorage.getItem("carbonpulse-map-theme") === "light" ? "light" : "dark",
  mapExtent: "townships",
  globalCo2: 427.4,
  globalLive: false,
  weather: { temperature: 31.2, humidity: 72, time: null, live: false },
  locations: PRECINCTS.map(location => ({
    ...location,
    atmosphere: { ...location.fallback },
    live: false
  }))
};

let climateMap;
let climateMapStarted = false;
let climateBasemapVersion = 0;
let climateBasemapLayers = [];
const climateMarkers = new Map();

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const formatNumber = value => new Intl.NumberFormat("en-MY", { maximumFractionDigits: 0 }).format(value);
const safeNumber = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const formatFeedTime = value => {
  const time = typeof value === "string" ? value.split("T")[1]?.slice(0, 5) : "";
  return time ? `${time} MYT` : "time unavailable";
};

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

function renderLineChart() {
  const values = [...BASE_USAGE, state.kwh];
  const xPositions = [40, 166, 292, 418, 544, 670];
  const valueMin = Math.min(...values);
  const valueMax = Math.max(...values);
  const padding = Math.max(10, (valueMax - valueMin) * 0.15);
  const domainMin = Math.max(0, valueMin - padding);
  const domainMax = valueMax + padding;
  const yFor = value => 30 + ((domainMax - value) / Math.max(1, domainMax - domainMin)) * 195;
  const points = values.map((value, index) => `${xPositions[index]},${yFor(value).toFixed(1)}`);
  const linePath = points.map((point, index) => `${index ? "L" : "M"}${point}`).join(" ");

  $("#chartLine").setAttribute("d", linePath);
  $("#chartArea").setAttribute("d", `${linePath} L670,225 L40,225 Z`);
  $$("#chartPoints circle").forEach((circle, index) => circle.setAttribute("cy", yFor(values[index]).toFixed(1)));
}

function getActionSavings() {
  return {
    temperature: {
      min: Math.max(4, Math.round(state.kwh * 0.04)),
      max: Math.max(6, Math.round(state.kwh * 0.06))
    },
    timer: {
      min: Math.max(3, Math.round(state.kwh * 0.027)),
      max: Math.max(5, Math.round(state.kwh * 0.04))
    },
    standby: {
      min: Math.max(2, Math.round(state.kwh * 0.01)),
      max: Math.max(3, Math.round(state.kwh * 0.017))
    }
  };
}

function getCombinedPotential(savings, actionIds = ["temperature", "timer", "standby"]) {
  const included = new Set(actionIds);
  let total = included.has("standby") ? savings.standby.max : 0;
  const hasTemperature = included.has("temperature");
  const hasTimer = included.has("timer");

  if (hasTemperature && hasTimer) {
    total += Math.round((savings.temperature.max + savings.timer.max) * 0.8);
  } else {
    if (hasTemperature) total += savings.temperature.max;
    if (hasTimer) total += savings.timer.max;
  }
  return total;
}

function formatPercentChange(percent) {
  if (Math.abs(percent) < 0.05) return "0.0%";
  return `${percent > 0 ? "+" : "−"}${Math.abs(percent).toFixed(1)}%`;
}

function renderEnergy() {
  const emissions = state.kwh * FACTOR;
  $$('[data-kwh]').forEach(el => el.textContent = formatNumber(state.kwh));
  $$('[data-emissions]').forEach(el => el.textContent = emissions.toFixed(1));
  $$('[data-kwh-unit]').forEach(el => el.textContent = `${formatNumber(state.kwh)} kWh`);
  $$('[data-emissions-unit]').forEach(el => el.textContent = `${emissions.toFixed(1)} kg CO₂e`);
  $("#kwhInput").value = state.kwh;
  $("#emissionsBar").style.width = `${Math.min(100, emissions / 3)}%`;
  $("#goalTarget").textContent = TARGET_KWH;
  const targetProgress = clamp(((BASELINE_KWH - state.kwh) / (BASELINE_KWH - TARGET_KWH)) * 100, 0, 100);
  $("#goalBar").style.width = `${targetProgress}%`;
  const gap = Math.max(0, state.kwh - TARGET_KWH);
  $("#goalGap").textContent = gap ? `${formatNumber(gap)} kWh` : "Goal reached";
  $("#goalGapSuffix").textContent = gap ? " to go · target is 10% lower" : " · fixed 10% reduction target";

  const augustDifference = state.kwh - AUGUST_KWH;
  const augustPercent = augustDifference / AUGUST_KWH * 100;
  const usageTrend = $("#usageTrend");
  usageTrend.classList.toggle("good", augustDifference < 0);
  usageTrend.classList.toggle("bad", augustDifference > 0);
  usageTrend.classList.toggle("neutral", augustDifference === 0);
  $("#usageTrendPercent").textContent = augustDifference === 0
    ? "→ 0.0%"
    : `${augustDifference < 0 ? "↓" : "↑"} ${Math.abs(augustPercent).toFixed(1)}%`;
  const differenceText = augustDifference === 0
    ? "Same usage as August"
    : `${formatNumber(Math.abs(augustDifference))} kWh ${augustDifference < 0 ? "less" : "more"} than August`;
  $("#usageTrendComparison").textContent = differenceText;
  $("#usageTrendNote").textContent = augustDifference === 0
    ? "Your usage matches the August demo baseline."
    : `That is ${formatNumber(Math.abs(augustDifference))} kWh ${augustDifference < 0 ? "less" : "more"} than the August demo baseline.`;
  $("#heroDifference").textContent = `${formatNumber(Math.abs(augustDifference))} kWh`;
  $("#heroDifferenceDirection").textContent = augustDifference === 0 ? "same" : augustDifference < 0 ? "less" : "more";

  const aprilPercent = (state.kwh - APRIL_KWH) / APRIL_KWH * 100;
  $("#overviewTrendPercent").textContent = formatPercentChange(aprilPercent);
  renderBarChart();
  renderLineChart();
}

function renderActions() {
  const savings = getActionSavings();
  Object.entries(savings).forEach(([id, range]) => {
    $(`#${id}Saving`).textContent = `${range.min}–${range.max}`;
  });
  $("#overviewActionPotential").textContent = `${savings.temperature.min}–${savings.temperature.max} kWh / month`;
  $("#combinedPotential").textContent = `Up to ${getCombinedPotential(savings)} kWh`;
  $("#actionPlanHeading").textContent = `Your simplest route to ${TARGET_KWH} kWh.`;
  const usageBand = state.kwh < 250 ? "Low" : state.kwh <= 350 ? "Typical" : "High Cooling Load";
  $("#actionPlanSubtitle").textContent = `${usageBand} household profile · illustrative savings scale with your confirmed monthly usage.`;

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
  const gap = Math.max(0, state.kwh - TARGET_KWH);
  const completedPotential = getCombinedPotential(savings, state.completed);
  const reductionProgress = gap === 0 ? 100 : clamp(completedPotential / gap * 100, 0, 100);
  const circumference = 2 * Math.PI * 39;
  $(".ring-progress").style.strokeDashoffset = `${circumference * (1 - reductionProgress / 100)}`;
  $("#targetRingLabel").innerHTML = gap
    ? `<b>${formatNumber(gap)}</b> kWh<br>goal`
    : "<b>Reached</b><br>goal";
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
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${location.lat}&longitude=${location.lon}&current=us_aqi,pm2_5,carbon_monoxide,carbon_dioxide&hourly=carbon_dioxide&timezone=Asia%2FKuala_Lumpur`;
    return fetchJson(url).then(data => ({ type: "air", id: location.id, data }));
  });
  const weatherRequest = fetchJson("https://api.open-meteo.com/v1/forecast?latitude=3.1890&longitude=101.5090&current=temperature_2m,relative_humidity_2m&timezone=Asia%2FKuala_Lumpur")
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
      const hasCompleteLiveReading = ["carbon_dioxide", "us_aqi", "carbon_monoxide", "pm2_5"]
        .every(field => Number.isFinite(Number(current[field])));
      location.atmosphere = {
        co2: safeNumber(current.carbon_dioxide, location.fallback.co2),
        aqi: safeNumber(current.us_aqi, location.fallback.aqi),
        co: safeNumber(current.carbon_monoxide, location.fallback.co),
        pm25: safeNumber(current.pm2_5, location.fallback.pm25)
      };
      location.time = current.time || null;
      location.live = hasCompleteLiveReading;
      if (hasCompleteLiveReading) liveAirCount += 1;
    }
    if (payload.type === "weather" && payload.data?.current) {
      const current = payload.data.current;
      const isLive = ["temperature_2m", "relative_humidity_2m"]
        .every(field => Number.isFinite(Number(current[field])));
      state.weather = {
        temperature: safeNumber(current.temperature_2m, state.weather.temperature),
        humidity: safeNumber(current.relative_humidity_2m, state.weather.humidity),
        time: current.time || null,
        live: isLive
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
  status.classList.remove("live", "fallback");
  status.classList.add(fullyLive ? "live" : "fallback");
  status.innerHTML = fullyLive
    ? "<i></i><span><b>Live model feeds connected</b>Open-Meteo + CAMS context</span>"
    : `<i></i><span><b>${liveAirCount ? "Partial live data" : "Fallback data active"}</b>${liveAirCount}/5 precinct feeds connected</span>`;
  renderClimateCards();
  renderTimeline(Number($("#timelineSlider").value));
  renderMapMarkers();
}

function updateMapDisplayControls() {
  const isLight = state.mapTheme === "light";
  const themeButton = $("#mapThemeToggle");
  $(".climate-map-card")?.classList.toggle("light-map", isLight);
  if (themeButton) {
    themeButton.setAttribute("aria-pressed", String(isLight));
    themeButton.setAttribute("aria-label", `Switch to ${isLight ? "dark" : "light"} map`);
    $("#mapThemeLabel").textContent = isLight ? "Dark map" : "Light map";
  }

  const extentButton = $("#mapExtentToggle");
  if (extentButton) {
    const isMalaysia = state.mapExtent === "malaysia";
    extentButton.setAttribute("aria-pressed", String(isMalaysia));
    extentButton.textContent = isMalaysia ? "Township view" : "Malaysia view";
  }
}

function clearClimateBasemapLayers() {
  climateBasemapLayers.forEach(layer => {
    if (climateMap?.hasLayer(layer)) climateMap.removeLayer(layer);
  });
  climateBasemapLayers = [];
}

function applyClimateBasemap(theme) {
  if (!climateMap) return;
  state.mapTheme = theme === "light" ? "light" : "dark";
  localStorage.setItem("carbonpulse-map-theme", state.mapTheme);
  updateMapDisplayControls();

  const requestVersion = ++climateBasemapVersion;
  const mapFallback = $("#mapFallback");
  const cartoKey = typeof window.CARBONPULSE_CARTO_KEY === "string"
    ? window.CARBONPULSE_CARTO_KEY.trim()
    : "";
  clearClimateBasemapLayers();
  mapFallback.hidden = true;

  const addLayer = layer => {
    climateBasemapLayers.push(layer);
    layer.addTo(climateMap);
    return layer;
  };

  const addEsriFallback = () => {
    if (requestVersion !== climateBasemapVersion) return;
    clearClimateBasemapLayers();
    let tileErrors = 0;
    const monitorTileLayer = layer => layer
      .on("tileload", () => {
        if (requestVersion !== climateBasemapVersion) return;
        tileErrors = 0;
        mapFallback.hidden = true;
      })
      .on("tileerror", () => {
        if (requestVersion !== climateBasemapVersion) return;
        tileErrors += 1;
        if (tileErrors > 8) mapFallback.hidden = false;
      });
    const urls = ESRI_TILE_URLS[state.mapTheme];

    addLayer(monitorTileLayer(L.tileLayer(urls.base, {
      maxZoom: 20,
      attribution: "Tiles &copy; Esri, HERE, Garmin, OpenStreetMap contributors and the GIS user community"
    })));
    addLayer(monitorTileLayer(L.tileLayer(urls.reference, { maxZoom: 20 })));
  };

  if (!cartoKey) {
    addEsriFallback();
    return;
  }

  let cartoErrors = 0;
  let fallbackStarted = false;
  const cartoLayer = L.tileLayer(`${CARTO_TILE_URLS[state.mapTheme]}?key=${encodeURIComponent(cartoKey)}`, {
    maxZoom: 20,
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO"
  })
    .on("tileload", () => {
      if (requestVersion !== climateBasemapVersion) return;
      cartoErrors = 0;
      mapFallback.hidden = true;
    })
    .on("tileerror", () => {
      if (requestVersion !== climateBasemapVersion || fallbackStarted) return;
      cartoErrors += 1;
      if (cartoErrors <= 8) return;
      fallbackStarted = true;
      addEsriFallback();
    });
  addLayer(cartoLayer);
}

function setMapExtent(extent) {
  state.mapExtent = extent === "malaysia" ? "malaysia" : "townships";
  updateMapDisplayControls();
  if (!climateMap) return;

  const bounds = state.mapExtent === "malaysia"
    ? L.latLngBounds(MALAYSIA_BOUNDS)
    : L.latLngBounds(state.locations.map(location => [location.lat, location.lon]));
  const options = state.mapExtent === "malaysia"
    ? { padding: [35, 35] }
    : { padding: [70, 70], maxZoom: 11 };
  climateMap.fitBounds(bounds, options);
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
    minZoom: 4,
    maxZoom: 17,
    worldCopyJump: true
  });

  applyClimateBasemap(state.mapTheme);

  state.locations.forEach(location => {
    const marker = L.marker([location.lat, location.lon], {
      icon: createMarkerIcon(location),
      riseOnHover: true,
      keyboard: true,
      title: location.name
    }).addTo(climateMap);
    climateMarkers.set(location.id, marker);
  });

  setMapExtent("townships");
  renderMapMarkers();
  setTimeout(() => {
    climateMap.invalidateSize();
    setMapExtent(state.mapExtent);
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
  $("#weatherDataTag").textContent = state.weather.live
    ? `Open-Meteo model · ${formatFeedTime(state.weather.time)}`
    : "Fallback demonstration data";
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
  $("#uploadHint").textContent = "Reference file attached locally · please confirm or enter your billed kWh below";
});

$("#loadSampleBill").addEventListener("click", () => {
  $("#kwhInput").value = 270;
  $("#uploadHint").textContent = "Sample 270 kWh value loaded for demonstration — click Confirm & analyse";
  $("#formError").textContent = "";
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
  renderActions();
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
$("#mapThemeToggle").addEventListener("click", () => {
  applyClimateBasemap(state.mapTheme === "dark" ? "light" : "dark");
});
$("#mapExtentToggle").addEventListener("click", () => {
  setMapExtent(state.mapExtent === "townships" ? "malaysia" : "townships");
});

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
updateMapDisplayControls();
loadClimateData();
const initialView = window.location.hash.slice(1);
if (["overview", "energy", "actions", "precinct", "learn"].includes(initialView)) navigate(initialView);
