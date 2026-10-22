import Link from "next/link";
import { NextStepCompleteButton } from "@/app/journey/next-step-complete";
import { EvidenceTag } from "@/components/evidence";
import type { JourneyViewModel } from "@/lib/view-model";
import type { JourneyEvent, NormalisedPeriod } from "@/domain/journey";
import {
  emissionsComparisonCopy,
  observedChangeCopy,
} from "@/domain/journey";
import { formatKwh, formatKg, formatDate, formatShortDate, formatMonthShort } from "@/lib/format";

function GoalBadge({ label }: { label: "Provisional" | "Confirmed" }) {
  return (
    <span className={`evidence-tag ${label === "Confirmed" ? "recorded" : "estimated"}`}>{label}</span>
  );
}

export function NextStepCard({ view }: { view: JourneyViewModel }) {
  const step = view.nextStep;
  const action = step.actionId
    ? view.openActions.find((candidate) => candidate.id === step.actionId) ?? null
    : null;

  return (
    <article className="journey-next panel" data-action-id={view.nextStep.actionId ?? undefined}>
      <div className="journey-next-top">
        <span className="eyebrow light">Your next step</span>
        <span className="evidence-tag practical">Practical</span>
      </div>
      <h2>{step.title}</h2>
      <p>{step.body}</p>
      {action ? (
        <p className="journey-next-meta">
          First open action in your plan · effort {action.effort}/3 · evidence{" "}
          <span className="mono">{action.evidenceVersion}</span>
        </p>
      ) : null}
      <div className="journey-next-actions">
        <Link className="light-button" href={step.href}>
          {step.kind === "enter_first_bill"
            ? "Add your first bill"
            : step.kind === "review_plan"
              ? "Review your plan"
              : "Open this action"}
          <span aria-hidden="true">→</span>
        </Link>
        {step.kind === "action" && action ? <NextStepCompleteButton actionId={action.id} /> : null}
        {step.kind === "review_plan" ? (
          <Link className="outline-button compact" href="/energy/upload">
            Add the next bill
          </Link>
        ) : null}
      </div>
    </article>
  );
}

const EVENT_ICON: Record<JourneyEvent["kind"], string> = {
  bill: "M7 3h10v18l-2.5-1.6L12 21l-2.5-1.6L7 21V3Zm3 5h4m-4 4h4",
  milestone: "m12 3 2.4 5.2 5.6.7-4.1 3.9 1.1 5.6-5-2.8-5 2.8 1.1-5.6L4 9l5.6-.7L12 3Z",
  action: "M5 13l4 4L19 7",
};

function TimelineEntry({ event }: { event: JourneyEvent }) {
  if (event.kind === "bill") {
    const period = event.period;
    return (
      <li className="journey-event bill-event">
        <span className="journey-marker" aria-hidden="true">
          <svg viewBox="0 0 24 24">{EVENT_ICON.bill}</svg>
        </span>
        <div className="journey-event-body">
          <div className="journey-event-head">
            <h3>{period.label}</h3>
            <EvidenceTag label={period.isDemo ? "Demo" : "Recorded"} />
          </div>
          <p className="journey-event-dates">
            {formatShortDate(period.periodStart)} – {formatShortDate(period.periodEnd)} ·{" "}
            {period.days ? `${period.days} billed days` : "billing days unavailable"}
          </p>
          <dl className="journey-event-stats">
            <div>
              <dt>Recorded total</dt>
              <dd>{formatKwh(period.kwh)} kWh</dd>
            </div>
            <div>
              <dt>Per day</dt>
              <dd>{period.kwhPerDay !== null ? `${period.kwhPerDay.toFixed(1)} kWh` : "—"}</dd>
            </div>
            <div>
              <dt>Estimated CO₂e</dt>
              <dd>{formatKg(period.flatKg)} kg</dd>
            </div>
          </dl>
          <p className="journey-event-method">
            <span className="evidence-tag estimated">Estimated</span>{" "}
            {period.factorId ? (
              <>
                factor <span className="mono">{period.factorId}</span>
                {period.factorKgPerKwh !== null ? ` · ${period.factorKgPerKwh.toFixed(3)} kg/kWh` : ""}
                {period.modelId ? (
                  <>
                    {" "}
                    · model <span className="mono">{period.modelId}</span>
                  </>
                ) : null}
              </>
            ) : (
              <>recomputed at display time because no stored factor version exists for this period</>
            )}
            {period.estimateStored ? " · stored when the bill was confirmed" : ""}
          </p>
        </div>
      </li>
    );
  }

  if (event.kind === "milestone") {
    return (
      <li className="journey-event milestone-event">
        <span className="journey-marker celebration" aria-hidden="true">
          <svg viewBox="0 0 24 24">{EVENT_ICON.milestone}</svg>
        </span>
        <div className="journey-event-body">
          <div className="journey-event-head">
            <h3>{event.milestone.label}</h3>
            <GoalBadge label={event.milestone.label === "Confirmed" ? "Confirmed" : "Provisional"} />
          </div>
          <p>{event.milestone.detail}</p>
          <p className="journey-event-dates">Recorded {formatShortDate(event.milestone.occurredAt)}</p>
        </div>
      </li>
    );
  }

  return (
    <li className="journey-event action-event">
      <span className="journey-marker" aria-hidden="true">
        <svg viewBox="0 0 24 24">{EVENT_ICON.action}</svg>
      </span>
      <div className="journey-event-body">
        <div className="journey-event-head">
          <h3>{event.action.title}</h3>
          <span className="evidence-tag estimated">User-reported</span>
        </div>
        <p className="journey-event-dates">Marked complete {formatShortDate(event.date)}</p>
        <p className="journey-event-method">
          Completing an action records intent only. It is not evidence that this period&apos;s usage
          was caused to fall.
        </p>
      </div>
    </li>
  );
}

