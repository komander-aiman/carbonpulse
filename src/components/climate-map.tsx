"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker, TileLayer } from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  averageScopeKg,
  layerCopy,
  markerMetric,
  PILOT_PRECINCT_IDS,
  type MapLayer,
} from "@/domain/climate";
import type { ClimateSnapshot } from "@/domain/climate/types";
import { MALAYSIA_BOUNDS } from "@/domain/climate/types";
import type { FactorVersion } from "@/domain/carbon/types";

type Theme = "dark" | "light";
type Extent = "townships" | "malaysia";

const ESRI_TILES: Record<Theme, { base: string; reference: string }> = {
  dark: {
    base: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    reference:
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
  },
  light: {
    base: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    reference:
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
  },
};

const LAYERS: { id: MapLayer; label: string }[] = [
  { id: "scope", label: "Household footprint" },
  { id: "co2", label: "Atmospheric CO₂" },
  { id: "air", label: "Air quality & CO" },
];

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function markerHtml(name: string, id: string, display: string, unit: string, tone: string): string {
  return `<div class="glow-marker marker-${escapeHtml(id)} tone-${escapeHtml(tone)}">
    <span class="marker-halo"></span>
    <span class="marker-core"><strong>${escapeHtml(display)}</strong><small>${escapeHtml(unit)}</small></span>
    <span class="marker-name">${escapeHtml(name)}</span>
  </div>`;
}

/**
 * Township climate map. Three layers: the household footprint estimate, the
 * atmospheric CO2 model estimate, and regional air quality. Every value is a
 * model estimate or a labelled fallback, never a measurement, and the
 * household layer is explicitly an estimate rather than a Scope 3 inventory.
 */
