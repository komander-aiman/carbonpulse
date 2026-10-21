# PRD 01 — Product Requirements

Parent: `1792434273536-00-carbonpulse-index.md`

## 1. Problem

A resident receives a monthly electricity bill in kWh but cannot tell what it means for emissions, which changes matter most, whether neighbours face the same issue, or how the township is responding. Existing calculators output a single opaque number. CarbonPulse makes the chain from usage to local climate action legible and repeatable.

## 2. Personas

| Persona | Need | Success signal |
|---|---|---|
| Resident (primary) | Enter a bill in under a minute, understand the footprint, pick one action | Completes estimate and marks at least one action |
| Curious neighbour | See how the township is doing without exposing anyone | Views community scenario after consenting |
| Township coordinator | Publish local climate content and see participation coverage | Publishes content, sees cohort size above k |
| Reviewer or judge (hackathon) | Verify every claim quickly | Can trace each number to source, formula, and version |

## 3. Core journeys

### J1 First estimate (anonymous)

1. Land on Overview with the demo household preloaded and clearly labelled Demo.
2. Select Add latest bill.
3. Enter billing period and kWh, or upload a half-hourly CSV.
4. Confirm the parsed or typed value. Consent toggle is off by default.
5. See the CO2 estimate with the flat-factor value, modelled time-matched value, evidence labels, factor version, and method link.
6. Land on Action plan with actions ranked for the household.

Acceptance: from first paint to estimate in three interactions, no account required.

### J2 Optional account and sync

1. Resident selects Save my progress.
2. Enters email, receives magic link, returns to the same household record.
3. Prior anonymous data is claimed by the authenticated user via a server-side claim token.

Acceptance: no duplicate household is created; anonymous history is preserved.

### J3 Action plan

1. Actions are generated from appliance survey, usage level, and available savings evidence.
2. Each action shows effort, estimated monthly kWh range, estimated CO2e range, and why it was chosen.
3. Resident marks actions done, snoozes, or dismisses.
4. Progress is shown against the personal target.

Acceptance: dismissing an action does not silently reduce the reported potential; the total recalculates and is labelled.

### J4 Community scenario

1. Resident opts in to aggregation with an explicit consent screen.
2. Precinct pulse shows cohort size, median monthly kWh, participation coverage, and the household's coarse band (for example "lower third of consenting households").
3. Sliders adjust participating households and average reduction; results are labelled Scenario.
4. A map shows the township boundary, aggregate scenario intensity, and public climate POIs. Never household points.

Acceptance: cohort below 10 shows a suppression message, not a number.

### J5 Township climate content

1. Resident opens a content card relevant to Elmina (heat, flooding, grid mix, waste, transport).
2. Content shows publish date, author, and linked local statistics.
3. Content links back to a relevant action.

Acceptance: unpublished content is not reachable; draft preview requires admin role.

## 4. Information architecture

| Route | View | Contents |
|---|---|---|
| `/` | Overview | Headline estimate, target, action progress, trend, next best action, community teaser |
| `/energy` | My energy | Billing periods table, trend, interval detail, calculation card, export |
| `/energy/upload` | Add usage | Manual kWh, CSV upload, validation, consent |
| `/actions` | Action plan | Ranked actions, progress, target ring |
| `/community` | Precinct pulse | Cohort stats, scenario sliders, map, suppression states |
| `/learn` | How it works | Method, evidence labels, privacy, sources |
| `/township/[slug]` | Township content | Articles, local stats, map context |
| `/admin` | Admin | Content drafts, publish, cohort health, factor versions |

Navigation preserves the five-item sidebar from the current prototype. Content is reachable from Overview and Community, not as a sixth top-level item.

## 5. Functional requirements

### FR-1 Usage capture

- FR-1.1 Manual entry accepts kWh 1–3,000, billing period start and end, and optional tariff band.
- FR-1.2 Billing period must be within the last 24 months and must not overlap an existing period for the same household.
- FR-1.3 CSV upload accepts half-hourly or hourly kWh with timestamps, max 5 MB, max 90 days per file.
- FR-1.4 CSV validation reports row-level errors and never partially saves.
- FR-1.5 Uploaded intervals are normalized to Asia/Kuala_Lumpur and stored separately from monthly summaries.
- FR-1.6 Monthly summary is derived from intervals when intervals exist; the derivation is labelled.
- FR-1.7 No file leaves the browser until the resident confirms. Files are processed server-side only after confirmation and are deleted after parsing.
- FR-1.8 Demo data is replaced, not merged, when the first real record is confirmed.

### FR-2 CO2 estimate

