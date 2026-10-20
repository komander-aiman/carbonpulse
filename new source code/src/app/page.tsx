import Link from "next/link";
import { EvidenceTag } from "@/components/evidence";
import { UsageBarChart } from "@/components/charts";
import { TwoNumberPanel } from "@/components/two-number-panel";
import { currentHousehold } from "@/lib/current-household";
import { buildActionsViewModel, buildEnergyViewModel } from "@/lib/view-model";
import { buildCommunityViewModel } from "@/lib/community-view";
import { getConsent } from "@/lib/household-store";
import { getActiveFactor } from "@/domain/carbon/factors";
import { scenario, formatScenario } from "@/domain/community";
import { SEED_ARTICLES } from "@/db/articles";
import { formatKwh, formatKg } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const data = await currentHousehold();
  const energy = buildEnergyViewModel(data);
  const actions = buildActionsViewModel(data);
  const consent = getConsent(data.household.id, "aggregation");
  const community = buildCommunityViewModel(
    data.household.id,
    energy.current?.kwh ?? null,
    consent?.granted ?? false,
  );
  const factor = getActiveFactor();

  const current = energy.current;
  const previous = energy.previous;
  const changePct =
    current && previous && previous.kwh > 0
      ? ((current.kwh - previous.kwh) / previous.kwh) * 100
      : null;
  const changeKwh = current && previous ? current.kwh - previous.kwh : null;

  const scenarioResult = scenario({
    households: 200,
    reductionPct: 10,
    baselineKwh: community.overall.suppressed ? 300 : community.overall.medianKwh,
    factor,
    cohortHouseholds: community.overall.suppressed ? null : community.overall.householdCount,
  });
  const scenarioText = formatScenario(scenarioResult);
  const featured = SEED_ARTICLES.find((article) => article.tags.includes("grid")) ?? SEED_ARTICLES[0]!;

  const nextAction = actions.actions.find((action) => action.state === "suggested") ?? actions.actions[0];

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">City of Elmina · September 2026</span>
          <h1>Good morning, {data.household.displayName}.</h1>
          <p>
            {current
              ? "Your latest bill is in. The recorded value and both estimates are shown below."
              : "Add your first bill to see your footprint, your plan, and how you compare with the precinct."}
          </p>
        </div>
        <Link className="primary-button" href="/energy/upload">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 16V4m0 0L8 8m4-4 4 4M5 14v5h14v-5" />
          </svg>
          Add latest bill
        </Link>
      </div>

      <section className="hero-card">
        <div className="hero-copy">
          <div className="status-line">
            <span aria-hidden="true" />
            {current ? `${current.label} usage analysed` : "No confirmed usage yet"}
          </div>
          <p className="metric-label">Recorded electricity use</p>
          <div className="hero-value">
            <strong>{current ? formatKwh(current.kwh) : "—"}</strong>
            <span>kWh</span>
          </div>
          {changePct !== null && changeKwh !== null ? (
            <div className={`trend ${changePct <= 0 ? "good" : "bad"}`}>
              <span>
                {changePct <= 0 ? "↓" : "↑"} {Math.abs(changePct).toFixed(0)}%
              </span>
              compared with {previous?.label}
            </div>
          ) : (
            <div className="trend">
              <span>New</span> first confirmed period
            </div>
          )}
          <p className="hero-note">
            {changeKwh !== null
              ? `That is ${formatKwh(Math.abs(changeKwh))} kWh ${changeKwh <= 0 ? "less" : "more"} than your previous billing period.`
              : "Your trend appears after a second billing period is confirmed."}
          </p>
          <Link className="light-button" href="/energy">
            See energy details <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="pulse-core">
            <svg viewBox="0 0 70 70">
              <path d="M47.5 10.7C29.2 13 16.2 23.6 15 40c-.8 10.3 7.8 17.6 17.1 14.8 13-3.9 15.1-23.9 15.4-44.1Z" />
              <path d="M17 53c5.2-14.2 13.9-24.8 27.5-32.2" />
            </svg>
          </div>
          <div className="pulse-chip chip-one">
            <i />
            <span>
              <b>{changeKwh !== null ? `${formatKwh(Math.abs(changeKwh))} kWh` : "—"}</b>{" "}
              {changeKwh !== null && changeKwh <= 0 ? "less" : "change"}
            </span>
          </div>
          <div className="pulse-chip chip-two">
            <i />
            <span>
              <b>{factor.kgPerKwh.toFixed(3)}</b> factor
            </span>
          </div>
        </div>
      </section>

      <div className="metric-grid">
        <article className="metric-card carbon-card">
          <div className="card-topline">
            <span className="metric-icon lime">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3v3M5.6 5.6l2.1 2.1M3 12h3M18 12h3M6 18h12M8 18v-3a4 4 0 0 1 8 0v3" />
              </svg>
            </span>
            <EvidenceTag label="Estimated" />
          </div>
          <p>Electricity footprint</p>
          <div className="metric-number">
            <strong>{formatKg(energy.flatKg)}</strong>
            <span>kg CO₂e</span>
          </div>
          <div className="micro-bar">
            <span style={{ width: `${Math.min(100, energy.flatKg / 3)}%` }} />
          </div>
          <small>
            Based on {factor.kgPerKwh.toFixed(3)} kg CO₂e per kWh · {factor.status} factor
          </small>
        </article>

        <article className="metric-card goal-card">
          <div className="card-topline">
            <span className="metric-icon peach">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="8" />
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v3M22 12h-3" />
              </svg>
            </span>
            <EvidenceTag label="Recorded" />
          </div>
          <p>Monthly target</p>
          <div className="metric-number">
            <strong>{energy.targetKwh || "—"}</strong>
            <span>kWh</span>
          </div>
          <div className="goal-progress">
            <span
              style={{
                width: `${energy.targetKwh > 0 && current ? Math.min(100, (energy.targetKwh / current.kwh) * 100) : 0}%`,
              }}
            />
          </div>
          <small>
            {energy.targetKwh > 0 && current ? (
              energy.targetGapKwh > 0 ? (
                <>
                  <b>{formatKwh(energy.targetGapKwh)} kWh</b> to go · 10% below your trailing median
                </>
              ) : (
                <>Goal reached · 10% below your trailing median</>
              )
            ) : (
              <>Needs three confirmed periods</>
            )}
          </small>
        </article>

        <article className="metric-card action-card-summary">
          <div className="card-topline">
            <span className="metric-icon sky">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 18h6M10 22h4M8.3 14.2A7 7 0 1 1 16 14c-1 .8-1.4 1.5-1.5 2H9.4c-.2-.6-.5-1.2-1.1-1.8Z" />
              </svg>
            </span>
            <EvidenceTag label="Practical" />
          </div>
          <p>Action progress</p>
          <div className="metric-number">
            <strong>{actions.doneCount}</strong>
            <span>of {actions.actions.length} done</span>
          </div>
          <div className="action-dots">
            {actions.actions.map((action) => (
              <i key={action.id} className={action.state === "done" ? "done" : ""} />
            ))}
          </div>
          <Link className="inline-link" href="/actions">
            Continue your plan →
          </Link>
        </article>
      </div>

      <div className="dashboard-grid">
        <article className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Six-month view</span>
              <h2>Your energy trend</h2>
            </div>
            <div className="legend">
              <span className="legend-dot" aria-hidden="true" />
              Recorded kWh
            </div>
          </div>
          <UsageBarChart periods={energy.periods} />
        </article>

        <article className="panel next-action-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Best next step</span>
              <h2>{nextAction?.shortTitle ?? "Review your plan"}</h2>
            </div>
            {nextAction ? (
              <span className={`impact-pill ${nextAction.effort === 1 ? "" : nextAction.effort === 2 ? "medium" : "easy"}`}>
                {nextAction.effort === 1 ? "High impact" : nextAction.effort === 2 ? "Medium" : "Easy win"}
              </span>
            ) : null}
          </div>
          <div className="action-illustration" aria-hidden="true">
            <span className="sun" />
            <span className="ac-unit">
              <i />
              <i />
              <i />
            </span>
            <span className="air-line line-a" />
            <span className="air-line line-b" />
            <span className="air-line line-c" />
            <span className="plant">⌁</span>
          </div>
          <p>{nextAction?.description ?? "Open your plan to see the actions ranked for your household."}</p>
          <div className="potential">
            <span>Potential</span>
            <strong>
              {nextAction ? `${nextAction.kwhLow}–${nextAction.kwhHigh} kWh / month` : "—"}
            </strong>
          </div>
          <Link className="secondary-button" href="/actions">
            View action plan
          </Link>
        </article>
      </div>

      <TwoNumberPanel
        kwh={current?.kwh ?? 0}
        flatKg={energy.flatKg}
        modelledKg={energy.modelledKg}
        deltaKg={energy.deltaKg}
        deltaPct={energy.deltaPct}
        factor={energy.factor}
        modelId={energy.modelId}
        calibrationDate={energy.calibrationDate}
      />

      <section className="precinct-banner">
        <div className="map-dots" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="precinct-copy">
          <span className="eyebrow light">Precinct pulse · What-if scenario</span>
          <h2>What if 200 households saved 10%?</h2>
          <p>Small household changes could add up to meaningful community progress.</p>
        </div>
        <div className="precinct-stat">
          <strong>{scenarioText.savedTonnes.replace(" t CO₂e", "")}</strong>
          <span>t CO₂e</span>
          <small>scenario, per month · not a forecast</small>
        </div>
        <Link className="outline-button" href="/community">
          Explore scenario →
        </Link>
      </section>

      <section className="panel section-gap">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Township climate content</span>
            <h2>Local context, not generic advice</h2>
          </div>
          <Link className="inline-link" href="/township">
            All articles →
          </Link>
        </div>
        <div className="two-col" style={{ marginTop: 16 }}>
          <div>
            <p className="small muted" style={{ marginTop: 0 }}>
              {featured.summary}
            </p>
            <Link className="secondary-button small-button" href={`/township/${featured.slug}`}>
              Read: {featured.title}
            </Link>
          </div>
          <div className="definition-grid" style={{ marginTop: 0 }}>
            <div>
              <dt>Where you sit in the cohort</dt>
              <dd>
                {community.overall.suppressed
                  ? "Suppressed · fewer than 10 consenting households with a confirmed record."
                  : community.band === "lower_third"
                    ? "Lower third of consenting households."
                    : community.band === "upper_third"
                      ? "Upper third of consenting households."
                      : "Middle third of consenting households."}
              </dd>
            </div>
            <div>
              <dt>Precinct data status</dt>
              <dd>{community.isDemoData ? "Demo cohort, excluded from real aggregates." : "Live consenting cohort."}</dd>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
