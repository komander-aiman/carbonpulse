import type { ReactNode } from "react";

export function EvidenceTag({
  label,
  className,
}: {
  label: "Recorded" | "Estimated" | "Modelled" | "Scenario" | "Practical" | "Demo" | "Live" | "Cached" | "Stale";
  className?: string;
}) {
  const key = label.toLowerCase();
  return <span className={`evidence-tag ${key}${className ? ` ${className}` : ""}`}>{label}</span>;
}

export function EvidenceRow() {
  return (
    <div className="evidence-row">
      <div>
        <span className="evidence-swatch recorded-swatch" aria-hidden="true" />
        <strong>Recorded</strong>
        <small>Confirmed from your bill</small>
      </div>
      <div>
        <span className="evidence-swatch estimated-swatch" aria-hidden="true" />
        <strong>Estimated</strong>
        <small>One published annual factor</small>
      </div>
      <div>
        <span className="evidence-swatch modelled-swatch" aria-hidden="true" />
        <strong>Modelled</strong>
        <small>Assumed hourly shape</small>
      </div>
      <div>
        <span className="evidence-swatch scenario-swatch" aria-hidden="true" />
        <strong>Scenario</strong>
        <small>Hypothetical, not a forecast</small>
      </div>
    </div>
  );
}

export function Notice({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warn" | "danger";
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className={`notice ${tone}`} role={tone === "danger" ? "alert" : undefined}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6M12 7.5v.2" />
      </svg>
      <div>
        {title ? <strong>{title}</strong> : null}
        {children}
      </div>
    </div>
  );
}

export function FreshnessBadge({ state, updatedAt }: { state: "live" | "cached" | "stale" | "demo"; updatedAt?: string | null }) {
  const label = state === "live" ? "Live" : state === "cached" ? "Cached" : state === "stale" ? "Stale" : "Demo";
  return (
    <span className={`evidence-tag ${state}`}>
      {label}
      {updatedAt && state === "cached" ? <span className="sr-only"> · updated {updatedAt}</span> : null}
    </span>
  );
}
