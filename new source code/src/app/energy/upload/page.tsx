import type { Metadata } from "next";
import Link from "next/link";
import { EvidenceRow, Notice } from "@/components/evidence";
import { UploadForm } from "./upload-form";
import { currentHousehold } from "@/lib/current-household";
import { getImports } from "@/lib/interval-store";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Add usage" };

export default async function UploadPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const data = await currentHousehold();
  const imports = getImports(data.household.id);
  const saved = typeof params.saved === "string" ? params.saved : null;
  const coverage = typeof params.coverage === "string" ? params.coverage : null;
  const kg = typeof params.kg === "string" ? params.kg : null;

  return (
    <>
      <div className="page-heading compact-heading">
        <div>
          <span className="eyebrow">Add usage</span>
          <h1>One confirmed number is enough.</h1>
          <p>
            Enter the kWh from your bill, or upload a half-hourly export if you have one. You always confirm the value
            before it is used.
          </p>
        </div>
        <Link className="secondary-button" href="/energy">
          Back to my energy
        </Link>
      </div>

      <EvidenceRow />

      {saved ? (
        <Notice tone="info" title={saved === "csv" ? "Interval import saved" : "Usage saved"}>
          {saved === "csv"
            ? `Your CSV was parsed and confirmed. Coverage ${coverage ?? "—"}%${kg ? `, interval-timed estimate ${kg} kg CO₂e` : ""}. The uploaded file was not retained.`
            : "Your confirmed kWh now drives every estimate on this device session."}
        </Notice>
      ) : null}

      <div className="two-col section-gap">
        <div className="stack">
          <UploadForm />

          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Interval imports</span>
                <h2>Uploaded files</h2>
              </div>
            </div>
            {imports.length === 0 ? (
              <p className="small muted">
                No interval files yet. A monthly bill is enough for the flat and modelled estimates.
              </p>
            ) : (
              <div className="table-wrap">
                <table>
                  <caption>Interval imports for this household, retained as parsed readings only</caption>
                  <thead>
                    <tr>
                      <th scope="col">Imported</th>
                      <th scope="col">File</th>
                      <th scope="col" className="numeric">
                        Rows
                      </th>
                      <th scope="col" className="numeric">
                        Coverage
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...imports].reverse().map((record) => (
                      <tr key={record.id}>
                        <td>{formatDate(record.importedAt)}</td>
                        <td>{record.fileName}</td>
                        <td className="numeric">{record.readings.length.toLocaleString("en-MY")}</td>
                        <td className="numeric">{record.coveragePct.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="source-note">
              Uploaded files are parsed in memory and never written to durable storage. Only the normalized interval
              readings are kept, so the file itself cannot be recovered.
            </p>
          </section>
        </div>

        <aside className="side-stack">
          <section className="panel">
            <span className="eyebrow">CSV format</span>
            <h2 style={{ margin: "6px 0 10px", font: '800 20px/1.25 "Manrope", sans-serif' }}>
              Two required columns
            </h2>
            <p className="small muted" style={{ marginTop: 0 }}>
              A header row with a timestamp column and a kWh column. Timestamps must include an offset; they are
              normalized to Asia/Kuala_Lumpur.
            </p>
            <pre className="mono" style={{ overflowX: "auto", background: "#eef3eb", padding: 14, borderRadius: 10 }}>
{`timestamp,kwh
2026-09-01T00:00:00+08:00,0.31
2026-09-01T00:30:00+08:00,0.28`}
            </pre>
            <ul className="result-list">
              <li>
                <span>Maximum size</span>
                <strong>5 MB</strong>
              </li>
              <li>
                <span>Maximum span</span>
                <strong>90 days</strong>
              </li>
              <li>
                <span>Missing intervals allowed</span>
                <strong>Up to 2%</strong>
              </li>
              <li>
                <span>Unit guard</span>
                <strong>Blocked above 50 kWh per interval</strong>
              </li>
            </ul>
          </section>

          <section className="panel">
            <span className="eyebrow">Privacy</span>
            <h2 style={{ margin: "6px 0 10px", font: '800 20px/1.25 "Manrope"', }}>
              Aggregation is separate
            </h2>
            <p className="small muted" style={{ marginTop: 0 }}>
              Saving usage does not opt you in to the precinct cohort. Consent is a separate, revocable choice on the
              Precinct pulse page.
            </p>
            <Link className="secondary-button small-button" href="/community">
              Review consent
            </Link>
          </section>
        </aside>
      </div>
    </>
  );
}
