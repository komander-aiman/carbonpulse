import type { Metadata } from "next";
import Link from "next/link";
import { EvidenceRow, EvidenceTag, Notice } from "@/components/evidence";
import { ConsentToggle, ScenarioPanel } from "./community-client";
import { currentHousehold } from "@/lib/current-household";
import { buildCommunityViewModel } from "@/lib/community-view";
import { getActiveFactor } from "@/domain/carbon/factors";
import { SUPPRESSION_COPY, zoneLabel } from "@/domain/zone";
import { DEMO_COHORT_SIZE, PRECINCT_METRICS } from "@/db/demo";
import { formatKwh, formatKg } from "@/lib/format";
import { ContextSection } from "@/components/context-section";
import { ClimateExplorer } from "@/components/climate-explorer";
import { loadClimate } from "@/lib/climate";
import { DEMO_MODE } from "@/lib/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Community" };

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const useDemo = params.demo === "true";
  const data = await currentHousehold();
  const community = await buildCommunityViewModel(data, { useDemo });
  const factor = getActiveFactor();
  // Demo mode makes no external calls: the snapshot falls back to recorded
  // values and every badge reads Fallback rather than claiming a live feed.
  const climate = await loadClimate(!DEMO_MODE);

  const zone = community.zone;

  return (
    <>
      <div className="page-heading compact-heading">
        <div>
          <span className="eyebrow">
            Community · {zoneLabel(community.zoneId)} · City of Elmina
          </span>
          <h1>Your zone, honestly reported.</h1>
          <p>
            Zone statistics use consenting records only. Anyone may read them; consent gates contribution, not viewing.
          </p>
        </div>
        <span className="scenario-label">What-if model</span>
      </div>

      <EvidenceRow />

      <section className="section-gap">
        <ClimateExplorer snapshot={climate} factor={factor} isDemo={DEMO_MODE} />
      </section>

      <section className="section-gap">
        <ScenarioPanel factor={factor} community={community} useDemo={community.isDemoData} />
      </section>

      {community.isDemoData ? (
        <Notice tone="warn" title="Demo cohort">
          The figures currently shown are a seeded demonstration cohort of {DEMO_COHORT_SIZE} households in a separate
          namespace. Demo households are excluded from every real aggregate in the domain function and in the database
          view, not just filtered in the UI.
        </Notice>
      ) : null}

      <div className="two-col section-gap">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Zone statistics</span>
              <h2>
                {zone.suppressed
                  ? SUPPRESSION_COPY
                  : `${formatKwh(zone.medianKwh)} kWh median`}
              </h2>
            </div>
            <EvidenceTag label={community.isDemoData ? "Demo" : "Recorded"} />
          </div>

          {zone.suppressed ? (
            <>
              <p className="small muted">
                A zone needs at least {community.minimumCohort} consenting households with a confirmed record for the
                period. Below that, CarbonPulse suppresses counts, medians, percentile bands, the comparison, the
                shared goal, and the map shading rather than publishing something that could identify a household.
              </p>
              <Notice tone="info" title="You can still take part">
                Sharing your confirmed period adds it to the next rebuild. Nothing about you is published
                individually, and you can withdraw at any time.
              </Notice>
            </>
          ) : (
            <>
              <ul className="result-list">
                <li>
                  <span>Consenting households (rounded)</span>
                  <strong>{zone.householdCount}</strong>
                </li>
                <li>
                  <span>Median monthly usage</span>
                  <strong>{formatKwh(zone.medianKwh)} kWh</strong>
                </li>
                <li>
                  <span>Interquartile range</span>
                  <strong>
                    {zone.p25Kwh}–{zone.p75Kwh} kWh
                  </strong>
                </li>
                <li>
                  <span>Median footprint</span>
                  <strong>{formatKg(zone.medianKgCo2e)} kg CO₂e</strong>
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
                Counts and kWh are rounded to the nearest 5. No mean, ranking, or percentile finer than thirds is
                published.
              </p>
            </>
          )}
        </section>

        <aside className="stack">
          <section className="panel">
            <ConsentToggle granted={community.consentGranted} isDemo={data.household.isDemo} />
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">{community.isDemoData ? "Demo snapshot" : "Participation"}</span>
                <h2>{community.isDemoData ? "Participation" : "Zone activity"}</h2>
              </div>
              <EvidenceTag label={community.isDemoData ? "Demo" : "Recorded"} />
            </div>
            <ul className="result-list">
              {community.isDemoData ? (
                <>
                  <li>
                    <span>Seeded households</span>
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
                    <strong>{zone.suppressed ? "Suppressed" : zone.householdCount}</strong>
                  </li>
                  <li>
                    <span>Your consent</span>
                    <strong>{community.consentGranted ? "Sharing" : "Private"}</strong>
                  </li>
                </>
              )}
              <li>
                <span>Active factor</span>
                <strong>{factor.kgPerKwh.toFixed(3)} kg CO₂e/kWh</strong>
              </li>
            </ul>
            <p className="source-note">
              {factor.basis}. {factor.status} · {factor.year}.
            </p>
          </section>
        </aside>
      </div>

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
            <dd>Scenario inputs and results are never stored, never counted, and never mixed into zone statistics.</dd>
          </div>
          <div>
            <dt>Not a forecast</dt>
            <dd>The arithmetic assumes a uniform reduction across households. Real participation is never uniform.</dd>
          </div>
          <div>
            <dt>Separate from the goal</dt>
            <dd>
              The shared goal above uses recorded values and household targets. The sliders below are a hypothetical
              calculation and never feed it.
            </dd>
          </div>
        </dl>
        <p className="small muted">
          <Link href="/learn">How the method works</Link> · <Link href="/questionnaire">Your household profile</Link>
        </p>
      </section>

      <ContextSection
        eyebrow="National and local context"
        title="Context behind the zone numbers"
        compact
      />
    </>
  );
}
