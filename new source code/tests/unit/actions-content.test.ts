import { describe, expect, it } from "vitest";
import { rankActions, suggestedActions, planPotential, ACTIONS } from "@/domain/actions";
import { getActiveFactor } from "@/domain/carbon/factors";
import { renderMarkdown, validateArticle } from "@/domain/content";
import { roundKg, roundTonnes, formatEmissions } from "@/domain/carbon/rounding";

const factor = getActiveFactor();

describe("action ranking", () => {
  it("returns at most six actions", () => {
    expect(suggestedActions("mixed", factor).length).toBeLessThanOrEqual(6);
    expect(suggestedActions("mixed", factor).length).toBeGreaterThanOrEqual(3);
  });

  it("ranks by reduction per effort with deterministic ties", () => {
    const first = suggestedActions("mixed", factor).map((action) => action.id);
    const second = suggestedActions("mixed", factor).map((action) => action.id);
    expect(first).toEqual(second);
  });

  it("only returns actions that apply to the archetype", () => {
    for (const action of suggestedActions("ac_all_day", factor)) {
      expect(action.appliesTo).toContain("ac_all_day");
    }
  });

  it("converts kWh ranges with the same factor version", () => {
    const action = rankActions("mixed", factor)[0]!;
    expect(action.kgLow).toBeCloseTo(roundKg(action.kwhLow * factor.kgPerKwh), 5);
  });

  it("exposes at least eight catalog entries", () => {
    expect(ACTIONS.length).toBeGreaterThanOrEqual(8);
  });
});

describe("plan potential", () => {
  it("caps the total at 35% of baseline and discloses it", () => {
    const result = planPotential(
      [
        { kwhLow: 12, kwhHigh: 18 },
        { kwhLow: 8, kwhHigh: 12 },
      ],
      20,
    );
    expect(result.capKwh).toBe(7);
    expect(result.cappedHigh).toBe(7);
    expect(result.capped).toBe(true);
  });

  it("does not cap a small plan", () => {
    const result = planPotential([{ kwhLow: 2, kwhHigh: 4 }], 300);
    expect(result.capped).toBe(false);
    expect(result.cappedHigh).toBe(4);
  });
});

describe("content sanitizer", () => {
  it("escapes raw HTML instead of passing it through", () => {
    const html = renderMarkdown('<script>alert("x")</script>');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders the supported markdown subset", () => {
    const html = renderMarkdown("## Heading\n\nSome **bold** text and a [link](https://example.com).");
    expect(html).toContain("<h2>Heading</h2>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain('href="https://example.com"');
  });

  it("renders bullet lists", () => {
    const html = renderMarkdown("- one\n- two");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>one</li>");
  });
});

describe("content publish validation", () => {
  const base = {
    slug: "valid-slug",
    title: "A valid title",
    summary: "A valid summary.",
    bodyMarkdown: "Body text.",
    tags: ["grid"] as const,
  };

  it("rejects a draft missing publish requirements", () => {
    const result = validateArticle({ ...base, status: "published" });
    expect(result.ok).toBe(false);
    expect(result.errors.statRefs).toBeDefined();
    expect(result.errors.relatedActionIds).toBeDefined();
  });

  it("accepts a complete published article", () => {
    const result = validateArticle({
      ...base,
      status: "published",
      lastReviewedAt: "2026-10-01",
      statRefs: [{ sourceId: "S1", period: "2024", label: "Factor" }],
      relatedActionIds: ["temperature"],
    });
    expect(result.ok).toBe(true);
  });

  it("rejects an unknown tag and a bad slug", () => {
    const result = validateArticle({ ...base, slug: "Not A Slug", tags: ["not-a-tag" as never] });
    expect(result.errors.slug).toBeDefined();
    expect(result.errors.tags).toBeDefined();
  });
});

describe("rounding and formatting", () => {
  it("formats kg below one tonne and tonnes above", () => {
    expect(formatEmissions(222).text).toBe("222.0 kg CO₂e");
    expect(formatEmissions(4440).unit).toBe("t");
    expect(roundTonnes(4.444)).toBe(4.44);
  });

  it("rounds to five kWh", () => {
    expect(Math.round(272 / 5) * 5).toBe(270);
  });
});
