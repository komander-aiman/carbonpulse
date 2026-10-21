import type { Metadata } from "next";
import { EvidenceRow } from "@/components/evidence";
import { ActionList } from "./action-list";
import { currentHousehold } from "@/lib/current-household";
import { buildActionsViewModel } from "@/lib/view-model";
import { formatKwh } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Action plan" };

export default async function ActionsPage() {
  const data = await currentHousehold();
  const view = buildActionsViewModel(data);
  const circumference = 2 * Math.PI * 39;
  const progress = Math.min(1, view.completedPercent / 100);

  return (
    <>
      <div className="page-heading compact-heading">
        <div>
          <span className="eyebrow">Action plan</span>
          <h1>{view.targetKwh > 0 ? `Your simplest route to ${view.targetKwh} kWh.` : "Your simplest next steps."}</h1>
          <p>
            {view.actions.length} practical actions, ranked by estimated CO₂e reduction per unit of effort for your
            household profile.
          </p>
        </div>
        <div className="plan-score">
          <strong>{view.completedPercent}%</strong>
          <span>plan complete</span>
        </div>
      </div>

      <EvidenceRow />

      <ActionList actions={view.actions} />

      <div className="plan-footer">
        <div>
          <span className="eyebrow light">Your target</span>
          <strong>
            {view.potential.low}–{Math.round(view.potential.cappedHigh)} kWh
          </strong>
          <p>
            potential monthly reduction from this plan
            {view.potential.capped
              ? ` · capped at 35% of your ${formatKwh(view.baselineKwh)} kWh baseline`
              : ""}
          </p>
          <p style={{ marginTop: 8 }}>
            Completing an action records intent. It never reports a measured saving; savings are only described when a
            later recorded period is lower, and then as an association.
          </p>
        </div>
        <div className="target-ring" aria-hidden="true">
          <svg viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="39" />
            <circle
              className="ring-progress"
              cx="50"
              cy="50"
              r="39"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
            />
          </svg>
          <span>
            <b>{view.targetKwh || "—"}</b> kWh
            <br />
            goal
          </span>
        </div>
      </div>

      <section className="panel section-gap">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">How ranking works</span>
            <h2>Reduction per unit of effort, not the biggest headline</h2>
          </div>
        </div>
        <p className="small muted">
          Each action carries a versioned evidence range, which is multiplied by the same factor version used for your
          estimate. Actions are sorted by the midpoint saving divided by effort; ties break by action id so the order is
          deterministic. Your plan potential is the sum of the listed actions, capped at 35% of your baseline, and the
          cap is disclosed above whenever it applies.
        </p>
        <p className="small muted">
          Baseline for this ranking: <strong>{formatKwh(view.baselineKwh)} kWh</strong> (your latest confirmed period).
          Household archetype: <span className="mono">{data.household.archetype}</span>.
        </p>
      </section>
    </>
  );
}
