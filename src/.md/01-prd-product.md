# PRD 01 — Product Requirements

Parent: `00-carbonpulse-index.md`

## 1. Problem

A resident receives a monthly electricity bill in kWh but cannot tell what it means for
emissions, which changes matter most, whether neighbours face the same issue, or how the
township is responding. Existing calculators output a single opaque number. CarbonPulse
makes the chain from usage to local climate action legible and repeatable, and it lets the
resident choose how much of that chain is shared.

## 2. Personas

| Persona | Need | Success signal |
|---|---|---|
| Resident (primary) | Enter a bill in under a minute, understand the footprint, pick one action | Completes estimate and marks at least one action |
| Returning resident (month 2+) | See whether the last month moved, and what to do next | Adds a second period, keeps the plan |
| Privacy-cautious resident | Understand the footprint and the plan without contributing to any aggregate | Completes the estimate and stays private; still reads published zone stats |
| Curious neighbour | See how the zone is doing without exposing anyone | Views zone statistics and the shared goal |
| Township coordinator | Publish local climate content and see participation coverage | Publishes content, sees a zone reach k = 5 |
| Reviewer or judge (hackathon) | Verify every claim quickly | Can trace each number to source, formula, and version |

## 3. Core journeys

### J0 Questionnaire (new)

1. Reached from the bill flow after a confirmed period, and from the action plan.
2. Eight questions in three groups: home (home type, household size), cooling (aircon
   count, occupancy pattern, cooling hours), and appliances (water heating, EV charging,
   appliance ownership).
3. A progress indicator shows position; each group is one screen.
4. "Skip for now" is always available and leaves the archetype at `mixed`.
5. Answers may be edited later from the action plan; editing re-derives the archetype and
   action applicability but never changes a recorded kWh.

Acceptance: answering "no aircons" removes every cooling action; skipping yields the
default `mixed` archetype with an explanatory note; the survey never blocks the estimate.

### J1 First estimate

1. Land on Overview. With no confirmed period the page shows a genuine first-run state,
   not a seeded number.
2. Select Add latest bill.
3. Optionally attach a bill photo as a **local reference only**. The file is never read for
   OCR, never uploaded, and never stored. The resident can look at it while typing.
4. Enter the billing period and kWh, or upload a half-hourly CSV (CSV is deferred to
   Phase 7; the manual path is always available).
5. Confirm the value. Consent for aggregation is a separate, later decision and is off by
   default.
6. See the CO2 estimate: the flat value as the headline, the modelled value second, both
   with evidence labels, factor version, model version, and a method link.

Acceptance: from first paint to estimate in three interactions, no account required,
and selecting a photo performs zero network requests.

### J2 Dashboard

1. Overview shows the recorded kWh for the latest period and the change from the previous
   one, as a difference and a percentage.
2. A six-month trend covers every confirmed period.
3. The current target is shown with its **provisional or confirmed** badge.
4. Action progress, the next best action, and a zone teaser appear alongside.
5. A similar-home card shows the resident's coarse band, the group size rounded to 5, the
   difference from the group median, and the tier used. At n = 4 it shows the suppression
   copy instead.
6. If no questionnaire has been completed, the card explains that similar homes need a
   profile and links to it.

Acceptance: the comparison never names, ranks, or values another household; the tier label
is always present when a comparison is shown.

### J3 Action plan and goal

1. Actions are generated from the questionnaire profile, the usage level, and a versioned
   evidence table. Each shows effort, estimated monthly kWh range, estimated CO2e range,
   and why it was chosen.
2. The resident adds and removes actions, marks them done, snoozes, or dismisses.
3. Combined plan potential is the sum of the selected actions with an overlap discount,
   capped at 35% of the baseline; the cap is disclosed when it applies.
4. The goal is provisional at 1–2 confirmed periods and confirmed at 3+, using D18.
5. Progress is shown against the goal, never as "you saved".

Acceptance: dismissing an action does not silently reduce the reported potential; the total
recalculates and is labelled. The goal badge flips from Provisional to Confirmed at the
third period.

