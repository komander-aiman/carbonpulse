import type { Metadata } from "next";
import Link from "next/link";
import { SEED_ARTICLES } from "@/db/articles";
import { ACTIONS } from "@/domain/actions";
import { CONTENT_TAGS, validateArticle, renderMarkdown } from "@/domain/content";
import { EvidenceTag } from "@/components/evidence";
import { currentHousehold } from "@/lib/current-household";
import { buildCommunityViewModel } from "@/lib/community-view";
import { getConsent } from "@/lib/household-store";
import { formatDate } from "@/lib/format";
import { SITE } from "@/lib/config";
import { getActiveFactor } from "@/domain/carbon/factors";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

/**
 * Pilot admin surface. The role gate is stubbed for the scaffold: when
 * ADMIN_STUB is not enabled the route renders a 404-equivalent refusal and
 * never flashes admin UI. Production swaps this for a Supabase admin claim
 * checked server-side.
 */
function isAdmin(): boolean {
  return process.env.ADMIN_STUB === "true";
}

export default async function AdminPage() {
  if (!isAdmin()) {
    return (
      <>
        <div className="page-heading compact-heading">
          <div>
            <span className="eyebrow">Restricted</span>
            <h1>Not found.</h1>
            <p>This page is only available to pilot administrators.</p>
          </div>
        </div>
        <p className="small muted">
          <Link href="/">Return to overview</Link>
        </p>
      </>
    );
  }

  const data = await currentHousehold();
  const consent = getConsent(data.household.id, "aggregation");
  const community = buildCommunityViewModel(data.household.id, null, consent?.granted ?? false);
  const factor = getActiveFactor();
  const draft = SEED_ARTICLES[0]!;
  const preview = renderMarkdown(draft.bodyMarkdown);
  const checks = SEED_ARTICLES.map((article) => ({ article, validation: validateArticle(article) }));

  return (
    <>
      <div className="page-heading compact-heading">
        <div>
          <span className="eyebrow">Pilot admin</span>
          <h1>Content and cohort health.</h1>
          <p>Server-side role gate. Household usage rows are not readable from this view.</p>
        </div>
        <EvidenceTag label="Recorded" />
      </div>

      <div className="two-col">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Articles</span>
              <h2>{SEED_ARTICLES.length} seeded entries</h2>
            </div>
          </div>
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Scrollable table">
            <table>
              <caption>Publish-readiness checks. Any failed check blocks publishing.</caption>
              <thead>
                <tr>
                  <th scope="col">Slug</th>
                  <th scope="col">Status</th>
                  <th scope="col">Reviewed</th>
                  <th scope="col">Checks</th>
                </tr>
              </thead>
              <tbody>
                {checks.map(({ article, validation }) => (
                  <tr key={article.id}>
                    <td>{article.slug}</td>
                    <td>{article.status}</td>
                    <td>{article.lastReviewedAt ? formatDate(article.lastReviewedAt) : "—"}</td>
                    <td>
                      {validation.ok ? (
                        <span className="form-success">Ready</span>
                      ) : (
                        <span className="field-error">{Object.values(validation.errors).join(" ")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="source-note">
            Controlled tags: {CONTENT_TAGS.join(", ")}. Related actions must exist in the catalog ({ACTIONS.length}{" "}
            entries).
          </p>
        </section>

        <aside className="side-stack">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Cohort health</span>
                <h2>{community.overall.suppressed ? "Suppressed" : "Publishable"}</h2>
              </div>
              <EvidenceTag label={community.isDemoData ? "Demo" : "Recorded"} />
            </div>
            <ul className="result-list">
              <li>
                <span>Township</span>
                <strong>{SITE.townshipName}</strong>
              </li>
              <li>
                <span>Minimum cohort</span>
                <strong>k = {community.minimumCohort}</strong>
              </li>
              <li>
                <span>Cohort size (rounded)</span>
                <strong>{community.overall.suppressed ? "Suppressed" : community.overall.householdCount}</strong>
              </li>
              <li>
                <span>Factor version</span>
                <strong className="mono">{factor.id}</strong>
              </li>
            </ul>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Draft preview</span>
                <h2>Not indexable</h2>
              </div>
              <EvidenceTag label="Demo" />
            </div>
            <div className="notice warn" role="note">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 4 3 20h18L12 4Z" />
                <path d="M12 10v4m0 3v.2" />
              </svg>
              <div>
                <strong>Draft banner</strong>
                This preview is what an anonymous visitor must never see.
              </div>
            </div>
            <div className="article-body" style={{ fontSize: 13 }} dangerouslySetInnerHTML={{ __html: preview }} />
          </section>
        </aside>
      </div>
    </>
  );
}