function TimelineEmpty({ view }: { view: JourneyViewModel }) {
  if (!view.trend.hasBills) {
    return (
      <div className="journey-empty">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 3h10v18l-2.5-1.6L12 21l-2.5-1.6L7 21V3Zm3 5h4m-4 4h4" />
        </svg>
        <h3>No billing periods yet</h3>
        <p>
          Your journey starts with one confirmed bill. Enter the kWh printed on it and the recorded
          total, its daily average and an estimated CO₂e figure will appear here.
        </p>
        <Link className="secondary-button small-button" href="/energy/upload">
          Add your first bill
        </Link>
      </div>
    );
  }
  return null;
}

export function JourneyTimeline({ view }: { view: JourneyViewModel }) {
  return (
    <section className="panel journey-timeline-panel" aria-labelledby="journeyTimelineHeading">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Your carbon journey</span>
          <h2 id="journeyTimelineHeading">Every recorded step, in order</h2>
        </div>
        <span className="journey-count">{view.events.length} entries</span>
      </div>
      {view.trend.periods.length === 0 ? (
        <TimelineEmpty view={view} />
      ) : (
        <ol className="journey-timeline">
          {view.events.map((event) => (
            <TimelineEntry key={event.id} event={event} />
          ))}
        </ol>
      )}
      <p className="source-note">
        Bills appear at their billing-period start. Completed actions are user-reported at the time
        they were marked done. Goal milestones exist only where a newly confirmed bill met the goal
        recorded before it; no earlier milestone is reconstructed.
      </p>
    </section>
  );
}

export function JourneyComparison({ view }: { view: JourneyViewModel }) {
  const comparison = view.trend.comparison;
  if (!comparison) {
    return (
      <article className="panel journey-compare">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Normalised comparison</span>
            <h2>One bill is a starting point</h2>
          </div>
          <EvidenceTag label="Recorded" />
        </div>
        <p className="small muted">
          Add a second billing period to compare daily usage. Comparing kWh per day keeps a 28-day
          bill and a 35-day bill on the same footing; raw monthly totals are never compared directly.
        </p>
      </article>
    );
  }

  const { from, to } = comparison;
  return (
    <article className="panel journey-compare">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Normalised comparison</span>
          <h2>kWh per day, like for like</h2>
        </div>
        <EvidenceTag label="Recorded" />
      </div>
      <div className="journey-compare-grid">
        <div>
          <span className="journey-compare-label">Previous period</span>
          <strong>{from.kwhPerDay !== null ? `${from.kwhPerDay.toFixed(1)} kWh/day` : "—"}</strong>
          <small>
            {from.label} · {formatKwh(from.kwh)} kWh over {from.days ?? "?"} days
          </small>
        </div>
        <div className="journey-compare-arrow" aria-hidden="true">
          →
        </div>
        <div>
          <span className="journey-compare-label">Latest period</span>
          <strong>{to.kwhPerDay !== null ? `${to.kwhPerDay.toFixed(1)} kWh/day` : "—"}</strong>
          <small>
            {to.label} · {formatKwh(to.kwh)} kWh over {to.days ?? "?"} days
          </small>
        </div>
      </div>
      <p className={`journey-change ${comparison.deltaPct !== null && comparison.deltaPct < 0 ? "lower" : ""}`}>
        {comparison.deltaKwhPerDay !== null
          ? `${comparison.deltaKwhPerDay >= 0 ? "+" : "−"}${Math.abs(comparison.deltaKwhPerDay).toFixed(1)} kWh per day`
          : "Daily change unavailable"}
        {comparison.deltaPct !== null ? ` · ${comparison.deltaPct >= 0 ? "+" : "−"}${Math.abs(comparison.deltaPct).toFixed(1)}%` : ""}
      </p>
      <p className="small muted">{observedChangeCopy(comparison)}</p>
      <p className="source-note">{emissionsComparisonCopy(comparison)}</p>
      {comparison.factorsDiffer && comparison.factorIds.length > 0 ? (
        <p className="source-note">
          Factor versions in play: <span className="mono">{comparison.factorIds.join(", ")}</span>.
          Stored estimates are shown as recorded and are never recalculated to force a comparison.
        </p>
      ) : null}
      {comparison.usesRecomputedEstimate ? (
        <p className="source-note">
          At least one period has no stored estimate, so its figure is recomputed from the current
          factor and marked as such in the timeline.
        </p>
      ) : null}
      <p className="source-note">
        Period length comes from validated billing boundaries, with the end date treated as
        exclusive. A zero or missing baseline shows no percentage change.
      </p>
    </article>
  );
}

