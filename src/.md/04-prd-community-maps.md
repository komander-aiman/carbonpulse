# PRD 04 — Community, Zones, Privacy, Maps, and Content

Parent: `00-carbonpulse-index.md`

## 1. Geography (D15)

Two id spaces exist and must never be joined by accident:

| Concept | Meaning | Id space | Carries cohort statistics? |
|---|---|---|---|
| **Zone** | An Elmina subzone: North, Central, West, East, South, Lake | `zone:<subzone-slug>` | **Yes** — this is the aggregation unit |
| **Precinct** | City of Elmina as a whole | `precinct:elmina` | Only as the sum of published zones; the boundary is context |
| Regional township | Elmina West/East, Bukit Raja, Serenia City, Business Park as *townships* | `township:<slug>` | **No** — regional context on the climate panel only |

Naming collisions are real: `elmina-west` is both a subzone and a regional township id.
Every stored or transported id is namespaced (`zone:elmina-west` vs `township:elmina-west`),
and the zone model never reads the township list.

The 6 subzones are axis-aligned grid cells split from the OSM boundary. They are
**not gazetted neighbourhoods** and are labelled as indicative cells wherever shown.

## 2. Consent model (D21)

| Field | Rule |
|---|---|
| Scope | `aggregation` is the only consent that gates contribution; `content` is a separate optional scope |
| Default | Off |
| Copy | States what is shared (monthly kWh, zone, period), what is never shared (name, email, address, bill image, individual ranking) |
| Viewing | **Consent gates contribution, not viewing.** A non-consenting resident still sees published zone aggregates, the shared goal, and their own coarse band |
| Withdrawal | One click; takes effect in the next rebuild, maximum one hour |
| Record | `consent_event` row with timestamp, policy version, scope, action (`granted`/`withdrawn`), and household id |
| Current state | The last row by `created_at`, not a boolean column |
| Minors | Not supported; pilot households are adults |
| Policy versioning | A material change requires re-consent before the household re-enters the cohort |

Consent is never bundled with terms acceptance, and the control must be reversible from
the Privacy panel and from the community page without contacting support. The community
page copy must not imply that opting out hides the statistics from the resident.

## 3. Aggregation rules

### 3.1 Eligibility

A household contributes to a zone aggregate when all are true:
- Consent active for aggregation.
- A confirmed monthly record exists for the period.
- Household subzone equals the zone.
- `is_demo = false`.
- Household is not marked deleted or flagged for invalid data.

### 3.2 Minimum cohort (D8, D24)

- **k = 5** consenting households with a confirmed record in the period.
- Below k, the API returns `{ suppressed: true, reason: "cohort_too_small" }`. The UI shows "Not enough data yet" and an invitation to participate, never a number or a count below k.
- Additional D24 controls: all published counts and kWh values rounded to 5; thirds only; no per-household value, rank, or exact percentile; band edges never finer than 5 kWh; snapshots published on a delay; privacy sign-off before a real cohort is enabled.
- No mean, no ranking, no percentile finer than thirds.
- The viewer's own record counts toward the zone's n. Excluding the viewer would make a zone of exactly 5 look suppressed to every member.

### 3.3 Published statistics per zone and period

| Statistic | Rule |
|---|---|
| `household_count` | Rounded to 5; only when ≥ k; otherwise suppressed |
| `median_kwh` | Median of eligible households, rounded to 5 |
| `p25_kwh`, `p75_kwh` | Interquartile range, rounded to 5 |
| `p33_kwh`, `p67_kwh` | Band edges, rounded to 5 |
| `coverage_pct` | Eligible records ÷ consenting households |
| `median_kg_co2e` | Median kWh × active factor, 1 decimal |
| `shared_goal_kwh` | Sum of household targets, rounded to 5 |
| `shared_reference_kwh` | Sum of reference-period usage, rounded to 5 |
| `shared_current_kwh` | Sum of current-period usage, rounded to 5 |
| `progress_pct` | D17 formula, clamped 0–100, whole number |
| `suppressed` | Boolean; when true none of the numeric fields are serialised |

Household-facing band returns one of `lower_third`, `middle_third`, `upper_third`, or
`suppressed`, computed against the zone's p33/p67.

A **mean is never published** at any level, including the map and the shared-goal bar.

### 3.4 Version pinning

Each `zone_snapshot` stores `factor_version_id`, `model_version`, `period`, `computed_at`,
and `k_threshold` (default 5). Mixing model versions inside one snapshot is forbidden; if
households use different versions, the snapshot uses the majority version and records the
share.

## 4. Shared goal (D17)

