"use client";

import { useActionState, useMemo, useState } from "react";
import { scenario, formatScenario, MAX_SCENARIO_HOUSEHOLDS } from "@/domain/community";
import type { FactorVersion } from "@/domain/carbon/types";
import { sharedGoalCopy } from "@/domain/shared-goal";
import { SUPPRESSION_COPY } from "@/domain/zone";
import { setConsent } from "@/app/energy/upload/actions";
import type { CommunityViewModel } from "@/lib/community-view";
import { ElminaMap } from "@/components/elmina-map";
import { EvidenceTag } from "@/components/evidence";
import { formatKwh } from "@/lib/format";

export function ScenarioPanel({
  factor,
  community,
  useDemo,
}: {
  factor: FactorVersion;
  community: CommunityViewModel;
  useDemo: boolean;
}) {
  const zone = community.zone;
  const cohortCount = zone.suppressed ? null : zone.householdCount;
  const cohortMedian = zone.suppressed ? null : zone.medianKwh;

  const [households, setHouseholds] = useState(cohortCount ?? 200);
  const [reduction, setReduction] = useState(10);
  const [baseline, setBaseline] = useState(cohortMedian ?? 300);
  const [presetNote, setPresetNote] = useState<string | null>(null);

  const result = useMemo(
    () =>
      scenario({
        households,
        reductionPct: reduction,
        baselineKwh: baseline,
        factor,
        cohortHouseholds: cohortCount,
      }),
    [households, reduction, baseline, factor, cohortCount],
  );
  const text = formatScenario(result);
  const activeDots = Math.round((Math.min(households, 2000) / 2000) * 50);

  return (
    <>
      <div className="scenario-layout">
        <article className="scenario-control">
          <span className="eyebrow light">Try a scenario</span>
          <h2>If participating households used less electricity each month…</h2>

          <label htmlFor="householdSlider">
            <span>Households in this scenario</span>
            <output id="householdOutput" htmlFor="householdSlider">
              {households}
            </output>
          </label>
          <input
            type="range"
            id="householdSlider"
            min={10}
            max={MAX_SCENARIO_HOUSEHOLDS}
            step={10}
            value={households}
            onChange={(event) => setHouseholds(Number(event.target.value))}
          />
          <div className="range-labels">
            <span>10</span>
            <span>2,000</span>
          </div>

          <label htmlFor="savingSlider">
            <span>Average reduction per household</span>
            <output id="savingOutput" htmlFor="savingSlider">
              {reduction}%
            </output>
          </label>
          <input
            type="range"
            id="savingSlider"
            min={1}
            max={25}
            step={1}
            value={reduction}
            onChange={(event) => setReduction(Number(event.target.value))}
          />
          <div className="range-labels">
            <span>1%</span>
            <span>25%</span>
          </div>

          <label htmlFor="baselineSlider">
            <span>Assumed baseline per household</span>
            <output id="baselineOutput" htmlFor="baselineSlider">
              {baseline} kWh
            </output>
          </label>
          <input
            type="range"
            id="baselineSlider"
            min={150}
            max={600}
            step={5}
            value={baseline}
            onChange={(event) => setBaseline(Number(event.target.value))}
          />
          <div className="range-labels">
            <span>150 kWh</span>
            <span>600 kWh</span>
          </div>

          <div className="scenario-assumption">
            Assumes a {baseline} kWh monthly baseline per household and the {factor.kgPerKwh.toFixed(3)} factor
            {cohortMedian
              ? `, defaulted from the zone median of ${cohortMedian} kWh`
              : ", because the zone is too small to publish a median"}
            .{result.exceedsCohort ? " Includes households beyond the current zone cohort." : ""}
          </div>

          <div className="button-row" style={{ marginTop: 20 }}>
            <button
              className="outline-button small-button"
              type="button"
              onClick={() => {
                setHouseholds(cohortCount ?? 200);
                setReduction(10);
                setBaseline(cohortMedian ?? 300);
                setPresetNote(null);
              }}
            >
              Reset to defaults
            </button>
          </div>
          {presetNote ? (
            <p className="small" style={{ color: "#a9c3b8", marginTop: 10 }}>
              {presetNote}
            </p>
          ) : null}
        </article>

        <article className="scenario-result">
          <div className="scenario-visual" id="householdDots" aria-hidden="true">
            {Array.from({ length: 50 }, (_, index) => (
              <i key={index} className={index < activeDots ? "active" : ""} />
            ))}
          </div>
          <div className="scenario-kicker">Combined monthly scenario</div>
          <div className="scenario-big">
            <strong id="savedKwh">{text.savedKwh}</strong>
            <span>kWh less</span>
          </div>
          <div className="scenario-equation">
            <span id="scenarioHouseholds">{result.households} households</span>
            <b>×</b>
            <span id="scenarioPerHome">{text.perHomeKwh} kWh each</span>
          </div>
          <div className="result-grid">
            <div>
              <span>Scenario emissions difference</span>
              <strong id="savedCarbon">{text.savedTonnes}</strong>
            </div>
            <div>
              <span>Annualised, if sustained for 12 months</span>
              <strong id="annualCarbon">{text.annualTonnes}</strong>
            </div>
          </div>
          <p>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 8v6m0-10v.2" />
            </svg>
            Scenario only, labelled Scenario throughout. It is not a forecast, a projection, or a measured community
            outcome, and it never enters historical totals or zone aggregates.
          </p>
          <div style={{ marginTop: 18 }}>
            <EvidenceTag label="Scenario" />
          </div>
        </article>
      </div>

      <section className="panel section-gap">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Shared goal</span>
            <h2>{community.sharedGoal.suppressed ? SUPPRESSION_COPY : `${community.sharedGoal.progressPct}% of the way`}</h2>
          </div>
          <EvidenceTag label="Recorded" />
        </div>
        <p className="small muted">{sharedGoalCopy(community.sharedGoal)}</p>
        {community.sharedGoal.suppressed ? null : (
          <>
            <div
              className="goal-progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={community.sharedGoal.progressPct}
              aria-label="Shared goal progress"
            >
              <span style={{ width: `${community.sharedGoal.progressPct}%` }} />
            </div>
            <ul className="result-list">
              <li>
                <span>Reference period</span>
                <strong>{formatKwh(community.sharedGoal.referenceKwh)} kWh</strong>
              </li>
              <li>
                <span>Current period</span>
                <strong>{formatKwh(community.sharedGoal.currentKwh)} kWh</strong>
              </li>
              <li>
                <span>Shared target</span>
                <strong>{formatKwh(community.sharedGoal.targetKwh)} kWh</strong>
              </li>
            </ul>
          </>
        )}
        <p className="source-note">
          The shared goal is the sum of each consenting household&rsquo;s own 10% target. It is a target for the next
          period, not a claim about what was saved.
        </p>
      </section>

      <div className="demo-toggle-row">
        <div className="consent-row">
          <span>
            <b>Demo cohort · {useDemo ? "on" : "off"}</b>
            <small>
              A separate namespace of 128 seeded households. It is never mixed into a real zone and can never change a
              real median. Turning it off shows the honest &ldquo;not enough data yet&rdquo; state.
            </small>
          </span>
          <a
            className={useDemo ? "secondary-button small-button" : "primary-button small-button"}
            href={useDemo ? "/community" : "/community?demo=true"}
            role="switch"
            aria-checked={useDemo}
          >
            {useDemo ? "Turn demo off" : "Show demo cohort"}
          </a>
        </div>
      </div>

      <ElminaMap
        community={community}
        onSelectZone={(name, median) => {
          if (median === null) {
            setPresetNote(`${name} is below the disclosure threshold, so no preset is available.`);
            return;
          }
          setBaseline(median);
          setPresetNote(`${name} median applied as a scenario preset. This is still a scenario, not a measurement.`);
        }}
      />
    </>
  );
}

