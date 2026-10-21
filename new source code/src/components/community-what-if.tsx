"use client";

import { useMemo, useState } from "react";
import { scenario, formatScenario } from "@/domain/community";
import type { FactorVersion } from "@/domain/carbon/types";

/** Monthly CO₂e absorbed by one mature tree, from the reference implementation. */
const TREE_ABSORPTION_KG_MONTH = 2.17;
const CORRIDOR_TREES = 1450;

/**
 * Community what-if. Deliberately separate from the precinct cohort: these
 * inputs never enter a stored statistic, and the result is labelled Scenario.
 */
export function CommunityWhatIf({ factor }: { factor: FactorVersion }) {
  const [households, setHouseholds] = useState(200);
  const [reduction, setReduction] = useState(10);

  const result = useMemo(
    () => scenario({ households, reductionPct: reduction, baselineKwh: 300, factor }),
    [households, reduction, factor],
  );
  const text = formatScenario(result);

  const treeEquivalent = (result.savedKg / TREE_ABSORPTION_KG_MONTH);
  const treeProgress = (treeEquivalent / CORRIDOR_TREES) * 100;

  return (
    <div className="whatif-grid">
      <article className="whatif-controls">
        <span className="eyebrow light">Community what-if</span>
        <h3>How far could shared energy savings move the pulse?</h3>

        <label htmlFor="whatifHouseholds">
          <span>Participating Elmina homes</span>
          <output id="whatifHouseholdsOutput" htmlFor="whatifHouseholds">
            {households}
          </output>
        </label>
        <input
          type="range"
          id="whatifHouseholds"
          min={200}
          max={2000}
          value={households}
          step={100}
          onChange={(event) => setHouseholds(Number(event.target.value))}
        />
        <div className="range-labels">
          <span>200 homes</span>
          <span>2,000 homes</span>
        </div>

        <label htmlFor="whatifSaving">
          <span>Average energy saved</span>
          <output id="whatifSavingOutput" htmlFor="whatifSaving">
            {reduction}%
          </output>
        </label>
        <input
          type="range"
          id="whatifSaving"
          min={0}
          max={20}
          value={reduction}
          step={1}
          onChange={(event) => setReduction(Number(event.target.value))}
        />
        <div className="range-labels">
          <span>0%</span>
          <span>20%</span>
        </div>

        <p>
          Assumes 300 kWh per home each month and applies the same {factor.kgPerKwh.toFixed(3)} kg CO₂e/kWh factor.
        </p>
      </article>

      <article className="whatif-result">
        <span className="scenario-label">Illustrative scenario</span>
        <div className="whatif-primary">
          <strong id="whatifCarbon">{text.savedTonnes.replace(" t CO₂e", "")}</strong>
          <span>
            t CO₂e less
            <br />
            each month
          </span>
        </div>
        <div className="whatif-equation">
          <span>{households.toLocaleString("en-MY")} homes</span>
          <b>×</b>
          <span>{Math.round(result.perHomeKwh)} kWh saved</span>
          <b>×</b>
          <span>{factor.kgPerKwh.toFixed(3)} factor</span>
        </div>
        <div className="whatif-stats">
          <div>
            <span>Energy avoided</span>
            <strong>{text.savedKwh} kWh</strong>
          </div>
          <div>
            <span>Annualised scenario</span>
            <strong id="whatifAnnual">{text.annualTonnes}</strong>
          </div>
          <div>
            <span>Tree-month equivalent</span>
            <strong>{Math.round(treeEquivalent).toLocaleString("en-MY")} trees</strong>
          </div>
        </div>
        <div className="corridor-progress">
          <div>
            <span>Compared with {CORRIDOR_TREES.toLocaleString("en-MY")} Elmina corridor trees</span>
            <b>{Math.round(treeProgress)}%</b>
          </div>
          <i>
            <span style={{ width: `${Math.min(100, treeProgress)}%` }} />
          </i>
          <small>
            Uses an illustrative {TREE_ABSORPTION_KG_MONTH} kg CO₂e absorbed per tree/month assumption. Not a verified
            offset credit.
          </small>
        </div>
      </article>
    </div>
  );
}
