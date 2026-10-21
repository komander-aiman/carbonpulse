import { formatKwh, formatMonthShort } from "@/lib/format";
import type { PeriodView } from "@/lib/view-model";

export function UsageBarChart({ periods }: { periods: readonly PeriodView[] }) {
  if (periods.length === 0) {
    return <p className="muted small">No confirmed periods yet. Add a bill to start the trend.</p>;
  }
  const values = periods.map((period) => period.kwh);
  const max = Math.max(...values) * 1.08;

  return (
    <>
      <div className="bar-chart" aria-hidden="true">
        {periods.map((period, index) => (
          <div className="bar-column" key={period.id}>
            <span className="bar-value">{formatKwh(period.kwh)}</span>
            <span
              className="bar"
              style={{ height: `${Math.max(12, (period.kwh / max) * 115)}px` }}
              data-last={index === periods.length - 1 ? "true" : undefined}
            />
            <span className="bar-label">{formatMonthShort(period.periodStart)}</span>
          </div>
        ))}
      </div>
      <table className="sr-only">
        <caption>Monthly recorded electricity usage</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            <th scope="col">kWh</th>
          </tr>
        </thead>
        <tbody>
          {periods.map((period) => (
            <tr key={period.id}>
              <td>{period.label}</td>
              <td>{formatKwh(period.kwh)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export function UsageLineChart({ periods }: { periods: readonly PeriodView[] }) {
  if (periods.length < 2) {
    return <p className="muted small">At least two confirmed periods are needed for a trend line.</p>;
  }
  const width = 700;
  const height = 260;
  const left = 40;
  const right = 670;
  const top = 30;
  const bottom = 225;
  const values = periods.map((period) => period.kwh);
  const min = Math.min(...values) * 0.94;
  const max = Math.max(...values) * 1.04;
  const step = periods.length > 1 ? (right - left) / (periods.length - 1) : 0;
  const y = (value: number) => bottom - ((value - min) / (max - min || 1)) * (bottom - top);

  const points = periods.map((period, index) => ({
    x: left + index * step,
    y: y(period.kwh),
    period,
  }));
  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
  const area = `${line} L${right},${bottom} L${left},${bottom} Z`;

  return (
    <div className="line-chart">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Recorded electricity usage by billing period">
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8bdc78" stopOpacity="0.45" />
            <stop offset="1" stopColor="#8bdc78" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g className="chart-grid">
          {[top, top + 65, top + 130, bottom].map((gridY) => (
            <line key={gridY} x1={left} y1={gridY} x2={right} y2={gridY} />
          ))}
        </g>
        <path d={area} fill="url(#areaGradient)" />
        <path className="energy-line" d={line} />
        <g className="energy-points">
          {points.map((point) => (
            <circle key={point.period.id} cx={point.x} cy={point.y} r={5} />
          ))}
        </g>
      </svg>
      <div className="line-labels" aria-hidden="true">
        {periods.map((period) => (
          <span key={period.id}>{formatMonthShort(period.periodStart)}</span>
        ))}
      </div>
    </div>
  );
}