export function ClimateMap({
  snapshot,
  factor,
  reductionPct,
  isDemo,
}: {
  snapshot: ClimateSnapshot;
  factor: FactorVersion;
  reductionPct: number;
  isDemo: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const tilesRef = useRef<TileLayer[]>([]);
  const [ready, setReady] = useState(false);
  const [tileFailed, setTileFailed] = useState(false);
  const [layer, setLayer] = useState<MapLayer>("scope");
  const [theme, setTheme] = useState<Theme>("dark");
  const [extent, setExtent] = useState<Extent>("townships");

  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;
    const markers = markersRef.current;

    (async () => {
      const leaflet = await import("leaflet");
      if (cancelled || !containerRef.current) return;
      const L = leaflet.default ?? leaflet;

      map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: true,
        minZoom: 4,
        maxZoom: 17,
        worldCopyJump: true,
      });
      mapRef.current = map;
      setReady(true);

      window.setTimeout(() => {
        map?.invalidateSize();
      }, 220);
    })();

    return () => {
      cancelled = true;
      for (const marker of markers.values()) marker.remove();
      markers.clear();
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    let cancelled = false;

    (async () => {
      const leaflet = await import("leaflet");
      if (cancelled) return;
      const L = leaflet.default ?? leaflet;

      for (const tile of tilesRef.current) map.removeLayer(tile);
      tilesRef.current = [];

      let errors = 0;
      const urls = ESRI_TILES[theme];
      const attach = (tileLayer: TileLayer) => {
        tileLayer
          .on("tileload", () => {
            errors = 0;
            setTileFailed(false);
          })
          .on("tileerror", () => {
            errors += 1;
            if (errors > 8) setTileFailed(true);
          })
          .addTo(map);
        tilesRef.current.push(tileLayer);
      };

      attach(L.tileLayer(urls.base, { maxZoom: 20, attribution: "Tiles © Esri, HERE, Garmin, OSM contributors" }));
      attach(L.tileLayer(urls.reference, { maxZoom: 20 }));
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, theme]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    let cancelled = false;

    (async () => {
      const leaflet = await import("leaflet");
      if (cancelled) return;
      const L = leaflet.default ?? leaflet;

      for (const precinct of snapshot.precincts) {
        const metric = markerMetric(precinct, layer, reductionPct, factor);
        const icon = L.divIcon({
          className: "climate-div-icon",
          html: markerHtml(precinct.name, precinct.id, metric.display, metric.unit, metric.tone),
          iconSize: [140, 140],
          iconAnchor: [70, 70],
          popupAnchor: [0, -40],
        });

        const source = precinct.live ? "Live Open-Meteo / CAMS model estimate" : "Labelled fallback data";
        const popup = `<strong>${escapeHtml(precinct.name)}</strong><br>${escapeHtml(metric.label)}: ${escapeHtml(
          metric.display,
        )} ${escapeHtml(metric.unit)}<br><small>PM2.5 ${precinct.atmosphere.pm25Ugm3.toFixed(
          1,
        )} µg/m³ · CO ${Math.round(precinct.atmosphere.coMg)} µg/m³<br>${escapeHtml(source)}</small>`;

        const existing = markersRef.current.get(precinct.id);
        if (existing) {
          existing.setIcon(icon);
          existing.setPopupContent(popup);
        } else {
          const marker = L.marker([precinct.lat, precinct.lon], {
            icon,
            riseOnHover: true,
            keyboard: true,
            title: precinct.name,
            alt: `${precinct.name}: ${metric.label} ${metric.display} ${metric.unit}`,
          })
            .addTo(map)
            .bindPopup(popup)
            .bindTooltip(`${precinct.name} · ${metric.label}`);
          markersRef.current.set(precinct.id, marker);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, snapshot, factor, reductionPct, layer]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;

    (async () => {
      const leaflet = await import("leaflet");
      const L = leaflet.default ?? leaflet;
      if (extent === "malaysia") {
        map.fitBounds(L.latLngBounds(MALAYSIA_BOUNDS as unknown as [number, number][]), {
          padding: [70, 70],
          maxZoom: 11,
        });
      } else {
        const points = snapshot.precincts.map((p) => [p.lat, p.lon] as [number, number]);
        map.fitBounds(L.latLngBounds(points), { padding: [35, 35] });
      }
    })();
  }, [ready, extent, snapshot]);

  const copy = layerCopy(layer, factor);
  const average = Math.round(averageScopeKg(snapshot.precincts, reductionPct, factor));

  return (
    <section className="climate-section" aria-labelledby="climateMapHeading">
      <div className={`climate-map-card${theme === "light" ? " light-map" : ""}`}>
        <div className="map-title-block">
          <span className="map-kicker">City of Elmina · regional context</span>
          <h2 id="climateMapHeading">Township climate pulse</h2>
          <p id="mapLayerDescription">{copy.description}</p>
        </div>

        <div className="map-layer-switcher" role="group" aria-label="Map data layer">
          {LAYERS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={layer === entry.id ? "active" : undefined}
              aria-pressed={layer === entry.id}
              onClick={() => setLayer(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <div className="map-display-controls" role="group" aria-label="Map appearance and extent">
          <button
            type="button"
            aria-pressed={extent === "malaysia"}
            onClick={() => setExtent(extent === "malaysia" ? "townships" : "malaysia")}
          >
            {extent === "malaysia" ? "Township view" : "Malaysia view"}
          </button>
          <button
            type="button"
            aria-pressed={theme === "light"}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} map`}
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            <span aria-hidden="true">◐</span>
            <b>{theme === "light" ? "Dark map" : "Light map"}</b>
          </button>
        </div>

        <div
          id="climateMap"
          ref={containerRef}
          role="application"
          aria-label="Interactive map of five townships. The table below lists the same values."
        />

        <div className="map-legend" id="mapLegend">
          {copy.legend.map((entry) => (
            <span key={entry.label}>
              <i className={`legend-${entry.tone}`} aria-hidden="true" />
              {entry.label}
            </span>
          ))}
        </div>

        <div className="map-weather-chip">
          <span className="weather-glyph" aria-hidden="true">
            ☼
          </span>
          <div>
            <small>Elmina West microclimate</small>
            <strong>
              <b>{snapshot.weather.temperatureC.toFixed(1)}</b>°C
            </strong>
            <em>
              {snapshot.weather.live
                ? `Open-Meteo model · ${snapshot.weather.time?.split("T")[1]?.slice(0, 5) ?? "—"} MYT`
                : "Labelled fallback data"}
            </em>
          </div>
          <div>
            <small>Humidity</small>
            <strong>
              <b>{Math.round(snapshot.weather.humidity)}</b>%
            </strong>
          </div>
        </div>

        {tileFailed ? (
          <div className="map-fallback" id="mapFallback" role="status">
            <strong>Basemap unavailable</strong>
            <span>Live cards and the scenario sliders still work. The table below carries the same values.</span>
          </div>
        ) : null}
      </div>

      <div className="climate-metric-grid">
        <article>
          <div className="climate-metric-head">
            <span>Global atmosphere</span>
            <em>{snapshot.globalLive ? "Live feed" : "Fallback"}</em>
          </div>
          <strong>
            <b>{snapshot.globalCo2Ppm.toFixed(1)}</b>
            <small>ppm CO₂</small>
          </strong>
          <p>
            <span>+{((snapshot.globalCo2Ppm / 278 - 1) * 100).toFixed(1)}%</span> from the 278 ppm pre-industrial
            reference
          </p>
        </article>
        <article>
          <div className="climate-metric-head">
            <span>Elmina West air quality</span>
            <em>{snapshot.precincts[0]?.live ? "Live model" : "Fallback"}</em>
          </div>
          <strong>
            <b>{Math.round(snapshot.precincts[0]?.atmosphere.aqi ?? 0)}</b>
            <small>US AQI</small>
          </strong>
          <p>
            <span>{snapshot.precincts[0]?.atmosphere.pm25Ugm3.toFixed(1) ?? "—"}</span> µg/m³ PM2.5 · regional CAMS
            estimate
          </p>
        </article>
        <article>
          <div className="climate-metric-head">
            <span>Household estimate</span>
            <em>Estimated</em>
          </div>
          <strong>
            <b>{average}</b>
            <small>kg CO₂e/home</small>
          </strong>
          <p>
            Five illustrative township baselines · {factor.kgPerKwh.toFixed(3)} kg CO₂e/kWh
          </p>
        </article>
      </div>

      <div className="table-wrap" tabIndex={0} role="region" aria-label="Township values table">
        <table>
          <caption>
            Same values as the map.{" "}
            {isDemo
              ? "Demo mode: all feeds use recorded fallbacks."
              : `${snapshot.liveCount} of ${snapshot.precincts.length} township feeds live.`}
          </caption>
          <thead>
            <tr>
              <th scope="col">Township</th>
              <th scope="col" className="numeric">
                Household estimate
              </th>
              <th scope="col" className="numeric">
                Atmospheric CO₂
              </th>
              <th scope="col" className="numeric">
                US AQI
              </th>
              <th scope="col">Feed</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.precincts.map((precinct) => {
              const scene = markerMetric(precinct, "scope", reductionPct, factor);
              return (
                <tr key={precinct.id}>
                  <th scope="row">{precinct.name}</th>
                  <td className="numeric">
                    {scene.display} {scene.unit}
                  </td>
                  <td className="numeric">{precinct.atmosphere.co2Ppm.toFixed(1)} ppm</td>
                  <td className="numeric">{Math.round(precinct.atmosphere.aqi)}</td>
                  <td>{precinct.live ? "Live model" : "Fallback"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="climate-source-note">
        <span>Data notes</span>
        <span>
          Atmospheric and weather feeds: Open-Meteo with CAMS ENSEMBLE; global CO₂: Global Warming API. Values fall back
          to labelled demo data when a feed is unavailable. The household layer is an estimate from illustrative
          baselines, not a Scope 3 inventory result. Only {PILOT_PRECINCT_IDS.length} pilot townships (Elmina West and
          East) respond to the slider, and this map carries no household-level location.
        </span>
      </p>
    </section>
  );
}
