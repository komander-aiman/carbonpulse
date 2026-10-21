export const CONTENT_TAGS = [
  "heat",
  "flooding",
  "grid",
  "waste",
  "transport",
  "water",
  "community",
] as const;

export type ContentTag = (typeof CONTENT_TAGS)[number];

export type ContentStatus = "draft" | "published" | "archived";

export interface StatRef {
  readonly sourceId: string;
  readonly period: string;
  readonly label: string;
}

export interface ContentArticle {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly bodyMarkdown: string;
  readonly heroImageUrl: string | null;
  readonly heroAlt: string | null;
  readonly tags: readonly ContentTag[];
  readonly relatedActionIds: readonly string[];
  readonly statRefs: readonly StatRef[];
  readonly status: ContentStatus;
  readonly publishedAt: string | null;
  readonly lastReviewedAt: string | null;
  readonly authorId: string | null;
}

const ALLOWED_TAGS = new Set(["p", "h2", "h3", "strong", "em", "ul", "ol", "li", "a", "blockquote", "br"]);

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function inline(value: string): string {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>")
    .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>');
}

/**
 * Markdown subset renderer. Raw HTML in the source is escaped, never passed
 * through, so a pasted `<script>` becomes visible text instead of markup.
 */
export function renderMarkdown(markdown: string): string {
  const blocks = markdown.split(/\n{2,}/);
  const html: string[] = [];
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("### ")) {
      html.push(`<h3>${inline(trimmed.slice(4))}</h3>`);
    } else if (trimmed.startsWith("## ")) {
      html.push(`<h2>${inline(trimmed.slice(3))}</h2>`);
    } else if (trimmed.startsWith("> ")) {
      html.push(`<blockquote>${inline(trimmed.replace(/^>\s?/gm, ""))}</blockquote>`);
    } else if (/^[-*]\s/.test(trimmed)) {
      const items = trimmed
        .split("\n")
        .filter((line) => /^[-*]\s/.test(line.trim()))
        .map((line) => `<li>${inline(line.trim().slice(2))}</li>`)
        .join("");
      html.push(`<ul>${items}</ul>`);
    } else if (/^\d+\.\s/.test(trimmed)) {
      const items = trimmed
        .split("\n")
        .filter((line) => /^\d+\.\s/.test(line.trim()))
        .map((line) => `<li>${inline(line.trim().replace(/^\d+\.\s/, ""))}</li>`)
        .join("");
      html.push(`<ol>${items}</ol>`);
    } else {
      html.push(`<p>${inline(trimmed.replace(/\n/g, " "))}</p>`);
    }
  }
  return html.join("\n");
}

export interface ContentValidation {
  readonly ok: boolean;
  readonly errors: Readonly<Record<string, string>>;
}

export function validateArticle(article: Partial<ContentArticle>): ContentValidation {
  const errors: Record<string, string> = {};
  if (!article.title?.trim()) errors.title = "Title is required.";
  else if (article.title.length > 90) errors.title = "Title must be 90 characters or fewer.";
  if (!article.slug?.trim()) errors.slug = "Slug is required.";
  else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug)) {
    errors.slug = "Slug must be lowercase words separated by hyphens.";
  }
  if (!article.summary?.trim()) errors.summary = "Summary is required.";
  else if (article.summary.length > 240) errors.summary = "Summary must be 240 characters or fewer.";
  if (!article.bodyMarkdown?.trim()) errors.body = "Body is required.";
  if (article.heroImageUrl && !article.heroAlt?.trim()) {
    errors.heroAlt = "Alt text is required when a hero image is set.";
  }
  if (article.status === "published") {
    if (!article.lastReviewedAt) errors.lastReviewedAt = "A last-reviewed date is required to publish.";
    if (!article.statRefs || article.statRefs.length === 0) {
      errors.statRefs = "At least one cited source is required to publish.";
    }
    if (!article.relatedActionIds || article.relatedActionIds.length === 0) {
      errors.relatedActionIds = "At least one related action is required to publish.";
    }
  }
  for (const tag of article.tags ?? []) {
    if (!(CONTENT_TAGS as readonly string[]).includes(tag)) {
      errors.tags = `Unknown tag "${tag}".`;
    }
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

export { ALLOWED_TAGS };