- FR-2.1 Always show flat-factor kg CO2e = kWh × active GEF.
- FR-2.2 When a modelled load shape applies, also show modelled time-matched kg CO2e with its delta versus flat factor and a plain-language explanation.
- FR-2.3 When intervals exist, show interval-timed kg CO2e and the intensity series used.
- FR-2.4 Show factor value, region, year, provisional status, and source link.
- FR-2.5 Show model version and last calibration date.
- FR-2.6 Rounding: kWh to whole numbers, kg CO2e to one decimal, tonnes to two decimals. Rounding never occurs before summation.
- FR-2.7 Recalculation is deterministic for the same inputs and versions.

### FR-3 Actions

- FR-3.1 At least three and at most six actions are shown, ranked by estimated CO2e reduction per unit effort.
- FR-3.2 Savings estimates must come from a versioned evidence table, not free text.
- FR-3.3 Each action states assumptions and the household attributes that triggered it.
- FR-3.4 Completing an action asks for an optional confirmation date and never claims measured savings.
- FR-3.5 Household target defaults to 10% below the trailing three-month median, rounded to the nearest 5 kWh.

### FR-4 Community

- FR-4.1 Consent is explicit, revocable, and separate from terms acceptance.
- FR-4.2 Consent records timestamp, policy version, and scope.
- FR-4.3 Aggregates require at least 10 consenting households with a confirmed record in the period.
- FR-4.4 Aggregates expose count, median, interquartile range, and coverage. No mean when the distribution is small and skewed.
- FR-4.5 Household comparisons use coarse bands only: lower third, middle third, upper third, or suppressed.
- FR-4.6 Scenario inputs are bounded and every output carries a Scenario label.
- FR-4.7 Opting out removes the household from the next aggregate rebuild and is reflected within one hour.

### FR-5 Content

- FR-5.1 Content supports title, slug, summary, body Markdown, hero image, tags, local statistic references, related actions, status, publish date, author.
- FR-5.2 Draft content is visible only to admins.
- FR-5.3 Body content is sanitized; raw HTML is rejected.
- FR-5.4 Each article displays at least one cited source and a last-reviewed date.

### FR-6 Data transparency

- FR-6.1 Every external figure shows Live, Cached with timestamp, or Demo.
- FR-6.2 A source registry route lists dataset, publisher, licence, update cadence, and last successful sync.
- FR-6.3 Failed syncs never blank the UI; the last good value with its timestamp is shown.
- FR-6.4 The demo dataset is a separate namespace and is never aggregated with real households.

## 6. UX and content rules

- Evidence labels use the existing visual language: Recorded solid, Estimated outlined, Scenario dotted. Add Modelled as outlined with a pattern marker, and never rely on colour alone.
- The current hardcoded "0.740 factor" chip stays, but becomes dynamic from the factor version record.
- Replace "Illustrative demo" with a status chip that reflects Demo, Live, or Cached.
- Language avoids certainty: "estimated", "modelled", "scenario", never "you saved" unless derived from recorded interval data.
- Empty, loading, error, suppressed, and offline states are designed, not incidental.
- Mobile-first at 360 px; the existing sidebar collapses to a drawer.
- Charts must be keyboard reachable and paired with a data table.

## 7. Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | LCP under 2.5 s on 4G for Overview; estimate response under 300 ms server time |
| Accessibility | WCAG 2.2 AA; visible focus; reduced-motion respected; chart data available as text |
| Privacy | No third-party analytics on bill or interval data; no PII in logs; deletion within 24 hours |
| Security | Server-side validation on every mutation; RLS on all user tables |
| Reliability | Demo mode works with all external sources unreachable |
| Localization | English MVP; copy externalized; units and dates use en-MY |
| Observability | Structured request logs, sync job status, error budget dashboard |

## 8. Success metrics

| Metric | Target |
|---|---|
| Estimate completion rate | 60% of sessions that open the upload flow |
| Time to first estimate | Median under 60 s |
| Action engagement | 40% mark at least one action within 7 days |
| Consent rate | 30% of households with a confirmed record |
| Cohort viability | At least one cohort above k = 10 by pilot week 4 |
| Content reach | 25% of active households open one article |
| Traceability | 100% of displayed figures resolve to a source or method record |

## 9. Explicit assumptions

- The pilot has access to a seeded set of 120 demo households for scenario demonstration, clearly labelled Demo.
- Residents can obtain a bill or interval export; no meter integration is assumed.
- The township boundary is an OSM-derived approximation, labelled indicative.
- Content authors are members of the pilot team, not external editors.
