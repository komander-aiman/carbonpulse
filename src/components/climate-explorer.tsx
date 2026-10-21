"use client";

import { ClimatePanel } from "@/components/climate-map";
import type { ClimateSnapshot } from "@/domain/climate/types";
import type { FactorVersion } from "@/domain/carbon/types";

/**
 * Climate context is intentionally separate from the zone map (D9): it carries
 * no household numbers, no choropleth, and no second map implementation.
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
  return <ClimatePanel snapshot={snapshot} factor={factor} isDemo={isDemo} />;
}
