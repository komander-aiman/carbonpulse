import { describe, expect, it } from "vitest";
import {
  billingDays,
  buildJourneyEvents,
  compareUsage,
  goalReachedByNewPeriod,
  kwhPerDay,
  normalisePeriod,
  observedChangeCopy,
  selectNextStep,
  summariseTrend,
  type JourneyPeriodInput,
  type JourneyActionInput,
} from "@/domain/journey";

function period(overrides: Partial<JourneyPeriodInput> = {}): JourneyPeriodInput {
  const base: JourneyPeriodInput = {
    id: "p1",
    periodStart: "2026-04-01",
    periodEnd: "2026-05-01",
    kwh: 300,
    flatKg: 222,
    modelledKg: 227.3,
    source: "manual",
    confirmedAt: "2026-05-02T00:00:00Z",
    isDemo: false,
    factorId: "peninsular-2024-provisional",
    factorKgPerKwh: 0.74,
    modelId: "diurnal-1.0.0+2026-10",
    estimateStored: true,
  };
  return { ...base, ...overrides };
}

describe("billing-day normalisation", () => {
  it("treats the end date as exclusive", () => {
    expect(billingDays("2026-04-01", "2026-05-01")).toBe(30);
    expect(billingDays("2026-02-01", "2026-03-01")).toBe(28);
    expect(billingDays("2028-02-01", "2028-03-01")).toBe(29);
  });

  it("returns null for inverted, impossible, and malformed boundaries", () => {
    expect(billingDays("2026-05-01", "2026-04-01")).toBeNull();
    expect(billingDays("2026-04-01", "2026-04-01")).toBeNull();
    expect(billingDays("2026-02-30", "2026-03-01")).toBeNull();
    expect(billingDays("not-a-date", "2026-03-01")).toBeNull();
  });

  it("computes kWh per day only from a positive, finite total", () => {
    expect(kwhPerDay(300, 30)).toBe(10);
    expect(kwhPerDay(0, 30)).toBeNull();
    expect(kwhPerDay(-5, 30)).toBeNull();
    expect(kwhPerDay(Number.NaN, 30)).toBeNull();
    expect(kwhPerDay(300, 0)).toBeNull();
    expect(kwhPerDay(300, null)).toBeNull();
  });

  it("normalises a period and labels it from its start", () => {
    const normalised = normalisePeriod(period());
    expect(normalised.days).toBe(30);
    expect(normalised.kwhPerDay).toBe(10);
    expect(normalised.label).toBe("April 2026");
  });
});

describe("different-length period comparison", () => {
  it("compares daily use, not the raw monthly total", () => {
    const long = normalisePeriod(
      period({ id: "long", periodStart: "2026-06-01", periodEnd: "2026-07-06", kwh: 350 }),
    );
    const short = normalisePeriod(
      period({ id: "short", periodStart: "2026-07-06", periodEnd: "2026-08-01", kwh: 300 }),
    );
    const comparison = compareUsage(long, short);
    expect(long.days).toBe(35);
    expect(short.days).toBe(26);
    expect(comparison.fromKwhPerDay).toBeCloseTo(10, 5);
    expect(comparison.toKwhPerDay).toBeCloseTo(300 / 26, 5);
    // Raw totals fell by 50 kWh, but daily use rose.
    expect(comparison.deltaKwhPerDay).toBeGreaterThan(0);
    expect(comparison.deltaPct).toBeGreaterThan(0);
  });

  it("reports no percentage when the earlier baseline is zero", () => {
    const zero = normalisePeriod(period({ id: "zero", kwh: 0 }));
    const later = normalisePeriod(period({ id: "later", kwh: 300 }));
    const comparison = compareUsage(zero, later);
    expect(comparison.fromKwhPerDay).toBeNull();
    expect(comparison.hasBaseline).toBe(false);
    expect(comparison.deltaPct).toBeNull();
    expect(observedChangeCopy(comparison)).toContain("no usable daily baseline");
  });

  it("reports no percentage when the earlier period has no usable boundaries", () => {
    const broken = normalisePeriod(period({ id: "broken", periodEnd: "2026-03-01" }));
    const later = normalisePeriod(period({ id: "later", periodStart: "2026-05-01", periodEnd: "2026-06-01" }));
    const comparison = compareUsage(broken, later);
    expect(comparison.hasBaseline).toBe(false);
    expect(comparison.deltaKwhPerDay).toBeNull();
  });

  it("describes change as observed usage, never a saving", () => {
    const previous = normalisePeriod(period({ id: "a", kwh: 330 }));
    const current = normalisePeriod(
      period({ id: "b", periodStart: "2026-05-01", periodEnd: "2026-06-01", kwh: 270 }),
    );
    const copy = observedChangeCopy(compareUsage(previous, current));
    expect(copy).toMatch(/Observed daily use/);
    expect(copy).toMatch(/not a measured saving/);
    expect(copy).not.toMatch(/you saved|has saved|because you/i);
  });
});

