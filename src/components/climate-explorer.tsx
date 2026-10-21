"use client";

import { useState } from "react";
import { ClimateMap } from "@/components/climate-map";
import { ClimateTimeline } from "@/components/climate-timeline";
import type { ClimateSnapshot } from "@/domain/climate/types";
import type { FactorVersion } from "@/domain/carbon/types";

/**
 * Owns the reduction percentage so the scenario slider and the map markers read
 * the same value. Climate context is regional; the household layer on the map
 * is an estimate from illustrative baselines, not a measured township figure.
 */
export function ClimateExplorer({
  snapshot,
  factor,
  isDemo,
}: {
  snapshot: ClimateSnapshot;
  factor: FactorVersion;
  isDemo: boolean;
}) {
  const [reductionPct, setReductionPct] = useState(10);

  return (
    <>
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
            : `${snapshot.liveCount}/${snapshot.precincts.length} township feeds connected`}
        </span>
      </div>

      <ClimateMap snapshot={snapshot} factor={factor} reductionPct={reductionPct} isDemo={isDemo} />

      <section className="panel section-gap">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Map scenario</span>
            <h2>Move the household layer on the map</h2>
          </div>
        </div>
        <label htmlFor="climateReduction">
          <span>Average reduction per household</span>
          <output htmlFor="climateReduction">{reductionPct}%</output>
        </label>
        <input
          id="climateReduction"
          type="range"
          min={1}
          max={25}
          step={1}
          value={reductionPct}
          onChange={(event) => setReductionPct(Number(event.target.value))}
          aria-describedby="climateReductionHint"
        />
        <div className="range-labels climate-range-labels">
          <span>1%</span>
          <span>25%</span>
        </div>
        <small className="field-hint" id="climateReductionHint">
          This moves the household layer only. It is a scenario, not a forecast, and it never changes the zone
          statistics, the shared goal, or anything consent-gated.
        </small>
      </section>

      <section className="section-gap" aria-labelledby="timelineHeading">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">1850–2030</span>
            <h2 id="timelineHeading">Macro context, kept separate from your footprint</h2>
          </div>
        </div>
        <ClimateTimeline livePpm={snapshot.globalCo2Ppm} />
        <p className="climate-source-note">
          <span>Data notes</span>
          <span>
            SDP programme figures are context. They are never deducted from a household estimate, and no household
            estimate is credited to that programme target.
          </span>
        </p>
      </section>
    </>
  );
}