### J4 Share decision

1. After the plan, the resident is asked: stay private, or share this household's monthly
   kWh with the zone.
2. The consent screen states what is shared (monthly kWh, zone, period), what is never
   shared (name, email, address, bill image, individual ranking), the policy version, and
   the timestamp.
3. "Stay private" is a valid, non-discouraged choice. It leads to the Overview.
4. "Share" records a consent event and leads to the community view.
5. Consent is reversible from the Privacy panel and from the community page.

Acceptance: the private branch renders the Overview with no warning or degraded state;
withdrawal is recorded as an event and removes the household at the next rebuild.

### J5 Zone aggregate

1. The community view shows the zone's published statistics: rounded household count,
   median, interquartile range, and the resident's coarse band.
2. The shared-goal bar shows progress toward the sum of household targets.
3. A zone with 0–4 eligible households shows "Not enough data yet" everywhere: the card,
   the map polygon, and the shared-goal bar. No count, median, or band leaks.
4. Statistics are readable without consent (D21); consenting is a separate action.
5. The demo toggle sits apart from the real zone, labelled, and never replaces a qualifying
   real zone.

Acceptance: 4 consenting homes suppress every surface; the 5th publishes; the demo toggle
cannot change a real median.

### J6 Climate context and township content

1. Atmospheric CO2, AQI, PM2.5, CO, and weather are shown as **regional model estimates**
   with source and freshness labels.
2. A 1850–2030 timeline places the global concentration next to SDP programme figures,
   explicitly labelled as programme context, not a forecast and not deducted from any
   household estimate.
3. Township articles give local context, cite at least one source, and link at least one
   action.

Acceptance: no household numbers appear in the climate panel; every figure carries a source
or a "model estimate" label.

## 4. Information architecture

| Route | View | Contents |
|---|---|---|
| `/` | Overview | Headline flat estimate, modelled secondary, target and badge, action progress, six-month trend, similar-home card, next action, zone teaser |
| `/energy` | My energy | Billing periods table, trend, flat vs modelled per period, method panel, factor and model versions |
| `/energy/upload` | Add usage | Photo as local reference, manual kWh, period validation, CSV entry point (deferred), consent is not collected here |
| `/questionnaire` | Household profile | Eight questions, skip, edit, progress indicator |
| `/actions` | Action plan | Ranked actions filtered by profile, plan selection, done/snooze/dismiss, potential with cap, goal with badge |
| `/community` | Community | Zone statistics, shared-goal bar, suppression states, map, demo toggle, consent control |
| `/learn` | How it works | Method, evidence definitions, version registry, limitations, k = 5 rationale |
| `/township` | Township content | Published Elmina articles |
| `/township/[slug]` | One article | Sanitized markdown, cited sources, related actions |
| `/admin` | Admin | Role-gated content publish and zone health; never household usage rows |

The sidebar keeps five items: Overview, My energy, Action plan, Community, How it works.
The questionnaire is reached from the bill flow and the action plan, never as a sixth tab.
The climate panel and township content are reached from Community and Overview.

## 5. Functional requirements

### FR-1 Usage capture

- FR-1.1 Manual entry accepts kWh 1–3,000, billing period start and end, and a billing label.
- FR-1.2 The billing period must be within the last 24 months, must not end in the future, and must not overlap an existing period for the same household. `periodEnd` is exclusive.
- FR-1.3 Half-hourly or hourly CSV upload accepts timestamps and kWh, max 5 MB, max 90 days per file. Deferred to Phase 7; the API and validation functions may land earlier.
- FR-1.4 CSV validation reports row-level errors and never partially saves.
- FR-1.5 Uploaded intervals are normalized to Asia/Kuala_Lumpur and stored separately from monthly summaries.
- FR-1.6 A monthly summary derived from intervals is labelled as derived.
- FR-1.7 **A bill photo is a local reference only (D20).** No OCR, no upload, no retention. The image never leaves the browser and no byte of it is sent to the server.
- FR-1.8 Demo data is replaced, not merged, when the first real record is confirmed.

