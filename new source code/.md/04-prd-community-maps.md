# PRD 04 — Community Scenario, Privacy, Maps, and Content

Parent: `1792434273536-00-carbonpulse-index.md`

## 1. Consent model

| Field | Rule |
|---|---|
| Scope | Separate consent for aggregation and for content personalization; aggregation is opt-in |
| Default | Off |
| Copy | States what is shared (monthly kWh, township, period), what is never shared (name, email, address, bill file, individual ranking) |
| Withdrawal | One click; takes effect in the next aggregate rebuild, maximum one hour |
| Record | `consent_event` row with timestamp, policy version, scope, action, and household id |
| Minors | Not supported; pilot households are adults |
| Policy versioning | A material change requires re-consent before the household re-enters the cohort |

Consent is never bundled with terms acceptance, and the toggle must be reversible from the Privacy panel without contacting support.

## 2. Aggregation rules

### 2.1 Eligibility

A household contributes to a cohort when all are true:
- Consent active for aggregation.
- A confirmed monthly record exists for the period.
- Household township equals the cohort township.
- `is_demo = false`.
- Household is not marked deleted or flagged for invalid data.

### 2.2 Minimum cohort

- k = 10 consenting households with a confirmed record.
- Below k, the API returns `{ suppressed: true, reason: "cohort_too_small" }`. The UI shows an invitation to participate, never a number or a count below k.
- Secondary suppression: if exactly one household lies in a band and publishing the band would imply its value, merge bands.
- No mean, no ranking, no percentile finer than thirds.

### 2.3 Published statistics per cohort and period

| Statistic | Rule |
|---|---|
| `household_count` | Exact only when ≥ k; otherwise suppressed |
| `median_kwh` | Median of eligible households |
| `p25_kwh`, `p75_kwh` | Interquartile range, rounded to 5 kWh |
| `coverage_pct` | Eligible records ÷ consenting households |
| `median_kg_co2e` | Median kWh × active factor, or median of household estimates when the same versions apply |
| `pct_below_target` | Share meeting the 10% target, rounded to 5% |
| `actions_completed` | Count of completed actions, aggregate only |

Household-facing comparison returns one of `lower_third`, `middle_third`, `upper_third`, or `suppressed`, computed against the cohort's p33/p67.

### 2.4 Version pinning

Each `cohort_snapshot` stores `factor_version_id`, `model_version`, `period`, `computed_at`, and `k`. Mixing model versions inside one snapshot is forbidden; if households use different versions, the snapshot uses the majority version and records the share.

## 3. Scenario engine

Scenarios are pure functions with no persistence and no effect on aggregates.

### 3.1 Inputs

| Input | Range | Default | Label |
|---|---|---|---|
| Participating households | 10–2,000 | cohort count if ≥ k, otherwise 200 | "households in this scenario" |
| Average reduction | 1–25% | 10% | "average reduction per household" |
| Baseline kWh per household | 150–600 | cohort median, otherwise 300 | "assumed baseline" |
| Factor | fixed to active version | 0.740 | shown, not editable |

### 3.2 Formulas

```
saved_kwh = households * baseline_kwh * reduction_pct / 100
saved_kg  = saved_kwh * GEF
saved_t   = saved_kg / 1000
annual_t  = saved_t * 12
per_home_kwh = baseline_kwh * reduction_pct / 100
```

Display: saved kWh whole, tonnes to 2 decimals, annual tonnes to 2 decimals.

### 3.3 Copy rules

- Headline: "If N households each reduced by X%…"
- Always show the assumption line: "Assumes a B kWh monthly baseline per household and the 0.740 factor."
- Result badge: Scenario.
- Never phrase as "will save", "projected", or "expected".
- Annualized values must state "if sustained for 12 months".
- If the scenario households exceed the real cohort, show "Includes households beyond the current cohort" rather than implying real participation.

### 3.4 Edge cases

- Reduction 0 or households 0: disabled, not a zero result.
- Households below k: allowed for scenarios but clearly hypothetical.
- Extremely large values: cap at 2,000 households and 25% to avoid unrealistic claims.
- Rounding: compute unrounded, round only at display.

## 4. Maps

### 4.1 Purpose

Maps provide geographic context for the township and community scenario. They are not a source of household data.

### 4.2 Layers

