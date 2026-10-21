"use client";

import { layerCopy, markerMetric, PILOT_PRECINCT_IDS, TIMELINE_BASE, averageScopeKg } from "@/domain/climate";
import type { ClimateSnapshot } from "@/domain/climate/types";
import type { FactorVersion } from "@/domain/carbon/types";

/**
 * Climate context panel. There is one map in the product (the MapLibre zone map
 * on the community page), so this panel carries no map and no household layer:
 * atmospheric, air-quality, and weather context, all labelled as regional model
 * estimates, plus the SDP programme figures as context only.
 */
export function ClimatePanel({
  snapshot,
  factor,
  isDemo,
}: {
  snapshot: ClimateSnapshot;
  factor: FactorVersion;
  isDemo: boolean;
}) {
  const copy = layerCopy("co2", factor);
  const average = averageScopeKg(snapshot.precincts, 0, factor);
  const first = snapshot.precincts[0];

  return (
    <section className="panel climate-panel" aria-labelledby="climateHeading">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Climate context</span>
          <h2 id="climateHeading">The atmosphere around the pilot, not a household reading</h2>
        </div>
        <span className={`evidence-tag ${isDemo ? "demo" : first?.live ? "live" : "cached"}`}>
          {isDemo ? "Fallback" : first?.live ? "Live model" : "Cached"}
        </span>
      </div>

      <div className="live-data-state" data-state={snapshot.liveCount > 0 && !isDemo ? "live" : "fallback"}>
        <i aria-hidden="true" />
        <span>
          <b>
            {isDemo
              ? "Demo mode · recorded fallbacks"
              : snapshot.liveCount === snapshot.precincts.length
                ? "Live model feeds connected"
                : snapshot.liveCount > 0
                  ? "Partial live data"
                  : "Fallback data active"}
          </b>
          {isDemo
            ? "No external calls are made while demo mode is on"
            : `${snapshot.liveCount}/${snapshot.precincts.length} regional feeds connected`}
        </span>
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
            <span>Elmina air quality</span>
            <em>{first?.live ? "Live model" : "Fallback"}</em>
          </div>
          <strong>
            <b>{Math.round(first?.atmosphere.aqi ?? 0)}</b>
            <small>US AQI</small>
          </strong>
          <p>
            <span>{first?.atmosphere.pm25Ugm3.toFixed(1) ?? "—"}</span> µg/m³ PM2.5 · regional CAMS estimate
          </p>
        </article>
        <article>
          <div className="climate-metric-head">
            <span>Local conditions</span>
            <em>{snapshot.weather.live ? "Live model" : "Fallback"}</em>
          </div>
          <strong>
            <b>{snapshot.weather.temperatureC.toFixed(1)}</b>
            <small>°C</small>
          </strong>
          <p>
            <span>{Math.round(snapshot.weather.humidity)}%</span> humidity · Open-Meteo model estimate
          </p>
        </article>
      </div>

      <p className="small muted">{copy.description}</p>

      <div className="table-wrap" tabIndex={0} role="region" aria-label="Regional climate values table">
        <table>
          <caption>
            Regional model estimates, not township sensors.{" "}
            {isDemo
              ? "Demo mode: all feeds use recorded fallbacks."
              : `${snapshot.liveCount} of ${snapshot.precincts.length} feeds live.`}
          </caption>
          <thead>
            <tr>
              <th scope="col">Location</th>
              <th scope="col" className="numeric">
                Atmospheric CO₂
              </th>
              <th scope="col" className="numeric">
                US AQI
              </th>
              <th scope="col" className="numeric">
                PM2.5
              </th>
              <th scope="col">Feed</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.precincts.map((precinct) => {
              const co2 = markerMetric(precinct, "co2", 0, factor);
              return (
                <tr key={precinct.id}>
                  <th scope="row">{precinct.name}</th>
                  <td className="numeric">{co2.display} ppm</td>
                  <td className="numeric">{Math.round(precinct.atmosphere.aqi)}</td>
                  <td className="numeric">{precinct.atmosphere.pm25Ugm3.toFixed(1)} µg/m³</td>
                  <td>{precinct.live ? "Live model" : "Fallback"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="timeline-cards" style={{ marginTop: 18 }}>
        <div className="panel-heading">
          <div>
            <span className="eyebrow">1850–2030</span>
            <h2>Macro context, kept separate from your footprint</h2>
          </div>
        </div>
        <dl className="definition-grid">
          {TIMELINE_BASE.map((entry) => (
            <div key={entry.year}>
              <dt>
                {entry.year} · {entry.badge}
              </dt>
              <dd>
                {entry.title}. {entry.description}
              </dd>
            </div>
          ))}
        </dl>
        <p className="source-note">
          SDP programme figures are context. They are never deducted from a household estimate, and no household
          estimate is credited to that programme target. Household scenario reference: {Math.round(average)} kg
          CO₂e/home under the {factor.kgPerKwh.toFixed(3)} factor. Only {PILOT_PRECINCT_IDS.length} pilot areas are part
          of the pilot.
        </p>
      </div>

      <p className="climate-source-note">
        <span>Data notes</span>
        <span>
          Atmospheric and weather feeds: Open-Meteo with CAMS ENSEMBLE; global CO₂: Global Warming API. Values fall back
          to labelled demo data when a feed is unavailable. There is no township sensor and no household number on
          this panel. Weather data by Open-Meteo.com.
        </span>
      </p>
    </section>
  );
}