### FR-2 CO2 estimate

- FR-2.1 Always show flat-factor kg CO2e = kWh × active GEF, as the headline.
- FR-2.2 Also show modelled time-matched kg CO2e with its delta versus flat and a plain-language explanation. The delta direction varies by household and is never assumed negative.
- FR-2.3 When intervals exist, show interval-timed kg CO2e and the intensity series used.
- FR-2.4 Show factor value, region, year, provisional status, and source link.
- FR-2.5 Show model version and last calibration date.
- FR-2.6 Rounding: kWh to whole numbers, kg CO2e to one decimal, tonnes to two decimals, published cohort values to 5. Rounding never occurs before summation.
- FR-2.7 Recalculation is deterministic for the same inputs and versions.

### FR-3 Questionnaire and profile (new, D19)

- FR-3.1 Eight fields in three groups, with a progress indicator and a skip path.
- FR-3.2 Answers map deterministically to one archetype and to an action applicability set.
- FR-3.3 Answers are editable; editing re-derives the profile but never alters a recorded kWh, an estimate, or a published aggregate.
- FR-3.4 A missing profile defaults to `mixed` and is labelled as a default, not as an answer.
- FR-3.5 The stored profile carries `completed_at` and a questionnaire version.

### FR-4 Similar homes (new, D16)

- FR-4.1 The comparison group is chosen by the tier ladder: same subzone and same profile band, then same subzone, then same township.
- FR-4.2 Each tier requires n ≥ 5; if the closest tier does not qualify, fall back to the next wider tier; if none qualifies, suppress.
- FR-4.3 Always display the tier used, in words, and the group size rounded to 5.
- FR-4.4 Show the resident's coarse band, the group median, and the difference in kWh and kg. Never show another household's value, rank, or exact percentile.
- FR-4.5 The band uses p33/p67 of the comparison group and is one of `lower_third`, `middle_third`, `upper_third`, `suppressed`.

### FR-5 Goal (new, D18)

- FR-5.1 With 1–2 confirmed periods, the goal is `round5(0.9 × latest confirmed kWh)` and is labelled **Provisional**.
- FR-5.2 With 3+ confirmed periods, the goal is `round5(0.9 × trailing 3-period median)` and is labelled **Confirmed**.
- FR-5.3 The badge is a small label, never a sentence, and is present wherever the goal appears.
- FR-5.4 Goal progress never implies measured savings; it compares recorded values with the goal.

### FR-6 Actions

- FR-6.1 At least three and at most six actions are shown, ranked by estimated CO2e reduction per unit effort.
- FR-6.2 Savings estimates come from a versioned evidence table, not free text.
- FR-6.3 Each action states assumptions, the household attributes that triggered it, and its evidence version.
- FR-6.4 Completing an action records intent and never claims measured savings.
- FR-6.5 Plan potential applies an overlap discount, is capped at 35% of baseline, and discloses the cap.

### FR-7 Consent and viewing (new, D21)

- FR-7.1 Consent is explicit, revocable, and separate from terms acceptance.
- FR-7.2 Consent records timestamp, policy version, scope, and action (`granted`/`withdrawn`).
- FR-7.3 Only consenting households contribute kWh to a zone aggregate.
- FR-7.4 Anyone may read published zone aggregates, shared-goal progress, and their own band without consenting.
- FR-7.5 Withdrawal removes the household from the next rebuild, within one hour.

### FR-8 Zone aggregate and shared goal (new)

- FR-8.1 A zone publishes at k = 5 eligible households with a confirmed record in the period.
- FR-8.2 Published values: rounded count, median, p25/p75, p33/p67, band edges to 5 kWh, household coarse band, shared-goal progress. Never a mean.
- FR-8.3 Below k, every surface shows "Not enough data yet" with the same wording.
- FR-8.4 Shared goal = sum of household targets in the zone; progress follows D17 and is clamped 0–100.
- FR-8.5 Shared-goal progress is published only when the zone is published; a suppressed zone suppresses the bar too.