| Layer | Source | Notes |
|---|---|---|
| Base map | OpenFreeMap vector tiles, Positron/Liberty style | Attribution required |
| Township boundary | Pre-extracted OSM polygon (way 866543395) | Dashed outline, labelled indicative |
| Scenario choropleth | Cohort snapshot by subzone | Only rendered when cohort ≥ k |
| Public POIs | Pre-extracted GeoJSON: parks, transit, recycling, community centres | Static, cited |
| Climate context | Optional weather station or air-quality marker | No household markers |

### 4.3 Subzones

- Define 4–8 subzones by splitting the Elmina polygon with simple grid or road-based boundaries stored as GeoJSON. Do not infer from household addresses.
- Subzone statistics follow the same k = 10 suppression. If any subzone is suppressed, render it as neutral grey with "Not enough participants".
- If all subzones are suppressed, show the boundary plus a single township-level summary or the suppression state.

### 4.4 Interaction

- Hover or focus shows a tooltip with subzone name, count (or "suppressed"), median kWh (or "suppressed"), and scenario delta.
- Clicking a subzone filters the scenario inputs to that subzone's median, labelled as a scenario preset.
- Map is keyboard accessible; provide an equivalent data table beneath.
- No clustering of households, no heatmap of individual points, no geolocation prompt.

### 4.5 Performance and fallback

- Lazy-load the map below the fold; do not block LCP.
- On tile failure, show the boundary GeoJSON on a plain background with the data table.
- Respect reduced motion; disable fly-to animations.

## 5. Township climate content

### 5.1 Content model

| Field | Type | Rule |
|---|---|---|
| `id` | uuid | |
| `slug` | text | Unique, URL-safe |
| `title` | text | Max 90 chars |
| `summary` | text | Max 240 chars |
| `body_markdown` | text | Sanitized, no raw HTML |
| `hero_image_url` | text | Supabase Storage, max 500 KB, alt text required |
| `hero_alt` | text | Required |
| `tags` | text[] | Controlled vocabulary: heat, flooding, grid, waste, transport, water, community |
| `related_action_ids` | text[] | Must exist in the action catalog |
| `stat_refs` | jsonb[] | `{ source_id, period, label }` resolved at render |
| `status` | enum | draft, published, archived |
| `published_at` | timestamptz | Required to publish |
| `last_reviewed_at` | date | Required to publish |
| `author_id` | uuid | Admin user |

### 5.2 Seed articles (8)

1. Why Elmina's evening peak matters for grid emissions.
2. What 0.740 kg CO2e/kWh actually means.
3. Heat, cooling, and the 24–26 °C habit.
4. Reading your TNB bill without guessing.
5. Flood resilience and household energy.
6. Where Elmina's waste goes.
7. Walking, cycling, and the first-last-mile gap.
8. How a precinct scenario is calculated, and what it is not.

Each must link at least one data source and one action.

### 5.3 Authoring workflow

- `/admin` is role-gated (`admin` claim in Supabase).
- Draft, preview, publish, archive.
- Preview renders with a Draft banner and is not indexable.
- Publishing requires title, summary, body, hero alt, one source, one action, and last-reviewed date.
- No external CMS.

### 5.4 Rendering

- Server-rendered with metadata and Open Graph tags.
- Related actions rendered as live cards with current savings ranges.
- Source list rendered from `stat_refs` with freshness badges.
- If a referenced source is stale, show a warning on the article.

## 6. Privacy threat model

| Threat | Mitigation |
|---|---|
| Re-identification from small cohorts | k = 10, secondary suppression, coarse bands only |
| Inference from exact counts plus known neighbours | Suppress counts below k and round larger counts to nearest 5 |
| Address leakage via map | No household coordinates stored for maps; only township and subzone |
| Bill file retention | Delete after parsing; no thumbnails persisted |
| Cross-household comparison pressure | No leaderboard, no named ranking, no exact percentile |
| Admin overreach | Admin can read content and cohort health, not household usage rows; separate service role use |
| Log leakage | Never log kWh, email, or file contents; log ids and status codes |
| Consent drift | Policy version checked before aggregate inclusion |

## 7. Acceptance criteria

- A cohort of 9 consenting households returns suppressed everywhere, including map and counts.
- Withdrawing consent removes the household from the next snapshot within one hour.
- No API response for a household includes another household's id or value.
- Scenario outputs change only with scenario inputs, never with real cohort size unless the baseline default is used.
- Map renders with tiles blocked.
- An unpublished article returns 404 for anonymous users.
- Demo households never change a real cohort median.