function TrendChart({ periods }: { periods: readonly NormalisedPeriod[] }) {
  const usable = periods.filter((period) => period.kwhPerDay !== null);
  if (usable.length < 2) {
    return (
      <div className="journey-chart-empty">
        <h3>Trend needs two comparable periods</h3>
        <p className="small muted">
          {periods.length === 1
            ? "One bill is recorded. The trend appears once a second billing period is confirmed."
            : "At least two periods with usable billing boundaries are needed for a daily trend."}
        </p>
      </div>
    );
  }

  const values = usable.map((period) => period.kwhPerDay as number);
  const max = Math.max(...values) * 1.12;
  const min = Math.min(...values) * 0.88;

  return (
    <div className="journey-chart">
      <div className="journey-chart-plot" role="img" aria-label="Daily electricity use by billing period, in kWh per day">
        {usable.map((period, index) => {
          const height = Math.max(8, ((period.kwhPerDay! - min) / (max - min || 1)) * 100);
          return (
            <div className="journey-chart-column" key={period.id}>
              <span className="journey-chart-value">{period.kwhPerDay!.toFixed(1)}</span>
              <span
                className="journey-chart-bar"
                style={{ height: `${Math.max(10, height)}%` }}
                data-latest={index === usable.length - 1 ? "true" : undefined}
              />
              <span className="journey-chart-label">{formatMonthShort(period.periodStart)}</span>
            </div>
          );
        })}
      </div>
      <div
        className="table-wrap journey-chart-table-wrap"
        tabIndex={0}
        role="region"
        aria-label="Scrollable table of daily usage by billing period"
      >
        <table className="journey-chart-table">
          <caption>Daily usage trend by billing period. kWh per day is the recorded total divided by billed days.</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            <th scope="col">Dates</th>
            <th scope="col" className="numeric">Recorded kWh</th>
            <th scope="col" className="numeric">Billed days</th>
            <th scope="col" className="numeric">kWh per day</th>
          </tr>
        </thead>
        <tbody>
          {usable.map((period) => (
            <tr key={period.id}>
              <td>{period.label}</td>
              <td>
                {formatShortDate(period.periodStart)} – {formatShortDate(period.periodEnd)}
              </td>
              <td className="numeric">{formatKwh(period.kwh)}</td>
              <td className="numeric">{period.days}</td>
              <td className="numeric">{period.kwhPerDay!.toFixed(1)}</td>
            </tr>
          ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function JourneyTrend({ view }: { view: JourneyViewModel }) {
  return (
    <section className="panel journey-trend-panel" aria-labelledby="journeyTrendHeading">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Usage trend</span>
          <h2 id="journeyTrendHeading">Daily use across your bills</h2>
        </div>
        <span className="evidence-tag recorded">kWh per day</span>
      </div>
      <p className="small muted journey-trend-intro">
        Recorded totals are shown separately below the chart. The chart normalises each period by its
        validated billing days so different-length bills stay comparable.
      </p>
      <TrendChart periods={view.trend.periods} />
      <div
        className="table-wrap"
        tabIndex={0}
        role="region"
        aria-label="Scrollable table of recorded totals and estimated emissions"
      >
        <table>
          <caption>Recorded totals and estimated emissions by billing period, separate from the normalised comparison</caption>
          <thead>
            <tr>
              <th scope="col">Period</th>
              <th scope="col" className="numeric">Recorded kWh</th>
              <th scope="col" className="numeric">Estimated kg CO₂e</th>
              <th scope="col">Factor version</th>
              <th scope="col">Evidence</th>
            </tr>
          </thead>
          <tbody>
            {view.trend.periods.map((period) => (
              <tr key={period.id}>
                <td>{period.label}</td>
                <td className="numeric">{formatKwh(period.kwh)}</td>
                <td className="numeric">{formatKg(period.flatKg)}</td>
                <td className="mono">{period.factorId ?? "recomputed"}</td>
                <td>
                  <EvidenceTag label={period.isDemo ? "Demo" : "Estimated"} />
                </td>
              </tr>
            ))}
            {view.trend.periods.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  No billing periods recorded yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function GoalJourney({ view }: { view: JourneyViewModel }) {
  const goal = view.goal;
  return (
    <section className="panel journey-goal-panel" aria-labelledby="journeyGoalHeading">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Current goal</span>
          <h2 id="journeyGoalHeading">{goal ? `${formatKwh(goal.kwh)} kWh next period` : "No goal yet"}</h2>
        </div>
        {goal ? <GoalBadge label={goal.label} /> : <EvidenceTag label="Recorded" />}
      </div>
      {goal ? (
        <>
          <div
            className="journey-goal-bar"
            role="progressbar"
            aria-label="Progress against your current goal"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(view.goalProgressPct ?? 0)}
          >
            <span style={{ width: `${view.goalProgressPct ?? 0}%` }} />
          </div>
          <p className="small muted">
            {view.goalProgressPct === null
              ? "Add a confirmed bill to see progress."
              : view.goalProgressPct >= 100
                ? "Your latest recorded period is at or below this goal."
                : "Your latest recorded period is above this goal."}{" "}
            The badge is preserved wherever the goal appears.
          </p>
        </>
      ) : (
        <p className="small muted">
          The first confirmed bill sets a provisional goal. No goal is invented before a bill exists.
        </p>
      )}

      <h3 className="journey-subhead">Milestones</h3>
      {view.milestones.length === 0 ? (
        <p className="small muted">
          {view.trend.hasBills
            ? "No goal milestone is recorded yet. Future milestones are saved when a newly confirmed bill meets the goal that was in force before it; past history is not re-scored."
            : "Milestones appear after a confirmed bill meets your goal."}
        </p>
      ) : (
        <ul className="journey-milestones">
          {view.milestones.map((milestone) => (
            <li key={milestone.id}>
              <span className="journey-marker celebration" aria-hidden="true">
                <svg viewBox="0 0 24 24">{EVENT_ICON.milestone}</svg>
              </span>
              <div>
                <strong>{milestone.label} goal reached</strong>
                <p className="small muted">
                  {formatKwh(milestone.achievedKwh)} kWh recorded against a {formatKwh(milestone.goalKwh)} kWh
                  goal · {formatDate(milestone.occurredAt)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h3 className="journey-subhead">Completed actions</h3>
      {view.completedActions.length === 0 ? (
        <p className="small muted">
          No actions are marked complete yet. Completion is user-reported and never produces a
          measured saving.
        </p>
      ) : (
        <ul className="journey-actions">
          {view.completedActions.map((action) => (
            <li key={action.id}>
              <span className="journey-check" aria-hidden="true">
                ✓
              </span>
              <div>
                <strong>{action.title}</strong>
                <p className="small muted">
                  User-reported{action.updatedAt ? ` on ${formatShortDate(action.updatedAt)}` : ""} · evidence{" "}
                  <span className="mono">{action.evidenceVersion}</span>
                </p>
              </div>
              <Link className="inline-link" href="/actions">
                Undo in your plan →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Full dashboard section. The same components render the dedicated page. */
export function JourneySection({ view }: { view: JourneyViewModel }) {
  return (
    <section className="journey-section" aria-label="Your carbon journey">
      <div className="journey-section-heading">
        <div>
          <span className="eyebrow">Your carbon journey</span>
          <h2 id="journeyHeading">Progress you can read at a glance</h2>
          <p>
            Recorded bills, normalised daily use, goal milestones and the actions you have reported
            completing — in one chronology.
          </p>
        </div>
        <Link className="secondary-button small-button" href="/journey">
          Open the full journey
        </Link>
      </div>

      {view.isDemo ? (
        <p className="journey-demo-note">
          <EvidenceTag label="Demo" /> Seeded demonstration history. Demo bills and milestones are
          kept separate from any personal record.
        </p>
      ) : null}

      <NextStepCard view={view} />
      <div className="journey-grid">
        <JourneyTimeline view={view} />
        <div className="journey-side">
          <JourneyComparison view={view} />
          <GoalJourney view={view} />
        </div>
      </div>
      <JourneyTrend view={view} />
    </section>
  );
}
