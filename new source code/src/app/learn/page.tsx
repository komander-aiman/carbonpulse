import type { Metadata } from "next";
import Link from "next/link";
import { EvidenceRow } from "@/components/evidence";
import { getActiveFactor } from "@/domain/carbon/factors";
import { buildIntensityProfile } from "@/domain/carbon/intensity";
import { EVIDENCE_VERSION, ACTIONS } from "@/domain/actions";
import { CONTEXT_STATS } from "@/db/demo";
import { SUBZONES } from "@/db/geo";
import { CONSENT_POLICY_VERSION, SITE } from "@/lib/config";
import { formatKg } from "@/lib/format";

export const metadata: Metadata = { title: "How it works" };

const STEPS = [
  {
    number: "01",
    title: "Add your usage",
    body: "Enter monthly kWh from your bill, or upload a half-hourly CSV. You always confirm the value before it is used.",
    tag: "Recorded input",
    icon: <path d="M7 3h8l4 4v14H7V3Zm8 0v5h4M10 13h6M10 17h6" />,
  },
  {
    number: "02",
    title: "See both estimates",
    body: "Your confirmed kWh is multiplied by the published Peninsular factor for the flat estimate, and by an hourly intensity shape for the modelled one.",
    tag: "Estimated and Modelled",
    icon: <path d="m5 19 4-4 3 3 7-8M5 5v14h14" />,
  },
  {
    number: "03",
    title: "Choose an action",
    body: "Actions are ranked by estimated CO₂e reduction per unit of effort, from a versioned evidence table. Completing one records intent, not a measured saving.",
    tag: "Resident choice",
    icon: <path d="M9 18h6M10 22h4M8.3 14.2A7 7 0 1 1 16 14c-1 .8-1.4 1.5-1.5 2H9.4c-.2-.6-.5-1.2-1.1-1.8Z" />,
  },
  {
    number: "04",
    title: "Explore shared impact",
    body: "Opt-in records can contribute to group-level statistics when at least 10 consenting households qualify. Below that, everything is suppressed.",
    tag: "Scenario, not forecast",
    icon: <path d="M3 20V9l5-4 5 4v11M13 12l4-3 4 3v8" />,
  },
];

