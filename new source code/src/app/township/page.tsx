import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SEED_ARTICLES } from "@/db/articles";
import { EvidenceTag } from "@/components/evidence";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Elmina climate content" };

export default function TownshipIndexPage() {
  const published = SEED_ARTICLES.filter((article) => article.status === "published");
  if (published.length === 0) notFound();

  return (
    <>
      <div className="page-heading compact-heading">
        <div>
          <span className="eyebrow">Township content · City of Elmina</span>
          <h1>Local climate context for this precinct.</h1>
          <p>
            Every article cites at least one source and links to at least one action. Content never introduces a
            township-level measured emissions figure, because none is published.
          </p>
        </div>
        <EvidenceTag label="Recorded" />
      </div>

      <div className="article-grid">
        {published.map((article) => (
          <Link className="article-card" key={article.id} href={`/township/${article.slug}`}>
            <ul className="tag-list">
              {article.tags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
            <h2>{article.title}</h2>
            <p>{article.summary}</p>
            <div className="card-meta">
              <span>Reviewed {article.lastReviewedAt ? formatDate(article.lastReviewedAt) : "—"}</span>
              <span>{article.relatedActionIds.length} action(s)</span>
            </div>
          </Link>
        ))}
      </div>

      <p className="source-note">
        Published articles only. Draft content is not reachable without an admin session.
      </p>
    </>
  );
}
