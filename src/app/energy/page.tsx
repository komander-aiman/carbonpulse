import Link from "next/link";
import type { Metadata } from "next";
import { EvidenceRow, EvidenceTag, Notice } from "@/components/evidence";
import { UsageLineChart } from "@/components/charts";
import { TwoNumberPanel } from "@/components/two-number-panel";
import { currentHousehold } from "@/lib/current-household";
import { buildEnergyViewModel } from "@/lib/view-model";
import { formatKwh, formatKg, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "My energy" };

const SOURCE_LABEL: Record<string, string> = {
  manual: "Entered from bill",
  csv: "Derived from intervals",
  derived: "Derived from intervals",
  demo: "Seeded demo value",
};

export default async function EnergyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const saved = typeof params.saved === "string" ? params.saved : null;
  const coverage = typeof params.coverage === "string" ? params.coverage : null;
  const intervalKg = typeof params.kg === "string" ? params.kg : null;
  const data = await currentHousehold();
  const energy = buildEnergyViewModel(data);
  const current = energy.current;

  return (
    <>
      <div className="page-heading compact-heading">
        <div>
          <span className="eyebrow">My energy</span>
          <h1>Understand every kilowatt-hour.</h1>
          <p>Recorded usage stays separate from estimated and modelled emissions.</p>
        </div>
        <Link className="primary-button" href="/energy/upload">
          Add a bill
        </Link>
      </div>

      {saved ? (
        <Notice tone="info" title={saved === "csv" ? "Interval import saved" : "Usage saved"}>
          {saved === "csv"
            ? `Your CSV was parsed and confirmed. Coverage ${coverage ?? "—"}%${intervalKg ? `, interval-timed estimate ${intervalKg} kg CO₂e` : ""}. The file itself was not retained.`
            : "Your confirmed kWh now drives every estimate in this session, including the flat and modelled figures below."}
        </Notice>
      ) : null}

      <EvidenceRow />

      {energy.isDemo ? (
        <Notice tone="warn" title="Demo household">
          These values are seeded so every screen renders without an account. Add your first real bill to replace the
          demo periods; demo data is never included in real community aggregates.
        </Notice>
      ) : null}

      <div className="energy-layout section-gap">
        <article className="panel energy-history">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Billing periods</span>
              <h2>Monthly history</h2>
            </div>
            <span className="evidence-tag recorded">{energy.periods.length} confirmed</span>
          </div>

          <UsageLineChart periods={energy.periods} />

          <div className="table-wrap" tabIndex={0} role="region" aria-label="Scrollable table">
            <table>
              <caption>Confirmed billing periods, with billed days, daily use, and both estimates for each</caption>
              <thead>
                <tr>
                  <th scope="col">Period</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="numeric">
                    kWh
                  </th>
                  <th scope="col" className="numeric">
                    Flat kg
                  </th>
                  <th scope="col" className="numeric">
                    Modelled kg
                  </th>
                  <th scope="col">Method</th>
                </tr>
              </thead>
              <tbody>
                {[...energy.periods].reverse().map((period) => (
                  <tr key={period.id}>
                    <td>{period.label}</td>
                    <td>
                      <i className="check-dot" aria-hidden="true">
                        ✓
                      </i>
                      Confirmed
                    </td>
                    <td className="numeric">{formatKwh(period.kwh)}</td>
                    <td className="numeric">{formatKg(period.flatKg)}</td>
                    <td className="numeric">{formatKg(period.modelledKg)}</td>
                    <td>{SOURCE_LABEL[period.source] ?? period.source}</td>
                  </tr>
                ))}
                {energy.periods.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="muted">
                      No confirmed periods yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {current ? (
            <p className="source-note">
              Latest period confirmed {formatDate(current.confirmedAt)}. Rounding is applied for display only; stored
              totals are unrounded.
            </p>
          ) : null}
        </article>

        <aside className="side-stack">
          <article className="panel calculation-card">
            <span className="eyebrow">Transparent method</span>
            <h2>How this was calculated</h2>
            <div className="formula">
              <strong>{current ? formatKwh(current.kwh) : "—"}</strong>
              <span>kWh</span>
              <b>×</b>
              <strong>{energy.factor.kgPerKwh.toFixed(3)}</strong>
              <span>kg CO₂e/kWh</span>
            </div>
            <div className="formula-result">
              <span>Estimated footprint</span>
              <strong>
                <b>{formatKg(energy.flatKg)}</b> kg CO₂e
              </strong>
            </div>
            <div className="assumption">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 8v6m0-10v.2" />
              </svg>
              <p>
                <strong>Screening estimate</strong>
                This is not an audited household carbon inventory.
              </p>
            </div>
            <p className="source-note">
              Factor: Energy Commission of Malaysia {energy.factor.year} {energy.factor.status} Peninsular grid
              emission factor. Basis: {energy.factor.basis}. Region: {energy.factor.region}.
              <br />
              <a href={energy.factor.sourceUrl} rel="noopener noreferrer">
                Source registry entry {energy.factor.sourceId}
              </a>
            </p>
          </article>

          <article className="panel">
            <span className="eyebrow">Current goal</span>
            <h2 style={{ margin: "6px 0 12px", font: '800 22px/1.25 "Manrope", sans-serif' }}>
              {energy.targetKwh || "—"} kWh
            </h2>
            {energy.goal ? (
              <p style={{ marginTop: 0 }}>
                <span className={`evidence-tag ${energy.goal.rule === "confirmed" ? "recorded" : "estimated"}`}>
                  {energy.goal.label}
                </span>
              </p>
            ) : null}
            <p className="small muted" style={{ marginTop: 8 }}>
              {energy.goal?.rule === "confirmed"
                ? "10% below your trailing three-month median, rounded to the nearest 5 kWh."
                : "10% below your latest confirmed bill, rounded to the nearest 5 kWh. It becomes a confirmed goal after three periods."}
            </p>
            <ul className="result-list">
              <li>
                <span>Rule basis</span>
                <strong>
                  {energy.goal?.rule === "confirmed"
                    ? "3-period median"
                    : `${energy.goal?.basisPeriods ?? 0} period${energy.goal?.basisPeriods === 1 ? "" : "s"}`}
                </strong>
              </li>
              <li>
                <span>Gap to goal</span>
                <strong>{current ? `${formatKwh(energy.targetGapKwh)} kWh` : "—"}</strong>
              </li>
            </ul>
          </article>
        </aside>
      </div>

      {current ? (
        <TwoNumberPanel
          kwh={current.kwh}
          flatKg={energy.flatKg}
          modelledKg={energy.modelledKg}
          deltaKg={energy.deltaKg}
          deltaPct={energy.deltaPct}
          factor={energy.factor}
          modelId={energy.modelId}
          calibrationDate={energy.calibrationDate}
        />
      ) : null}

      <section className="panel section-gap">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Method limits</span>
            <h2>What this number is not</h2>
          </div>
          <EvidenceTag label="Modelled" />
        </div>
        <p className="small muted">
          The hourly intensity shape is modelled; its annual average is calibrated to the published{" "}
          {energy.factor.kgPerKwh.toFixed(3)} factor. Malaysia does not publish interval grid intensity, so no
          intraday value here is measured. The factor is {energy.factor.status}. Results are location-based Scope 2
          estimates and must not be described as market-based or zero-carbon.
        </p>
        <p className="small muted">
          Model version <span className="mono">{energy.modelId}</span>, calibrated {energy.calibrationDate}. Household
          archetype <span className="mono">{data.household.archetype}</span>.
        </p>
      </section>
    </>
  );
}
