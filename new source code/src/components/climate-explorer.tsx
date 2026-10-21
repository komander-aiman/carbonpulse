"use client";

import { useState } from "react";
import { ClimateMap } from "@/components/climate-map";
import { ClimateTimeline } from "@/components/climate-timeline";
import { CommunityWhatIf } from "@/components/community-what-if";
import type { ClimateSnapshot } from "@/domain/climate/types";
import type { FactorVersion } from "@/domain/carbon/types";

/**
 * Owns the reduction percentage so the what-if slider and the map markers read
 * the same value, matching the prototype's single-source behaviour.
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
      <div className="live-data-state" data-state={snapshot.liveCount > 0 ? "live" : "fallback"}>
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
            : `${snapshot.liveCount}/${snapshot.precincts.length} precinct feeds connected`}
        </span>
      </div>

      <ClimateMap snapshot={snapshot} factor={factor} reductionPct={reductionPct} isDemo={isDemo} />

      <section className="climate-simulator">
        <div className="simulator-intro">
          <span className="eyebrow">Macro-to-micro simulator</span>
          <h2>Travel through the climate story, then test a community response.</h2>
          <p>
            Global atmospheric concentration provides context. Household electricity scenarios show where residents
            can act.
          </p>
        </div>

        <ClimateTimeline livePpm={snapshot.globalCo2Ppm} />

        <div
          onInput={(event) => {
            const target = event.target as HTMLInputElement;
            if (target.id === "whatifSaving") setReductionPct(Number(target.value));
          }}
        >
          <CommunityWhatIf factor={factor} />
        </div>
      </section>
    </>
  );
}