export function ConsentToggle({ granted, isDemo }: { granted: boolean; isDemo: boolean }) {
  const [state, action, pending] = useActionState(
    async (_prev: { message: string; ok: boolean } | null, formData: FormData) => {
      const next = formData.get("granted") === "true";
      return setConsent(next);
    },
    null,
  );
  const [local, setLocal] = useState(granted);

  return (
    <form
      action={(formData) => {
        setLocal(formData.get("granted") === "true");
        return action(formData);
      }}
    >
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Consent</span>
          <h2>{local ? "Your zone counts you" : "You are not counted"}</h2>
        </div>
        <EvidenceTag label={local ? "Recorded" : "Estimated"} />
      </div>
      <p className="small muted">
        {local
          ? "Your monthly kWh, zone, and period may contribute to zone statistics. Nothing else is shared, and no individual value is ever published."
          : "Your records stay private and do not contribute to zone statistics. You can still read everything the zone publishes — consent gates contribution, not viewing."}
      </p>
      <input type="hidden" name="granted" value={local ? "false" : "true"} />
      <div className="button-row">
        <button className={local ? "danger-button" : "primary-button"} type="submit" disabled={pending}>
          {pending ? "Saving…" : local ? "Withdraw consent" : "Share my monthly kWh"}
        </button>
      </div>
      <p className="small muted" style={{ marginTop: 10 }}>
        {isDemo
          ? "Demo households are excluded from real aggregates regardless of this setting."
          : "Withdrawal takes effect at the next aggregate rebuild, within one hour."}
      </p>
      {state?.message ? (
        <p className={state.ok ? "form-success" : "form-error"} role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
