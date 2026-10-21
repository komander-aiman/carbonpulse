import { FreshnessBadge } from "@/components/evidence";
import type { ContextBlock } from "@/lib/context";

/**
 * Server-rendered context figures. Each carries its source id and a freshness
 * badge, so a cached or stale value is never presented as current.
 */
export function ContextPanel({
  block,
  title,
  eyebrow,
  compact = false,
}: {
  block: ContextBlock;
  title: string;
  eyebrow: string;
  compact?: boolean;
}) {
  const figures = compact ? block.figures.slice(0, 3) : block.figures;

  return (
    <section className="panel section-gap">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        <FreshnessBadge state={block.figures[0]?.freshness ?? "demo"} />
      </div>

      <div className="metric-grid" style={{ marginTop: 18 }}>
        {figures.map((figure) => (
          <article className="metric-card" key={figure.sourceId}>
            <div className="card-topline">
              <span className="metric-icon sky" aria-hidden="true">
                {figure.sourceId}
              </span>
              <FreshnessBadge state={figure.freshness} />
            </div>
            <p>{figure.label}</p>
            <div className="metric-number">
              <strong>{figure.value.split(" ")[0]}</strong>
              <span>{figure.value.split(" ").slice(1).join(" ")}</span>
            </div>
            <small>{figure.detail}</small>
          </article>
        ))}
      </div>

      <p className="source-note">
        Context figures are national or regional and are never a household&rsquo;s own value. National statistics are
        aggregated by their publishers; no township-level measured emissions figure exists publicly. Weather data by
        Open-Meteo.com. Sources and licences are listed on the <a href="/learn">method page</a>.
      </p>
    </section>
  );
}
