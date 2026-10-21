import type { Metadata } from "next";
import { EvidenceRow, EvidenceTag, Notice } from "@/components/evidence";
import { ScenarioPanel, ConsentToggle } from "./community-client";
import { currentHousehold } from "@/lib/current-household";
import { buildEnergyViewModel } from "@/lib/view-model";
import { buildCommunityViewModel } from "@/lib/community-view";
import { getConsent } from "@/lib/household-store";
import { getActiveFactor } from "@/domain/carbon/factors";
import { PRECINCT_METRICS } from "@/db/demo";
import { formatKwh, formatKg } from "@/lib/format";
import { ContextSection } from "@/components/context-section";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Precinct pulse" };

export default async function CommunityPage() {
  const data = await currentHousehold();
  const energy = buildEnergyViewModel(data);
  const consent = getConsent(data.household.id, "aggregation");
  const consentGranted = consent?.granted ?? false;
  const community = buildCommunityViewModel(
    data.household.id,
    energy.current?.kwh ?? null,
    consentGranted,
  );
  const factor = getActiveFactor();

  return (
    <>
      <div className="page-heading compact-heading">
        <div>
          <span className="eyebrow">Precinct pulse</span>
          <h1>See how shared goals add up.</h1>
          <p>
            Cohort statistics come from consenting records only. The sliders below are a scenario, not a prediction or
            a measured township outcome.
          </p>
        </div>
        <span className="scenario-label">What-if model</span>
      </div>

      <EvidenceRow />

      {community.isDemoData ? (
        <Notice tone="warn" title="Demo cohort">
          The cohort currently shown is seeded demonstration data of {PRECINCT_METRICS.optedIn} households. Demo
          households are excluded from every real aggregate at the database view level, not just filtered in the UI.
        </Notice>
      ) : null}

      <div className="two-col section-gap">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Cohort statistics</span>
              <h2>
                {community.overall.suppressed
                  ? "Not enough participants to publish"
                  : `${formatKwh(community.overall.medianKwh)} kWh median`}
              </h2>
            </div>
            <EvidenceTag label={community.isDemoData ? "Demo" : "Recorded"} />
          </div>

          {community.overall.suppressed ? (
            <>
              <p className="small muted">
                A cohort needs at least {community.minimumCohort} consenting households with a confirmed record for the
                period. Below that threshold CarbonPulse suppresses counts, medians, percentile bands, and the map
                choropleth rather than publishing something that could identify a household.
              </p>
              <Notice tone="info" title="You can still take part">
                Granting consent adds your confirmed period to the next rebuild. Nothing about you is published
                individually, and you can withdraw at any time.
              </Notice>
            </>
          ) : (
            <>
              <ul className="result-list">
                <li>
                  <span>Consenting households (rounded)</span>
                  <strong>{community.overall.householdCount}</strong>
                </li>
                <li>
                  <span>Median monthly usage</span>
                  <strong>{formatKwh(community.overall.medianKwh)} kWh</strong>
                </li>
                <li>
                  <span>Interquartile range</span>
                  <strong>
                    {community.overall.p25Kwh}–{community.overall.p75Kwh} kWh
                  </strong>
                </li>
                <li>
                  <span>Median footprint</span>
                  <strong>{formatKg(community.overall.medianKgCo2e)} kg CO₂e</strong>
                </li>
                <li>
                  <span>Coverage of consenting households</span>
                  <strong>{community.overall.coveragePct.toFixed(0)}%</strong>
                </li>
                <li>
                  <span>Your band</span>
                  <strong>
                    {community.band === "lower_third"
                      ? "Lower third"
                      : community.band === "upper_third"
                        ? "Upper third"
                        : community.band === "middle_third"
                          ? "Middle third"
                          : "Suppressed"}
                  </strong>
                </li>
              </ul>
              <p className="source-note">
                Counts at or above the threshold are rounded to the nearest 5. No mean, ranking, or percentile finer
                than thirds is published.
              </p>
            </>
          )}
        </section>

        <aside className="stack">
          <section className="panel">
            <ConsentToggle granted={consentGranted} isDemo={data.household.isDemo} />
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">{community.isDemoData ? "Demo snapshot" : "Participation"}</span>
                <h2>{community.isDemoData ? "Participation" : "Cohort activity"}</h2>
              </div>
              <EvidenceTag label={community.isDemoData ? "Demo" : "Recorded"} />
            </div>
            <ul className="result-list">
              {community.isDemoData ? (
                <>
                  <li>
                    <span>Opted-in households</span>
                    <strong>{PRECINCT_METRICS.optedIn}</strong>
                  </li>
                  <li>
                    <span>Monthly submissions</span>
                    <strong>{PRECINCT_METRICS.monthlySubmissions}</strong>
                  </li>
                  <li>
                    <span>Actions completed</span>
                    <strong>{PRECINCT_METRICS.actionsCompleted}</strong>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <span>Consenting households</span>
                    <strong>
                      {community.overall.suppressed ? "Suppressed" : community.overall.householdCount}
                    </strong>
                  </li>
                  <li>
                    <span>Your consent</span>
                    <strong>{consentGranted ? "Granted" : "Not granted"}</strong>
                  </li>
                </>
              )}
              <li>
                <span>Active factor</span>
                <strong>
                  {factor.kgPerKwh.toFixed(3)} kg CO₂e/kWh
                </strong>
              </li>
            </ul>
            {community.isDemoData ? null : (
              <p className="source-note">
                Seeded demonstration figures are not shown while demo mode is off. Counts come only from consenting
                households in this cohort.
              </p>
            )}
            <p className="source-note">{factor.basis}. {factor.status} · {factor.year}.</p>
          </section>
        </aside>
      </div>

      <section className="section-gap">
        <ScenarioPanel factor={factor} community={community} />
      </section>

      <section className="panel section-gap">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Scenario rules</span>
            <h2>What the sliders can and cannot do</h2>
          </div>
        </div>
        <dl className="definition-grid">
          <div>
            <dt>Bounded on purpose</dt>
            <dd>10–2,000 households, 1–25% reduction, 150–600 kWh baseline. Inputs outside those ranges are clamped.</dd>
          </div>
          <div>
            <dt>No persistence</dt>
            <dd>Scenario inputs and results are never stored, never counted, and never mixed into cohort statistics.</dd>
          </div>
          <div>
            <dt>Not a forecast</dt>
            <dd>The arithmetic assumes a uniform reduction across households. Real participation is never uniform.</dd>
          </div>
          <div>
            <dt>Baseline disclosure</dt>
            <dd>
              The default baseline is the cohort median when it is publishable; otherwise 300 kWh is used and stated
              explicitly.
            </dd>
          </div>
        </dl>
      </section>

      <ContextSection
        eyebrow="National and local context"
        title="Context behind the cohort numbers"
        compact
      />
    </>
  );
}
