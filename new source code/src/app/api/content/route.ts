import { NextResponse } from "next/server";
import { SEED_ARTICLES } from "@/db/articles";
import { renderMarkdown, validateArticle } from "@/domain/content";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");

  if (slug) {
    const article = SEED_ARTICLES.find((entry) => entry.slug === slug && entry.status === "published");
    if (!article) {
      return NextResponse.json(
        { ok: false, error: { code: "not_found", message: "Article not found." } },
        { status: 404 },
      );
    }
    return NextResponse.json({
      ok: true,
      data: { ...article, html: renderMarkdown(article.bodyMarkdown) },
    });
  }

  return NextResponse.json({
    ok: true,
    data: SEED_ARTICLES.filter((article) => article.status === "published").map((article) => ({
      slug: article.slug,
      title: article.title,
      summary: article.summary,
      tags: article.tags,
      publishedAt: article.publishedAt,
      lastReviewedAt: article.lastReviewedAt,
      relatedActionIds: article.relatedActionIds,
    })),
  });
}

export async function POST(request: Request) {
  if (process.env.ADMIN_STUB !== "true") {
    return NextResponse.json(
      { ok: false, error: { code: "forbidden", message: "Admin access required." } },
      { status: 403 },
    );
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { ok: false, error: { code: "invalid_body", message: "Expected a JSON article body." } },
      { status: 422 },
    );
  }
  const validation = validateArticle(body as never);
  if (!validation.ok) {
    return NextResponse.json(
      { ok: false, error: { code: "invalid_content", message: "Publish checks failed.", fields: validation.errors } },
      { status: 422 },
    );
  }
  return NextResponse.json({ ok: true, data: { status: "accepted" } }, { status: 201 });
}