export default function LearnPage() {
  const factor = getActiveFactor();
  const profile = buildIntensityProfile();

  return (
    <>
      <div className="page-heading compact-heading">
        <div>
          <span className="eyebrow">How it works</span>
          <h1>Clear inputs. Traceable results.</h1>
          <p>CarbonPulse distinguishes the things you record from the things we estimate or model.</p>
        </div>
      </div>

      <EvidenceRow />

      <div className="steps-grid">
        {STEPS.map((step) => (
          <article key={step.number}>
            <span>{step.number}</span>
            <div className="step-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {step.icon}
              </svg>
            </div>
            <h2>{step.title}</h2>
            <p>{step.body}</p>
            <small>{step.tag}</small>
          </article>
        ))}
      </div>

      <article className="trust-panel">
        <div>
          <span className="eyebrow light">Privacy by design</span>
          <h2>Your household data stays yours.</h2>
          <p>
            Consent for aggregation is separate, optional, and revocable. This page describes what is shared, what is
            never shared, and how small groups are protected.
          </p>
        </div>
        <ul>
          <li>
            <span aria-hidden="true">✓</span>Explicit opt-in before aggregation
          </li>
          <li>
            <span aria-hidden="true">✓</span>No named household leaderboard
          </li>
          <li>
            <span aria-hidden="true">✓</span>Small-group outputs suppressed at k = 10
          </li>
          <li>
            <span aria-hidden="true">✓</span>No household coordinates on any map
          </li>
          <li>
            <span aria-hidden="true">✓</span>Clear coverage and evidence labels
          </li>
          <li>
            <span aria-hidden="true">✓</span>Bill files parsed in memory, never stored
          </li>
        </ul>
      </article>

      <div className="two-col section-gap">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Method</span>
              <h2>What each number means</h2>
            </div>
          </div>

          <dl className="definition-grid">
            <div>
              <dt>Estimated · flat factor</dt>
              <dd>
                Your confirmed kWh multiplied by the published {SITE.region} grid emission factor for {factor.year} (
                {factor.kgPerKwh.toFixed(3)} kg CO₂e/kWh, {factor.status}). This is the auditable headline number and it
                is always shown.
              </dd>
            </div>
            <div>
              <dt>Modelled · time-matched</dt>
              <dd>
                Assumes an hourly grid intensity shape whose annual average equals the published factor, combined with
                your reported routines. Malaysia does not publish interval grid intensity, so this is not a measured
                value. Every modelled figure carries a ±15% range.
              </dd>
            </div>
            <div>
              <dt>Recorded</dt>
              <dd>
                A value you confirmed from a bill, or consumption read from an uploaded interval file. Recorded values
                are never overwritten by an estimate without your confirmation.
              </dd>
            </div>
            <div>
              <dt>Scenario</dt>
              <dd>
                A hypothetical calculation from inputs you choose. It is not a forecast or a measured community
                outcome, and it never enters historical totals or aggregates.
              </dd>
            </div>
          </dl>

          <p className="source-note">
            Flat estimate on the demo period: {formatKg(300 * factor.kgPerKwh)} kg CO₂e for 300 kWh. Rounding is applied
            for display only; sums use unrounded values.
          </p>
        </section>

        <aside className="side-stack">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Versions</span>
                <h2>Reproducible by construction</h2>
              </div>
            </div>
            <ul className="result-list">
              <li>
                <span>Factor version</span>
                <strong className="mono">{factor.id}</strong>
              </li>
              <li>
                <span>Factor value</span>
                <strong>{factor.kgPerKwh.toFixed(3)} kg CO₂e/kWh</strong>
              </li>
              <li>
                <span>Status</span>
                <strong>{factor.status}</strong>
              </li>
              <li>
                <span>Model version</span>
                <strong className="mono">{profile.modelVersion.id}</strong>
              </li>
              <li>
                <span>Calibrated</span>
                <strong>{profile.modelVersion.calibrationDate}</strong>
              </li>
              <li>
                <span>Evidence version</span>
                <strong className="mono">{EVIDENCE_VERSION}</strong>
              </li>
              <li>
                <span>Consent policy</span>
                <strong className="mono">{CONSENT_POLICY_VERSION}</strong>
              </li>
              <li>
                <span>Action catalog</span>
                <strong>{ACTIONS.length} actions</strong>
              </li>
              <li>
                <span>Subzones</span>
                <strong>{SUBZONES.length} grid cells</strong>
              </li>
            </ul>
            <p className="source-note">
              Changing a factor inserts a new version; it never rewrites a stored estimate silently. Recalculation is
              explicit and shows the delta.
            </p>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Sources</span>
                <h2>Registry</h2>
              </div>
            </div>
            <div className="table-wrap" tabIndex={0} role="region" aria-label="Scrollable table">
              <table>
                <caption>Every figure in the app resolves to one of these entries</caption>
                <thead>
                  <tr>
                    <th scope="col">ID</th>
                    <th scope="col">Source</th>
                    <th scope="col">Used for</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>S1</td>
                    <td>Energy Commission MyEnergyStats</td>
                    <td>Grid emission factor, annual</td>
                  </tr>
                  <tr>
                    <td>S2</td>
                    <td>data.gov.my electricity consumption</td>
                    <td>National monthly context</td>
                  </tr>
                  <tr>
                    <td>S4</td>
                    <td>data.gov.my GHG emissions</td>
                    <td>National annual context</td>
                  </tr>
                  <tr>
                    <td>S10</td>
                    <td>Open-Meteo Archive</td>
                    <td>Solar shape, cooling context</td>
                  </tr>
                  <tr>
                    <td>S12</td>
                    <td>World Bank EN.GHG.CO2.PC.CE.AR5</td>
                    <td>Per-capita benchmark</td>
                  </tr>
                  <tr>
                    <td>S15</td>
                    <td>OpenFreeMap</td>
                    <td>Map tiles</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="source-note">
              National context: {CONTEXT_STATS.nationalCo2PerCapita.value} t CO₂e per person (
              {CONTEXT_STATS.nationalCo2PerCapita.year}), {CONTEXT_STATS.nationalGhg.value.toLocaleString("en-MY")} Gg
              CO₂e nationally ({CONTEXT_STATS.nationalGhg.year}). Weather data by Open-Meteo.com.
            </p>
          </section>
        </aside>
      </div>

      <section className="panel section-gap">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Limitations</span>
            <h2>Where this stops being certain</h2>
          </div>
        </div>
        <ul className="result-list">
          <li>
            <span>The hourly intensity shape is assumed, not measured.</span>
            <strong>Only its annual mean is anchored to an official value.</strong>
          </li>
          <li>
            <span>The factor is generation-based and excludes transmission losses.</span>
            <strong>Adding a loss multiplier would overstate your footprint.</strong>
          </li>
          <li>
            <span>Results are location-based Scope 2 only.</span>
            <strong>Not market-based, not zero-carbon, not an audited inventory.</strong>
          </li>
          <li>
            <span>Elmina&rsquo;s boundary is an OSM approximation.</span>
            <strong>Indicative, not gazetted.</strong>
          </li>
          <li>
            <span>No township-level measured emissions figure exists publicly.</span>
            <strong>Cohort statistics are derived from participating households only.</strong>
          </li>
        </ul>
        <p className="small muted">
          <Link href="/township">Read the Elmina articles</Link> for local context, or review the{" "}
          <Link href="/community">precinct consent settings</Link>.
        </p>
      </section>
    </>
  );
}
