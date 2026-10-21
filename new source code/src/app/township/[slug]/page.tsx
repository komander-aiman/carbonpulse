import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SEED_ARTICLES } from "@/db/articles";
import { ACTIONS } from "@/domain/actions";
import { renderMarkdown } from "@/domain/content";
import { EvidenceTag } from "@/components/evidence";
import { ContextSection } from "@/components/context-section";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = SEED_ARTICLES.find((entry) => entry.slug === slug && entry.status === "published");
  if (!article) return { title: "Article not found" };
  return {
    title: article.title,
    description: article.summary,
    openGraph: {
      title: article.title,
      description: article.summary,
      type: "article",
      publishedTime: article.publishedAt ?? undefined,
    },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = SEED_ARTICLES.find((entry) => entry.slug === slug && entry.status === "published");
  if (!article) notFound();

  const related = ACTIONS.filter((action) => article.relatedActionIds.includes(action.id));
  const html = renderMarkdown(article.bodyMarkdown);

  return (
    <>
      <div className="breadcrumb">
        <Link href="/township">Township content</Link> / {article.title}
      </div>

      <article>
        <header className="page-heading compact-heading">
          <div>
            <ul className="tag-list">
              {article.tags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
            <h1 style={{ maxWidth: "24ch" }}>{article.title}</h1>
            <p>{article.summary}</p>
            <div className="article-meta">
              <span>Published {article.publishedAt ? formatDate(article.publishedAt) : "—"}</span>
              <span>Last reviewed {article.lastReviewedAt ? formatDate(article.lastReviewedAt) : "—"}</span>
              <span>By {article.authorId ?? "pilot team"}</span>
            </div>
          </div>
        </header>

        <div className="two-col">
          <div className="article-body" dangerouslySetInnerHTML={{ __html: html }} />

          <aside className="side-stack">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Related actions</span>
                  <h2>What you can do</h2>
                </div>
              </div>
              <ul className="result-list">
                {related.map((action) => (
                  <li key={action.id}>
                    <span>{action.title}</span>
                    <strong>
                      {action.kwhLow}–{action.kwhHigh} kWh/mo
                    </strong>
                  </li>
                ))}
              </ul>
              <Link className="secondary-button small-button" href="/actions" style={{ marginTop: 14 }}>
                Open your plan
              </Link>
            </section>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Cited sources</span>
                  <h2>Traceability</h2>
                </div>
                <EvidenceTag label="Recorded" />
              </div>
              <ul className="result-list">
                {article.statRefs.map((reference) => (
                  <li key={`${reference.sourceId}-${reference.period}`}>
                    <span>
                      {reference.label} · {reference.sourceId}
                    </span>
                    <strong>{reference.period}</strong>
                  </li>
                ))}
              </ul>
              <p className="source-note">
                Source registry entries are listed on the <Link href="/learn">How it works</Link> page with publisher,
                cadence, and licence.
              </p>
            </section>
          </aside>
        </div>
      </article>

      <ContextSection eyebrow="Local context" title="Conditions this article depends on" compact />
    </>
  );
}