- The shared goal is the sum of each consenting household's own goal (PRD 02 §7).
- Progress compares the current period with a reference period, following the formula in PRD 02 §9.
- Published only when the zone is published. A suppressed zone suppresses the bar.
- The bar shows a text equivalent for assistive technology: reference, current, target, and progress.
- Copy: "Shared goal · 5 households · 50% of the way". Never "the community saved".
- The bar is a scenario-free, non-forecast summary of recorded values.

## 5. Scenario engine

Scenarios are pure functions with no persistence, no consent gate, and no effect on
aggregates. They are deliberately separate code from the zone aggregate: scenario is
unbounded by consent and labelled Scenario; zone statistics are consent-gated snapshots.

### 5.1 Inputs

| Input | Range | Default | Label |
|---|---|---|---|
| Participating households | 10–2,000 | zone count if ≥ k, otherwise 200 | "households in this scenario" |
| Average reduction | 1–25% | 10% | "average reduction per household" |
| Baseline kWh per household | 150–600 | zone median, otherwise 300 | "assumed baseline" |
| Factor | fixed to active version | 0.740 | shown, not editable |

### 5.2 Formulas

```
saved_kwh = households * baseline_kwh * reduction_pct / 100
saved_kg  = saved_kwh * GEF
saved_t   = saved_kg / 1000
annual_t  = saved_t * 12
per_home_kwh = baseline_kwh * reduction_pct / 100
```

Display: saved kWh whole, tonnes to 2 decimals, annual tonnes to 2 decimals.

### 5.3 Copy rules

- Headline: "If N households each reduced by X%…"
- Always show the assumption line: "Assumes a B kWh monthly baseline per household and the 0.740 factor."
- Result badge: Scenario.
- Never phrase as "will save", "projected", or "expected".
- Annualised values must state "if sustained for 12 months".
- If the scenario households exceed the real zone cohort, show "Includes households beyond the current zone cohort" rather than implying real participation.

### 5.4 Edge cases

- Reduction 0 or households 0: disabled, not a zero result.
- Households below k: allowed for scenarios but clearly hypothetical.
- Extremely large values: cap at 2,000 households and 25% to avoid unrealistic claims.
- Rounding: compute unrounded, round only at display.

## 6. Maps (D9)

### 6.1 One map

There is exactly one map: **MapLibre GL JS + OpenFreeMap**. The Leaflet township map is
retired. The climate context moves to a separate panel with no household numbers, so the
map has one purpose: zone shading and the shared goal.

### 6.2 Layers

| Layer | Source | Notes |
|---|---|---|
| Base map | OpenFreeMap vector tiles, Positron style | Attribution required |
| Precinct boundary | Pre-extracted OSM polygon (way 866543395) | Dashed outline, labelled indicative |
| Zone choropleth | `zone_snapshot` per subzone | Only rendered when the zone is published; suppressed zones are neutral grey |
| Public POIs | Pre-extracted GeoJSON: parks, transit, recycling, community centres | Static, cited |
| Shared-goal overlay | Zone progress | Text plus bar, not a colour scale |

No household markers, no clustering of homes, no heatmap of individual points, no
geolocation prompt.

### 6.3 Suppression cascade

1. A zone below k renders as a neutral grey polygon labelled "Not enough data yet".
2. If some zones publish and others do not, published zones shade, suppressed zones stay grey, and the legend explains both.
3. If every zone is suppressed, the map shows the boundary and a single precinct-level suppression message; no shading is invented.
4. The shared-goal bar follows the same cascade.

### 6.4 Interaction and accessibility

- Hover or focus shows a tooltip with zone name, rounded count (or "Not enough data yet"), median kWh (or "suppressed"), and shared-goal progress.
- Clicking a zone filters the scenario inputs to that zone's median, labelled as a scenario preset.
- The map is keyboard accessible and always accompanied by an equivalent data table listing every zone.
- On tile failure, the boundary and zone shapes render on a plain background, the fallback panel appears, and the table remains.
- Lazy-load the map below the fold; do not block LCP. Respect reduced motion and disable fly-to animations.

### 6.5 Payload rules

- No household coordinates exist in any payload, with or without tiles.
- The map payload contains zone polygons, zone names, and published aggregates only.
- A suppressed zone's payload contains no count, median, or band.

## 7. Demo toggle (D22)

| Rule | Behaviour |
|---|---|
| Default | Off. The demo cohort is never the default once a real zone qualifies |
| Reachability | A labelled toggle on the community page only |
| Namespace | `is_demo = true`; separate from real rows |
| Visibility | A demo view shows a banner, a Demo badge, and a distinct map border |
| Isolation | Toggling demo can never change a real median, count, band, or shared goal |
| Suppression | With demo off, a zone below k shows "Not enough data yet". It is never filled with demo rows |
| Copy | "Demo cohort · 128 seeded households · excluded from every real aggregate" |

