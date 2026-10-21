"use client";

import { useActionState, useState } from "react";
import { importIntervalCsv, saveManualUsage, type FormState } from "./actions";

const INITIAL: FormState = { ok: true, message: "" };

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonth(offset = 0): string {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
  return date.toISOString().slice(0, 10);
}

export function UploadForm() {
  const [mode, setMode] = useState<"manual" | "csv">("manual");
  const [manualState, manualAction, manualPending] = useActionState(saveManualUsage, INITIAL);
  const [csvState, csvAction, csvPending] = useActionState(importIntervalCsv, INITIAL);
  const [fileName, setFileName] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState<string | null>(null);

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">New record</span>
          <h2>{mode === "manual" ? "Enter your monthly usage" : "Upload an interval file"}</h2>
        </div>
        <div className="button-row" role="tablist" aria-label="Input method">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "manual"}
            className={mode === "manual" ? "primary-button small-button" : "secondary-button small-button"}
            onClick={() => setMode("manual")}
          >
            Manual kWh
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "csv"}
            className={mode === "csv" ? "primary-button small-button" : "secondary-button small-button"}
            onClick={() => setMode("csv")}
          >
            Half-hourly CSV
          </button>
        </div>
      </div>

      {mode === "manual" ? (
        <form action={manualAction} style={{ marginTop: 18 }}>
          <div className="field">
            <label className="field-label" htmlFor="billPhoto">
              Bill photo (optional reference)
            </label>
            <input
              id="billPhoto"
              type="file"
              accept="image/*"
              aria-describedby="photo-hint"
              onChange={(event) => setPhotoName(event.target.files?.[0]?.name ?? null)}
            />
            <small className="field-hint" id="photo-hint">
              {photoName
                ? `${photoName} is open on this device only. Nothing was uploaded and no text was read from it.`
                : "Use it to read the kWh yourself. The image never leaves this device, is never processed by OCR, and is not stored anywhere."}
            </small>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="kwh">
              Confirmed electricity usage
            </label>
            <div className="input-unit">
              <input
                id="kwh"
                name="kwh"
                type="number"
                min={1}
                max={3000}
                step="0.1"
                required
                defaultValue={300}
                aria-describedby="kwh-hint"
              />
              <span>kWh</span>
            </div>
            <small className="field-hint" id="kwh-hint">
              Use the total kWh printed on the bill, not the amount in ringgit. Values above 3,000 kWh are flagged for
              review rather than accepted.
            </small>
            {manualState.fields?.kwh ? <span className="field-error">{manualState.fields.kwh}</span> : null}
          </div>

          <div className="two-col" style={{ gap: 14 }}>
            <div className="field">
              <label className="field-label" htmlFor="periodStart">
                Billing period start
              </label>
              <input
                className="text-input"
                id="periodStart"
                name="periodStart"
                type="date"
                required
                defaultValue={firstOfMonth(1)}
                max={today()}
              />
              {manualState.fields?.periodStart ? (
                <span className="field-error">{manualState.fields.periodStart}</span>
              ) : null}
            </div>
            <div className="field">
              <label className="field-label" htmlFor="periodEnd">
                Billing period end
              </label>
              <input
                className="text-input"
                id="periodEnd"
                name="periodEnd"
                type="date"
                required
                defaultValue={firstOfMonth(0)}
                max={today()}
              />
              {manualState.fields?.periodEnd ? (
                <span className="field-error">{manualState.fields.periodEnd}</span>
              ) : null}
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="archetype">
              When is your home usually occupied?
            </label>
            <select className="select-input" id="archetype" name="archetype" defaultValue="mixed">
              <option value="ac_evening">Evening cooling · air conditioning mainly at night</option>
              <option value="ac_all_day">All-day cooling · someone is home through the day</option>
              <option value="workday_absent">Out during the day · morning and evening peaks</option>
              <option value="mixed">Mixed routine · a blend</option>
            </select>
            <small className="field-hint">
              This only shapes the modelled estimate. It never changes the monthly kWh you recorded.{" "}
              <a href="/questionnaire">Answer the household profile</a> and this is set for you.
            </small>
          </div>

          <button className="primary-button full-button" type="submit" disabled={manualPending}>
            {manualPending ? "Saving…" : "Confirm & analyse"}
          </button>
          <p className="form-error" role="alert">
            {manualState.ok ? "" : (manualState.message === "Check the highlighted field." ? "" : manualState.message)}
          </p>
        </form>
      ) : (
        <form action={csvAction} style={{ marginTop: 18 }}>
          <label className="upload-zone" htmlFor="file">
            <input
              id="file"
              name="file"
              type="file"
              accept=".csv,.txt,text/csv"
              required
              onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
            />
            <span className="upload-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 16V4m0 0L8 8m4-4 4 4M5 14v5h14v-5" />
              </svg>
            </span>
            <strong>{fileName ?? "Choose a CSV file"}</strong>
            <small>Half-hourly or hourly kWh with timestamps · max 5 MB · max 90 days</small>
          </label>

          <button className="primary-button full-button" type="submit" disabled={csvPending}>
            {csvPending ? "Validating…" : "Validate & save intervals"}
          </button>

          <p className="form-error" role="alert">
            {csvState.ok ? "" : csvState.message}
          </p>
          {csvState.issues && csvState.issues.length > 0 ? (
            <ul className="issue-list">
              {csvState.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          ) : null}
          <small className="field-hint">
            Nothing is saved unless every row validates. The file is parsed in memory and never stored.
          </small>
        </form>
      )}
    </section>
  );
}