### FR-9 Demo namespace (new, D22)

- FR-9.1 Demo rows carry `is_demo = true` in their own namespace and are excluded from real aggregates in the domain function.
- FR-9.2 The demo cohort is reachable only through a labelled toggle on the community page.
- FR-9.3 The toggle is never on by default once a real zone qualifies, and never changes a real snapshot.
- FR-9.4 A demo view carries a banner, a badge, and a distinct map border.

### FR-10 Climate context

- FR-10.1 Atmospheric CO2, AQI, PM2.5, CO, and weather are labelled regional model estimates with source and freshness.
- FR-10.2 Feeds are fetched server-side with a 15-minute cache; demo mode makes zero external calls and labels every value Fallback.
- FR-10.3 The timeline's SDP figures are programme context and are never deducted from a household estimate.

### FR-11 Content

- FR-11.1 Content supports title, slug, summary, body Markdown, hero image and alt, tags, local statistic references, related actions, status, publish date, author.
- FR-11.2 Draft content is visible only to admins.
- FR-11.3 Body content is sanitized; raw HTML is rejected.
- FR-11.4 Each article displays at least one cited source and a last-reviewed date.

## 6. UX and content rules

- Evidence labels use the existing visual language: Recorded solid, Estimated outlined, Modelled outlined with a pattern marker, Scenario dotted. Never rely on colour alone.
- The factor chip is dynamic from the factor version record; "0.740" is never hardcoded in a component.
- Language avoids certainty: "estimated", "modelled", "scenario". Never "you saved" and never "you will save".
- The suppression copy is exactly "Not enough data yet" wherever a zone is below k, with one explanatory sentence and one invitation to participate.
- One map only: MapLibre. No household points, no heatmap of homes, no geolocation prompt.
- The goal badge reads "Provisional" or "Confirmed"; it is a badge, not a sentence, and appears on the Overview, the action plan, and the energy page.
- Empty, loading, error, suppressed, and offline states are designed, not incidental.
- Mobile-first at 360 px; the sidebar collapses to a drawer.
- Charts are keyboard reachable and paired with a data table.
- "Netizen emission" appears nowhere in the UI. The feature is "Community".

## 7. Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | LCP under 2.5 s on 4G for Overview; estimate response under 300 ms server time |
| Accessibility | WCAG 2.2 AA; visible focus; reduced-motion respected; chart data available as text; map has a table equivalent |
| Privacy | No third-party analytics on bill or interval data; no PII in logs; deletion within 24 hours |
| Security | Server-side validation on every mutation; RLS on all user tables; nonce-based CSP |
| Reliability | Demo mode works with all external sources unreachable |
| Localization | English MVP; copy externalized; units and dates use en-MY |
| Observability | Structured request logs, sync job status, error budget dashboard |

## 8. Success metrics

| Metric | Target |
|---|---|
| Estimate completion rate | 60% of sessions that open the upload flow |
| Time to first estimate | Median under 60 s |
| Questionnaire completion | 50% of households that confirm a second period |
| Comparison view rate | 40% of sessions with a published comparison |
| Action engagement | 40% mark at least one action within 7 days |
| Consent rate | 30% of households with a confirmed record |
| Zone viability | At least one zone reaches k = 5 by pilot week 4 |
| Content reach | 25% of active households open one article |
| Traceability | 100% of displayed figures resolve to a source or method record |

## 9. Explicit assumptions

- The seed supplies a deterministic demo cohort of 128 households across the 6 subzones, clearly labelled Demo.
- Residents can obtain a bill; no meter integration is assumed.
- The 6 subzones are grid cells split from the OSM boundary, not gazetted neighbourhoods.
- The township boundary is an OSM-derived approximation, labelled indicative.
- Content authors are members of the pilot team, not external editors.
- At k = 5 a zone may take several weeks to publish; the product must look complete before then.