## 8. Township climate content

### 8.1 Content model

| Field | Type | Rule |
|---|---|---|
| `id` | uuid | |
| `slug` | text | Unique, URL-safe |
| `title` | text | Max 90 chars |
| `summary` | text | Max 240 chars |
| `body_markdown` | text | Sanitized, no raw HTML |
| `hero_image_url` | text | Supabase Storage, max 500 KB, alt text required |
| `hero_alt` | text | Required when a hero image is set |
| `tags` | text[] | Controlled vocabulary: heat, flooding, grid, waste, transport, water, community |
| `related_action_ids` | text[] | Must exist in the action catalog |
| `stat_refs` | jsonb[] | `{ source_id, period, label }` resolved at render |
| `status` | enum | draft, published, archived |
| `published_at` | timestamptz | Required to publish |
| `last_reviewed_at` | date | Required to publish |
| `author_id` | uuid | Admin user |

### 8.2 Seed articles (8)

1. Why Elmina's evening peak matters for grid emissions.
2. What 0.740 kg CO2e/kWh actually means.
3. Heat, cooling, and the 24–26 °C habit.
4. Reading your TNB bill without guessing.
5. Flood resilience and household energy.
6. Where Elmina's waste goes.
7. Walking, cycling, and the first-last-mile gap.
8. How a zone statistic is calculated, and what it is not.

Each must link at least one data source and one action.

### 8.3 Authoring workflow

- `/admin` is gated by a **server-side admin claim**, not an environment stub.
- Draft, preview, publish, archive.
- Preview renders with a Draft banner and is not indexable.
- Publishing requires title, summary, body, hero alt if an image is set, one source, one action, and a last-reviewed date.
- No external CMS.

### 8.4 Rendering

- Server-rendered with metadata and Open Graph tags.
- Related actions rendered as live cards with current savings ranges.
- Source list rendered from `stat_refs` with freshness badges.
- If a referenced source is stale, show a warning on the article.

## 9. Privacy threat model at k = 5

Dropping the threshold to five is a genuine weakening compared with the earlier ten. The residual risk is stated rather
than hidden.

| Threat | Mitigation |
|---|---|
| Re-identification from a small cohort | k = 5 plus every D24 control; coarse thirds only; no exact counts, no rank, no per-household value |
| **Residual inference in a 5-home zone**: a published median plus a published band plus the resident's own value can narrow a neighbour's value | Accepted and documented. Rounded to 5, thirds only, no band edge finer than 5 kWh, delayed publication, and a required privacy sign-off before a real cohort is enabled. If a zone's composition is known to residents, treat the zone median as shared knowledge, not a secret |
| Inference from exact counts plus known neighbours | Suppress counts below k; round larger counts to 5 |
| Inference from a shared goal that is a sum of known targets | Publish progress as a whole percentage and the rounded total only; never per-household targets |
| Address leakage via map | No household coordinates stored for maps; only zone aggregates and public POIs |
| Bill image retention | The image is local-only and never uploaded (D20) |
| Cross-household comparison pressure | Comparison is descriptive; no leaderboard, no named ranking, no exact percentile; tier and group size are always shown |
| Admin overreach | Admin can read content, snapshots, and job runs, never household usage rows; separate service role use |
| Log leakage | Never log kWh, email, or file contents; log ids and status codes |
| Consent drift | Policy version checked before aggregate inclusion |
| Demo data mistaken for real | Namespace column, banner, badge, map border, and a test that toggling cannot change a real snapshot |

### 9.1 Required sign-off

Before a real cohort is enabled in production, the pilot must record a written privacy
sign-off covering: k = 5, the D24 controls, the delayed publication window, the residual
inference risk in a 5-home zone, and the withdrawal path.

## 10. Acceptance criteria

- A zone with 4 consenting households returns suppressed on statistics, map shading, the band, the comparison, and the shared-goal bar.
- A zone with 5 consenting households publishes all of those surfaces, with counts and kWh rounded to 5.
- Withdrawing consent removes the household from the next snapshot within one hour.
- No API response for a household includes another household's id or value.
- No zone response contains a mean.
- The demo toggle on and off cannot change any real snapshot.
- Scenario outputs change only with scenario inputs, never with real cohort size unless the baseline default is used.
- The map renders with tiles blocked, its table is present, and no coordinates appear in any payload.
- An unpublished article returns 404 for anonymous users.
- A non-consenting resident can read every published zone surface.
