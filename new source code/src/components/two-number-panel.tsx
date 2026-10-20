import { EvidenceTag } from "@/components/evidence";
import { formatKg } from "@/lib/format";
import { isNegligibleDelta } from "@/domain/carbon/rounding";
import type { EnergyViewModel } from "@/lib/view-model";

export function TwoNumberPanel({
  kwh,
  flatKg,
  modelledKg,
  deltaKg,
  deltaPct,
  factor,
  modelId,
  calibrationDate,
  variance,
  compact = false,
}: {
  kwh: number;
  flatKg: number;
  modelledKg: number;
  deltaKg: number;
  deltaPct: number;
  factor: EnergyViewModel["factor"];
  modelId: string;
  calibrationDate: string;
  variance?: { readonly coveragePct: number; readonly intervalCount: number } | null;
  compact?: boolean;
}) {
  const negligible = isNegligibleDelta(deltaPct);
  const direction = deltaKg > 0 ? "higher" : "lower";
  const rangeLow = modelledKg * 0.85;
  const rangeHigh = modelledKg * 1.15;

  return (
    <section className="compare-panel" aria-labelledby="compareHeading">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Two estimates, one input</span>
          <h2 id="compareHeading">Flat factor and modelled, side by side</h2>
        </div>
        <EvidenceTag label="Estimated" />
      </div>

      <div className="compare-grid">
        <div className="compare-cell">
          <EvidenceTag label="Estimated" />
          <p>Flat-factor estimate</p>
          <div className="value">
            <strong>{formatKg(flatKg)}</strong>
            <span>kg CO₂e</span>
          </div>
          <small>
            {formatKg(kwh)} kWh × {factor.kgPerKwh.toFixed(3)} kg CO₂e/kWh. This is the auditable headline number.
          </small>
        </div>

        <div className="compare-cell modelled">
          <EvidenceTag label="Modelled" />
          <p>Modelled time-matched</p>
          <div className="value">
            <strong>{formatKg(modelledKg)}</strong>
            <span>kg CO₂e</span>
          </div>
          <small>
            Range {formatKg(rangeLow)}–{formatKg(rangeHigh)} kg CO₂e (±15%).
            {variance ? ` Interval coverage ${variance.coveragePct.toFixed(1)}% across ${variance.intervalCount} readings.` : ""}
          </small>
        </div>
      </div>

      <div className="delta-line">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v6M12 7.5v.2" />
        </svg>
        <p>
          {negligible ? (
            <>
              <strong>Close to the annual-average estimate.</strong> The modelled timing effect is under 2%, so
              your use is spread much like the annual average.
            </>
          ) : (
            <>
              <strong>
                Modelled timing effect: {deltaKg > 0 ? "+" : ""}
                {formatKg(deltaKg)} kg CO₂e ({deltaPct > 0 ? "+" : ""}
                {deltaPct.toFixed(1)}%).
              </strong>{" "}
              Your modelled emissions are {direction} than the flat estimate because your estimated use falls in
              hours that are {direction === "higher" ? "more" : "less"} carbon-intensive than the annual average.
              This is not a measured saving.
            </>
          )}
        </p>
      </div>

      {!compact ? (
        <p className="method-footnote">
          Model {modelId}, calibrated {calibrationDate}. The hourly intensity shape is modelled; its annual average
          is calibrated to the published {factor.kgPerKwh.toFixed(3)} factor. Malaysia does not publish interval grid
          intensity. Factor version <span className="mono">{factor.id}</span> · {factor.status}.
        </p>
      ) : null}
    </section>
  );
}
