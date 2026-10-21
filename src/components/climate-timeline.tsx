"use client";

import { useState } from "react";
import { timeline } from "@/domain/climate";

const ASSETS = [
  { value: "30,100", label: "ERT trees planted since 2011" },
  { value: "1,450", label: "Elmina Biodiversity Corridor trees" },
  { value: "603 kWp", label: "SDP rooftop solar context" },
  { value: "−40%", label: "2030 Scope 1 & 2 target" },
];

/**
 * Macro-to-micro timeline. The 2030 entry deliberately holds the live
 * concentration rather than drawing a forecast: the cap is a portfolio target,
 * not a ppm projection.
 */
export function ClimateTimeline({ livePpm }: { livePpm: number }) {
  const [index, setIndex] = useState(2);
  const entries = timeline(livePpm);
  const entry = entries[index] ?? entries[2]!;

  return (
    <article className="timeline-panel">
      <div className="timeline-copy">
        <div className="timeline-year">
          <span id="timelineYear">{entry.year}</span>
          <em id="timelineBadge">{entry.badge}</em>
        </div>
        <h3 id="timelineTitle">{entry.title}</h3>
        <p id="timelineDescription">{entry.description}</p>
      </div>

      <div className="timeline-reading">
        <small>Global atmospheric CO₂</small>
        <strong>
          <b id="timelinePpm">{entry.ppm.toFixed(1)}</b> ppm
        </strong>
        <span id="timelineComparison">{entry.comparison}</span>
      </div>

      <div className="timeline-control">
        <input
          type="range"
          id="timelineSlider"
          min={0}
          max={3}
          value={index}
          step={1}
          aria-label="Climate timeline year"
          onChange={(event) => setIndex(Number(event.target.value))}
        />
        <div className="timeline-stops">
          {entries.map((stop, stopIndex) => (
            <button
              key={stop.year}
              type="button"
              data-timeline-index={stopIndex}
              className={stopIndex === index ? "active" : undefined}
              aria-pressed={stopIndex === index}
              onClick={() => setIndex(stopIndex)}
            >
              {stop.year}
              <small>{stop.badge.replace("Live context", "Live").replace("SDP baseline", "SDP baseline")}</small>
            </button>
          ))}
        </div>
      </div>

      <div
        className="timeline-assets"
        id="timelineAssets"
        style={{ opacity: index === 0 ? 0.38 : index === 1 ? 0.7 : 1 }}
      >
        {ASSETS.map((asset) => (
          <div key={asset.label}>
            <strong>{asset.value}</strong>
            <span>{asset.label}</span>
          </div>
        ))}
      </div>

      <p className="timeline-caution">
        Programme figures are shown as context and are not automatically deducted from household estimates.
      </p>
    </article>
  );
}
