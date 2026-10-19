import type { ContentArticle } from "@/domain/content";

const REVIEWED = "2026-10-01";
const PUBLISHED = "2026-10-05T09:00:00+08:00";
const AUTHOR = "pilot-team";

/**
 * Seeded Elmina articles. Each links at least one action and one cited source,
 * as required to publish.
 */
export const SEED_ARTICLES: readonly ContentArticle[] = [
  {
    id: "article-evening-peak",
    slug: "elmina-evening-peak",
    title: "Why Elmina's evening peak matters for grid emissions",
    summary:
      "Peninsular demand climbs after sunset while solar output falls, so each kilowatt-hour used in the evening carries more carbon than the annual average.",
    bodyMarkdown: `## The shape of the day

Peninsular Malaysia's grid emission factor is published as one annual number. The hour-by-hour reality behind it is not published at all.

Demand rises through the afternoon and peaks between 18:00 and 22:00, just as solar generation drops away. That coincidence is the reason a household's *timing* changes its modelled footprint even when its monthly kWh does not.

## What this means for you

- Two homes using 300 kWh can show different modelled emissions.
- The difference comes from when the load runs, not how much runs.
- The published 0.740 factor remains the auditable headline number.

> The hourly shape is modelled. Its annual average is calibrated to the published factor; Malaysia does not publish interval grid intensity.

## A practical first step

If cooling is your largest evening load, a small thermostat change moves the most kilowatt-hours out of the peak window.`,
    heroImageUrl: null,
    heroAlt: null,
    tags: ["grid", "heat"],
    relatedActionIds: ["temperature", "timer"],
    statRefs: [
      { sourceId: "S1", period: "2024", label: "Peninsular grid emission factor" },
    ],
    status: "published",
    publishedAt: PUBLISHED,
    lastReviewedAt: REVIEWED,
    authorId: AUTHOR,
  },
  {
    id: "article-factor-meaning",
    slug: "what-0740-means",
    title: "What 0.740 kg CO₂e/kWh actually means",
    summary:
      "The number behind every estimate is a generation-weighted average. Here is what it covers, what it excludes, and why it is labelled provisional.",
    bodyMarkdown: `## One number, one year

The 2024 provisional Peninsular grid emission factor is 0.740 kg CO₂e per kilowatt-hour. It is generation-based and published by the Energy Commission.

## What it includes

- Main activity producers' generation, weighted by output.
- Tier 1 emission factors for the fuels burned.
- Net generation as the denominator.

## What it excludes

- Transmission and distribution losses. Adding them silently would overstate your footprint.
- Market instruments such as RECs. This is a location-based estimate.

## Why provisional

The value is provisional and may be finalised. CarbonPulse stores the factor version with every estimate, so a later revision never rewrites your history without saying so.`,
    heroImageUrl: null,
    heroAlt: null,
    tags: ["grid"],
    relatedActionIds: ["led", "standby"],
    statRefs: [
      { sourceId: "S1", period: "2024", label: "Peninsular grid emission factor, provisional" },
      { sourceId: "S5", period: "2023", label: "Final energy consumption by sector" },
    ],
    status: "published",
    publishedAt: PUBLISHED,
    lastReviewedAt: REVIEWED,
    authorId: AUTHOR,
  },
  {
    id: "article-heat-cooling",
    slug: "heat-cooling-24-26",
    title: "Heat, cooling, and the 24–26 °C habit",
    summary:
      "Cooling is the largest controllable load in most Elmina homes. A two-degree change is the cheapest action available.",
    bodyMarkdown: `## Start with the setpoint

Every degree below 24 °C adds roughly 5–10% to cooling energy for a typical split unit. The habit costs nothing and repeats.

## Make it comfortable

- Use a fan to move air rather than dropping the setpoint.
- Close doors so the unit cools one room, not the corridor.
- Clean the filter monthly; a blocked filter wastes the same energy for less comfort.

## Track the change

Because the monthly total is your recorded value, you can compare the next billing period against this one. CarbonPulse does not claim a saving from a completed action; it reports the association when a later period is lower.`,
    heroImageUrl: null,
    heroAlt: null,
    tags: ["heat", "community"],
    relatedActionIds: ["temperature", "ac-servicing"],
    statRefs: [{ sourceId: "S10", period: "2026", label: "Hourly temperature and radiation, Elmina" }],
    status: "published",
    publishedAt: PUBLISHED,
    lastReviewedAt: REVIEWED,
    authorId: AUTHOR,
  },
  {
    id: "article-read-bill",
    slug: "reading-your-tnb-bill",
    title: "Reading your TNB bill without guessing",
    summary:
      "The only number CarbonPulse needs is the confirmed kWh for the billing period. Here is where to find it.",
    bodyMarkdown: `## Find the period and the total

Your bill states the billing period start and end, and the total kWh used. Use both: two bills with the same kWh can cover different numbers of days.

## Check the tariff band

Most homes sit on a domestic tariff. The tariff band does not change the emission factor, but it helps explain why the bill amount moved.

## What to ignore

Do not enter the amount in ringgit. CarbonPulse asks for kWh because that is what the factor multiplies.

## Confirm before saving

The estimate is only as good as the number you confirm. If a bill spans two calendar months, keep it as one period; CarbonPulse attributes emissions to the period label rather than splitting it.`,
    heroImageUrl: null,
    heroAlt: null,
    tags: ["grid", "community"],
    relatedActionIds: ["appliance-schedule", "fridge-clearance"],
    statRefs: [{ sourceId: "S2", period: "2026-08", label: "National monthly electricity consumption" }],
    status: "published",
    publishedAt: PUBLISHED,
    lastReviewedAt: REVIEWED,
    authorId: AUTHOR,
  },
  {
    id: "article-flood-resilience",
    slug: "flood-resilience-household-energy",
    title: "Flood resilience and household energy",
    summary:
      "A wet-season plan for the appliances and circuits that matter most when water rises.",
    bodyMarkdown: `## Before the season

- Raise sockets and the distribution board where practical.
- Keep a torch, power bank, and spare batteries outside the flood line.
- Photograph your meter reading so a disputed bill has a baseline.

## During an outage

Switch off the air conditioner at the isolator before power returns. A sudden restart across a whole neighbourhood is hard on the grid and on the compressor.

## After the water

Do not energise water-damaged appliances. A qualified electrician should inspect before anything is plugged back in.

> This is general guidance, not an emergency plan. Follow local authority advice during a flood.`,
    heroImageUrl: null,
    heroAlt: null,
    tags: ["flooding", "water"],
    relatedActionIds: ["standby", "fridge-clearance"],
    statRefs: [{ sourceId: "S9", period: "2026-09", label: "National air and weather context" }],
    status: "published",
    publishedAt: PUBLISHED,
    lastReviewedAt: REVIEWED,
    authorId: AUTHOR,
  },
  {
    id: "article-waste",
    slug: "where-elmina-waste-goes",
    title: "Where Elmina's waste goes",
    summary:
      "Waste is outside this app's carbon boundary, but it is part of the township story and connects to household habits.",
    bodyMarkdown: `## Beyond electricity

CarbonPulse estimates Scope 2 emissions from purchased electricity only. Waste, transport, and cooking gas sit outside that boundary and are not included in any number here.

## Why it still matters locally

Landfill methane is a large share of a township's non-energy emissions. Separating food waste and recyclables reduces it, and the habits overlap with the ones that cut standby and cooling load.

## Where to start

Use the recycling point nearest you, and rinse containers so a full load is not rejected.`,
    heroImageUrl: null,
    heroAlt: null,
    tags: ["waste", "community"],
    relatedActionIds: ["standby", "appliance-schedule"],
    statRefs: [{ sourceId: "S4", period: "2023", label: "National GHG emissions by source" }],
    status: "published",
    publishedAt: PUBLISHED,
    lastReviewedAt: REVIEWED,
    authorId: AUTHOR,
  },
  {
    id: "article-first-last-mile",
    slug: "walking-cycling-first-last-mile",
    title: "Walking, cycling, and the first-last-mile gap",
    summary:
      "Transport emissions are not in your electricity footprint, but the trips you replace are the largest lever outside the home.",
    bodyMarkdown: `## The gap

Most Elmina trips are short enough to walk or cycle, but the last kilometre to a transit stop is where people default to a car.

## What helps

- A shaded route changes behaviour more than a sign does.
- Secure cycle parking at the stop removes the theft worry.
- One regular trip replaced per week is a habit, not a gesture.

## Keep the numbers separate

CarbonPulse does not add transport savings to your household footprint. Electricity and transport are reported separately so neither is overstated.`,
    heroImageUrl: null,
    heroAlt: null,
    tags: ["transport", "community"],
    relatedActionIds: ["appliance-schedule"],
    statRefs: [{ sourceId: "S6", period: "2024", label: "Household income by district (Petaling proxy)" }],
    status: "published",
    publishedAt: PUBLISHED,
    lastReviewedAt: REVIEWED,
    authorId: AUTHOR,
  },
  {
    id: "article-scenario-calc",
    slug: "how-a-precinct-scenario-is-calculated",
    title: "How a precinct scenario is calculated, and what it is not",
    summary:
      "The precinct slider multiplies three numbers you can see. It is not a forecast and it never touches the cohort statistics.",
    bodyMarkdown: `## The arithmetic

\`households × baseline kWh × reduction % = kWh saved\`, then multiplied by the same 0.740 factor and divided by 1,000 for tonnes.

## What it is not

- Not a forecast of what will happen.
- Not a measured community outcome.
- Not a substitute for comparing two real billing periods.

## Where the baseline comes from

If the cohort has at least 10 consenting households, the default baseline is the cohort median. Below that, the scenario uses 300 kWh and says so. You can always change it.

## Privacy

Scenario inputs are yours. The result is not stored and never enters an aggregate.`,
    heroImageUrl: null,
    heroAlt: null,
    tags: ["community", "grid"],
    relatedActionIds: ["temperature", "appliance-schedule"],
    statRefs: [
      { sourceId: "S1", period: "2024", label: "Peninsular grid emission factor" },
      { sourceId: "S7", period: "2024", label: "Household counts by state" },
    ],
    status: "published",
    publishedAt: PUBLISHED,
    lastReviewedAt: REVIEWED,
    authorId: AUTHOR,
  },
];