describe("immutable historical values", () => {
  it("keeps stored estimates and only compares when factor versions match", () => {
    const previous = normalisePeriod(period({ id: "a" }));
    const current = normalisePeriod(
      period({
        id: "b",
        periodStart: "2026-05-01",
        periodEnd: "2026-06-01",
        factorId: "peninsular-2023-provisional",
        factorKgPerKwh: 0.76,
      }),
    );
    const comparison = compareUsage(previous, current);
    expect(comparison.usesRecomputedEstimate).toBe(false);
    expect(comparison.factorsDiffer).toBe(true);
    expect(comparison.emissionsComparable).toBe(false);
  });

  it("does not present a recomputed estimate as a stored one", () => {
    const previous = normalisePeriod(period({ id: "a", estimateStored: false, factorId: null }));
    const current = normalisePeriod(period({ id: "b", estimateStored: true }));
    const comparison = compareUsage(previous, current);
    expect(comparison.usesRecomputedEstimate).toBe(true);
    expect(comparison.emissionsComparable).toBe(false);
  });

  it("summarises a single bill without inventing a trend", () => {
    const summary = summariseTrend([period()]);
    expect(summary.state).toBe("single");
    expect(summary.comparison).toBeNull();
    expect(summary.previous).toBeNull();
  });

  it("marks two bills with an unusable baseline as insufficient", () => {
    const summary = summariseTrend([
      period({ id: "a", kwh: 0 }),
      period({ id: "b", periodStart: "2026-05-01", periodEnd: "2026-06-01" }),
    ]);
    expect(summary.state).toBe("insufficient");
  });

  it("marks two usable bills as ready and computes a mean daily value", () => {
    const summary = summariseTrend([
      period({ id: "a" }),
      period({ id: "b", periodStart: "2026-05-01", periodEnd: "2026-06-01", kwh: 310 }),
    ]);
    expect(summary.state).toBe("ready");
    expect(summary.meanKwhPerDay).toBeCloseTo((300 + 310) / 61, 5);
  });
});

describe("next-step selection", () => {
  const action = (
    id: string,
    state: JourneyActionInput["state"],
  ): JourneyActionInput & { description: string; effort: 1 | 2 | 3 } => ({
    id,
    title: id,
    shortTitle: id,
    description: `${id} description`,
    state,
    effort: 1,
    updatedAt: null,
  });

  it("asks for the first bill when there is no history", () => {
    const step = selectNextStep({ billCount: 0, hasGoal: false, actions: [] });
    expect(step.kind).toBe("enter_first_bill");
    expect(step.href).toBe("/energy/upload");
  });

  it("picks the first uncompleted recommended action after a bill exists", () => {
    const step = selectNextStep({
      billCount: 2,
      hasGoal: true,
      actions: [action("done-one", "done"), action("next-one", "suggested"), action("later", "suggested")],
    });
    expect(step.kind).toBe("action");
    expect(step.actionId).toBe("next-one");
  });

  it("skips dismissed actions and prefers suggested over snoozed", () => {
    const step = selectNextStep({
      billCount: 1,
      hasGoal: true,
      actions: [action("dismissed", "dismissed"), action("snoozed", "snoozed"), action("fresh", "suggested")],
    });
    expect(step.actionId).toBe("fresh");

    const onlySnoozed = selectNextStep({
      billCount: 1,
      hasGoal: true,
      actions: [action("dismissed", "dismissed"), action("snoozed", "snoozed")],
    });
    expect(onlySnoozed.actionId).toBe("snoozed");
  });

  it("falls back to reviewing the plan when every action is complete", () => {
    const step = selectNextStep({
      billCount: 3,
      hasGoal: true,
      actions: [action("a", "done"), action("b", "done")],
    });
    expect(step.kind).toBe("review_plan");
    expect(step.href).toBe("/actions");
  });
});

describe("recorded goal milestones", () => {
  it("records a milestone only when a new bill meets the prior goal", () => {
    expect(goalReachedByNewPeriod([300], 270)?.kwh).toBe(270);
    expect(goalReachedByNewPeriod([300], 290)).toBeNull();
    expect(goalReachedByNewPeriod([], 200)).toBeNull();
  });

  it("uses the same goal engine, so the badge changes at the third period", () => {
    expect(goalReachedByNewPeriod([300, 300], 270)?.label).toBe("Provisional");
    expect(goalReachedByNewPeriod([300, 300, 300], 270)?.label).toBe("Confirmed");
  });
});

describe("journey event ordering", () => {
  it("orders bills, milestones and reported actions chronologically", () => {
    const periods = [
      normalisePeriod(period({ id: "a" })),
      normalisePeriod(period({ id: "b", periodStart: "2026-05-01", periodEnd: "2026-06-01" })),
    ];
    const events = buildJourneyEvents({
      periods,
      milestones: [
        {
          id: "m1",
          kind: "goal_reached",
          label: "Confirmed goal reached",
          detail: "detail",
          occurredAt: "2026-06-02T00:00:00Z",
          isDemo: false,
        },
      ],
      actions: [
        {
          id: "temperature",
          title: "Cool smarter",
          shortTitle: "Cool smarter",
          state: "done",
          updatedAt: "2026-06-03T00:00:00Z",
        },
      ],
    });
    expect(events.map((event) => event.kind)).toEqual(["bill", "bill", "milestone", "action"]);
  });

  it("never invents events for actions without a completion timestamp", () => {
    const events = buildJourneyEvents({
      periods: [],
      milestones: [],
      actions: [
        { id: "a", title: "a", shortTitle: "a", state: "done", updatedAt: null },
        { id: "b", title: "b", shortTitle: "b", state: "suggested", updatedAt: "2026-06-01T00:00:00Z" },
      ],
    });
    expect(events).toEqual([]);
  });
});
