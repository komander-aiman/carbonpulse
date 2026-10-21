"use client";

import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { CommunityViewModel } from "@/lib/community-view";
import { ELMINA_BOUNDARY, ELMINA_CENTRE, POIS, SUBZONES } from "@/db/geo";
import { MAP_STYLE_URL } from "@/lib/config";
import { formatKwh } from "@/lib/format";
import { SUPPRESSION_COPY } from "@/domain/zone";

function bandColour(medianKwh: number, overall: number | null): string {
  if (overall === null) return "#cfd8d2";
  const ratio = medianKwh / overall;
  if (ratio < 0.92) return "#cfe8b8";
  if (ratio > 1.08) return "#f3c9a6";
  return "#dcebdd";
}

export function ElminaMap({
  community,
  onSelectZone,
}: {
  community: CommunityViewModel;
  onSelectZone: (name: string, median: number | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const callbackRef = useRef(onSelectZone);
  const dataRef = useRef(community);

  useEffect(() => {
    callbackRef.current = onSelectZone;
    dataRef.current = community;
  }, [onSelectZone, community]);

  useEffect(() => {
    let cancelled = false;
    let map: import("maplibre-gl").Map | null = null;
    let popup: import("maplibre-gl").Popup | null = null;
    let removeKeyDown: (() => void) | null = null;

    (async () => {
      try {
        const maplibregl = await import("maplibre-gl");
        if (cancelled || !containerRef.current) return;

        // Bundling rewrites import.meta.url, so MapLibre's default worker lookup
        // points beside a hashed chunk and fails silently. The prebuild step
        // copies the worker into public/; point at it explicitly.
        maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        map = new maplibregl.Map({
          container: containerRef.current,
          style: MAP_STYLE_URL,
          center: [ELMINA_CENTRE[0], ELMINA_CENTRE[1]],
          zoom: 13.2,
          attributionControl: { compact: true },
          fadeDuration: reduced ? 0 : 300,
        });
        popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true, offset: 10 });
        const activeMap = map;

        activeMap.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

        activeMap.on("error", () => {
          if (!cancelled) setStatus((current) => (current === "ready" ? current : "failed"));
        });

        activeMap.on("load", () => {
          if (cancelled || !activeMap.isStyleLoaded()) return;
          setStatus("ready");

          const stats = dataRef.current;
          const medianOverall = stats.zone.suppressed ? null : stats.zone.medianKwh;

          activeMap.addSource("zones", {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: SUBZONES.map((subzone) => {
                const stat = stats.zones.find((entry) => entry.id === subzone.id);
                const suppressed = !stat || stat.result.suppressed;
                const median = stat && !stat.result.suppressed ? stat.result.medianKwh : 0;
                return {
                  type: "Feature",
                  properties: {
                    id: subzone.id,
                    name: subzone.name,
                    suppressed,
                    median,
                    fill: suppressed ? "#c9d2cc" : bandColour(median, medianOverall),
                  },
                  geometry: subzone.geojson.geometry,
                };
              }),
            },
          });

          activeMap.addLayer({
            id: "zone-fill",
            type: "fill",
            source: "zones",
            paint: { "fill-color": ["get", "fill"], "fill-opacity": 0.55 },
          });

          activeMap.addLayer({
            id: "zone-outline",
            type: "line",
            source: "zones",
            paint: { "line-color": "#4f6c60", "line-width": 1, "line-opacity": 0.5 },
          });

          activeMap.addSource("boundary", {
            type: "geojson",
            data: ELMINA_BOUNDARY as unknown as GeoJSON.GeoJSON,
          });
          activeMap.addLayer({
            id: "boundary-line",
            type: "line",
            source: "boundary",
            paint: { "line-color": "#176351", "line-width": 2.5, "line-dasharray": [2, 2] },
          });

          activeMap.addSource("pois", {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: POIS.map((poi) => ({
                type: "Feature",
                properties: { name: poi.name, category: poi.category },
                geometry: { type: "Point", coordinates: [poi.coordinates[0], poi.coordinates[1]] },
              })),
            },
          });
          activeMap.addLayer({
            id: "poi-dots",
            type: "circle",
            source: "pois",
            paint: {
              "circle-radius": 5,
              "circle-color": "#195143",
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 1.5,
            },
          });

          activeMap.on("mouseenter", "zone-fill", () => {
            activeMap.getCanvas().style.cursor = "pointer";
          });
          activeMap.on("mouseleave", "zone-fill", () => {
            activeMap.getCanvas().style.cursor = "";
          });
          activeMap.on("click", "zone-fill", (event) => {
            const feature = event.features?.[0];
            if (!feature || !popup) return;
            const props = feature.properties as {
              name: string;
              suppressed: boolean | string;
              median: number;
            };
            const suppressed = props.suppressed === true || props.suppressed === "true";
            const text = suppressed
              ? SUPPRESSION_COPY
              : `Median ${formatKwh(Number(props.median))} kWh`;
            popup
              .setLngLat(event.lngLat)
              .setHTML(`<strong></strong><span></span>`)
              .addTo(activeMap);
            const element = popup.getElement();
            if (element) {
              const strong = element.querySelector("strong");
              const span = element.querySelector("span");
              if (strong) strong.textContent = props.name;
              if (span) span.textContent = text;
            }
            callbackRef.current(props.name, suppressed ? null : Number(props.median));
          });

          activeMap.on("click", "poi-dots", (event) => {
            const feature = event.features?.[0];
            if (!feature || !popup) return;
            popup
              .setLngLat(event.lngLat)
              .setHTML(`<strong></strong><span></span>`)
              .addTo(activeMap);
            const element = popup.getElement();
            if (element) {
              const strong = element.querySelector("strong");
              const span = element.querySelector("span");
              if (strong) strong.textContent = String(feature.properties?.name ?? "Point of interest");
              if (span) span.textContent = String(feature.properties?.category ?? "");
            }
          });

          const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") popup?.remove();
          };
          document.addEventListener("keydown", onKeyDown);
          removeKeyDown = () => document.removeEventListener("keydown", onKeyDown);
        });
      } catch {
        if (!cancelled) setStatus("failed");
      }
    })();

    return () => {
      cancelled = true;
      // The listener was registered inside an async load callback, so it must
      // be torn down there too; otherwise every remount leaks a handler that
      // still holds the old map and popup.
      removeKeyDown?.();
      popup?.remove();
      map?.remove();
    };
  }, []);

  return (
    <section className={`map-shell${community.isDemoData ? " demo-boundary" : ""}`} aria-labelledby="mapHeading">
      <div className="panel-heading" style={{ padding: "18px 20px 0" }}>
        <div>
          <span className="eyebrow">Indicative boundary</span>
          <h2 id="mapHeading">Zone shading and the shared goal</h2>
        </div>
        <span className={`evidence-tag ${community.isDemoData ? "demo" : "cached"}`}>
          {community.isDemoData ? "Demo" : "OSM-derived"}
        </span>
      </div>

      {status === "failed" ? (
        <div className="map-fallback" role="status">
          <div>
            <strong>The map tiles could not load.</strong>
            <br />
            The zone shapes are still available as the table below. Nothing about your household is drawn on this map,
            with or without tiles.
          </div>
        </div>
      ) : (
        <div
          className="map-canvas"
          ref={containerRef}
          role="application"
          aria-label="Map of the indicative Elmina boundary with zone aggregates and public points of interest"
        />
      )}

      <div className="map-legend">
        <span>
          <i style={{ background: "#cfe8b8" }} aria-hidden="true" /> Lower than your zone median
        </span>
        <span>
          <i style={{ background: "#dcebdd" }} aria-hidden="true" /> Around the median
        </span>
        <span>
          <i style={{ background: "#f3c9a6" }} aria-hidden="true" /> Higher than your zone median
        </span>
        <span>
          <i style={{ background: "#c9d2cc" }} aria-hidden="true" /> Not enough data yet
        </span>
        <span>
          <i style={{ background: "#195143", borderRadius: "50%" }} aria-hidden="true" /> Public point of interest
        </span>
      </div>

      <div className="attribution">
        Boundary and points of interest: © OpenStreetMap contributors, ODbL. Boundary is an indicative OSM-derived
        approximation (way 866543395), not a gazetted township boundary. Tiles: OpenFreeMap © OpenMapTiles.
      </div>

      <div style={{ padding: "0 20px 20px" }}>
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Scrollable table">
          <table>
            <caption>Zone aggregates, the keyboard-accessible equivalent of the map</caption>
            <thead>
              <tr>
                <th scope="col">Zone</th>
                <th scope="col" className="numeric">
                  Households
                </th>
                <th scope="col" className="numeric">
                  Median kWh
                </th>
                <th scope="col" className="numeric">
                  IQR kWh
                </th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {community.zones.map((zone) => (
                <tr key={zone.id}>
                  <th scope="row">{zone.name}</th>
                  {zone.result.suppressed ? (
                    <>
                      <td className="numeric">—</td>
                      <td className="numeric">—</td>
                      <td className="numeric">—</td>
                      <td>{SUPPRESSION_COPY}</td>
                    </>
                  ) : (
                    <>
                      <td className="numeric">{zone.result.householdCount}</td>
                      <td className="numeric">{formatKwh(zone.result.medianKwh)}</td>
                      <td className="numeric">
                        {zone.result.p25Kwh}–{zone.result.p75Kwh}
                      </td>
                      <td>Published</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="source-note">
          Zones are grid cells split from the OSM boundary, not inferred from household addresses. Counts and kWh are
          rounded to 5. No household coordinates are stored or rendered.
        </p>
      </div>
    </section>
  );
}
