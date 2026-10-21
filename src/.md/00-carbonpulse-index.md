# CarbonPulse PRD Suite — Index and Locked Decisions

Status: Implementation baseline
Scope: Malaysia, City of Elmina pilot
Last updated: 2026-10-21
Source of truth: `src/` (Next.js + Supabase). `src/.md/` is the specification of that app.
`dist/` is a visual reference only and is not deployed.

## 1. Purpose

CarbonPulse converts household electricity use into an explainable CO2e estimate, a
personal dashboard with a similar-home comparison, a questionnaire-driven action plan
with a reliable goal, and — if the resident chooses — a privacy-safe zone aggregate on
the community map.

The product flow is fixed and must be preserved end to end:

```
usage (bill photo as local reference, or typed kWh)
  -> CO2e estimate (flat headline + modelled time-matched)
  -> personal dashboard (6-month trend + similar-home comparison)
  -> household questionnaire -> action plan + goal
  -> share or stay private
  -> zone aggregate when the zone has 5+ households
  -> community map (zone shading + shared-goal progress)
  -> next month: new bill
```

The private branch is a first-class outcome, not an error state: a resident who declines
sharing still gets the dashboard, the plan, and the goal, and sees the published zone
aggregates of others (D21) without contributing to them.

Every number shown must carry an evidence label (Recorded, Estimated, Modelled, Scenario)
and, where it comes from an external source, a data status (Live, Cached, Demo).

## 2. Document map

| Document | Contents | Primary audience |
|---|---|---|
| `00-carbonpulse-index.md` | Index, glossary, locked decisions, non-goals | All |
| `01-prd-product.md` | Personas, journeys, IA, functional requirements, UX rules, metrics | Product, design, engineering |
| `02-prd-carbon-methodology.md` | Formulas, intensity model, factor versioning, target, comparison and shared-goal math, uncertainty, labelling | Engineering, data, review |
| `03-prd-data-apis.md` | Verified sources, adapters, caching, fallbacks, ingestion contracts | Engineering, data |
| `04-prd-community-maps.md` | Consent, k = 5 suppression, zone aggregation, shared goal, one map, threat model, content model | Product, engineering, privacy |
| `05-prd-architecture.md` | Stack, routes, schema, jobs, security, deployment, testing | Engineering |
| `06-prd-delivery.md` | Build order, acceptance criteria, risks, open questions | Delivery, QA |
| `07-prd-household-profile.md` | Questionnaire, archetype mapping, profile bands, similar-home matching, comparison copy | Product, engineering, design |

`FLOWCHART.md` is the canonical flow diagram. Every node in it maps to a named journey or
functional requirement in PRD 01.

## 3. Locked decisions

D1–D7 and D10–D14 stand as originally adopted. D8 and D9 are revised; D15–D25 are new.

| ID | Decision | Rationale |
|---|---|---|
| D1 | Full-stack deployable app, not a static prototype | Aggregation, consent, and admin content require a server |
| D2 | Next.js + TypeScript on Vercel; Supabase Postgres, Auth, Storage | Lowest operational load for a pilot |
| D3 | Anonymous-first identity; optional magic link to sync | Removes signup friction while allowing persistence |
| D4 | Malaysia / Peninsular grid; Elmina as the pilot township | Published factor and a bounded geography |
| D5 | Keyless Malaysian and open data only | No procurement or key-management dependency |
| D6 | Time-matched emissions via a calibrated diurnal model; interval math for uploaded CSV | No public intraday grid-intensity feed exists |
| D7 | Monthly kWh is the primary input; half-hourly CSV is optional | Most residents only have a bill |
| **D8 (revised)** | Community disclosure threshold **k = 5** consenting households with a confirmed record in the period, applied identically to counts, medians, band edges, shading, comparison groups, and the shared goal. No surface uses 10 or 50. | The flowchart sets 5; one threshold everywhere removes the contradiction |
| **D9 (revised)** | One map: **MapLibre GL JS + OpenFreeMap**. Boundary and 6 subzone polygons pre-extracted. Leaflet is not used. | One map implementation, one accessibility story, one CSP entry |
| D10 | Township content authored in a protected in-app admin route, stored in Postgres | No second CMS |
| D11 | No bill OCR in MVP | Accuracy and QA cost outweigh demo value |
| D12 | Every external data call has a cached or seeded fallback and a visible freshness badge | Demo must survive source failure |
| D13 | The **flat** estimate is the household headline; the modelled time-matched value is always shown as the secondary number | The auditable number leads; time-of-use insight does not hide it |
| D14 | Community aggregates use the same engine, factor, and model versions as households | Comparability across the cohort |
| D15 | **Zone = Elmina subzone** (North, Central, West, East, South, Lake). **Precinct = City of Elmina.** The 5 mapped townships are regional context only and never carry cohort statistics. | Resolves 5 markers vs 6 subzones |
| D16 | **Similar homes** = consenting households in the same subzone and the same profile band (home type × household size × aircon band), then same subzone, then same township. Each tier requires n ≥ 5; otherwise suppress. The tier used is always displayed. | Makes the comparison honest about how close the match is |
| D17 | **Shared goal** = the sum of each consenting household's own target in the zone. Progress = `(zone_reference_kwh − zone_current_kwh) / (zone_reference_kwh − zone_target_kwh)`, clamped 0–100, published only at k ≥ 5. | Defines a goal the flowchart names but never specified |
| D18 | **Goal rule**: 1–2 confirmed periods → provisional goal = `round5(0.9 × latest confirmed kWh)`; 3+ periods → confirmed goal = `round5(0.9 × trailing 3-period median)`. The active rule is labelled. | A new resident is not left without a goal |
| D19 | **Questionnaire** is an extended household survey (not a quiz): home type, household size, aircon count, occupancy pattern, cooling hours, water heating, EV charging, appliance ownership. It maps deterministically to an archetype and to action applicability. Skippable; editable; never changes recorded kWh. | The flowchart's quiz becomes a real input to the plan |
| D20 | **Photo upload is local-only reference.** No OCR, no server upload, no retention. The resident always types or confirms kWh. | The flowchart shows a photo; the PRD forbids OCR. Both can be true |
| D21 | **Consent gates contribution, not viewing.** Anyone may see published zone aggregates, shared-goal progress, and their own coarse band. Only consenting households contribute kWh. | Privacy without a paywall on public statistics |
| D22 | **Demo namespace is explicit.** Real zones below k show the "not enough data yet" state. The demo cohort is reachable only via a labelled toggle, is never mixed into real snapshots, and is never the default once a real zone qualifies. | Replaces the silent substitution |
| D23 | **Scope boundaries**: resident estimate = Scope 2 location-based, purchased electricity. The zone map shades published zone aggregates, not a Scope 3 scenario. SDP programme figures are context in the climate panel only; no shipped surface presents a township Scope 3 figure. | Two accounting boundaries used to collide in the UI; the shipped map now carries one |
| D24 | **Compensating privacy controls at k = 5**: all published counts and kWh values rounded to 5; thirds only; no per-household value, rank, or exact percentile; no band edge finer than 5 kWh; zone snapshots published on a delay; documented privacy sign-off required before a real cohort is enabled. | k = 5 is a genuine weakening; these controls are the price |
| D25 | **Source of truth is `src/`** with `src/.md/` as its specification. `dist/` is a visual reference only and is not deployed. | Ends the ambiguity about where the app lives |

## 4. Glossary

| Term | Meaning in this product |
|---|---|
| Recorded | A value the resident confirmed from a bill or uploaded interval file |
| Estimated | A derived value with a disclosed method and factor version |
| Modelled | A derived value that depends on assumptions about load or intensity shape, not measured interval intensity |
| Scenario | A hypothetical calculation with user-controlled inputs; never a forecast |
| Flat estimate | Confirmed kWh × one annual grid emission factor. The auditable headline |
| Modelled estimate | The same kWh distributed across hours by an archetype load shape and weighted by the modelled hourly intensity |
| GEF | Grid Emission Factor, kg CO2e per kWh |
| Time-matched | Emissions computed per interval using an intensity value for that interval |
| Evidence label | Recorded, Estimated, Modelled, or Scenario |
| Data status | Live, Cached, or Demo |
| **Zone** | An Elmina subzone: North, Central, West, East, South, Lake. The unit of cohort statistics |
| **Precinct** | The City of Elmina as a whole. Regional context and the map boundary, never a cohort bucket |
| **Profile band** | `home_type` × `size_band` × `aircon_band`, used to find similar homes |
| **Similar homes** | A consenting group matching the viewer at one of the D16 tiers, published only at n ≥ 5 |
| **Shared goal** | The sum of household targets across a zone, with progress toward it |
| **Provisional goal** | The goal from 1–2 confirmed periods, derived from the latest period alone |
| **Confirmed goal** | The goal from 3+ confirmed periods, derived from the trailing 3-period median |
| **Demo namespace** | Seeded rows with `is_demo = true`, reachable only via the labelled demo toggle |
| Cohort | The consenting households in one zone with a confirmed record in the period (minimum 5) |
| Suppression | Withholding a count, median, band, or shaded polygon because the group is below k or a derived value could reveal a household |
| Interval-timed | Actual consumption timestamps with modelled intensity per interval |

## 5. Non-goals for MVP

- Bill photo OCR, PDF table extraction, or any server-side handling of a bill image.
- Direct smart-meter or TNB API integration.
- Carbon credits, REC retirement, offsets, or assurance-grade inventories.
- Scope 1, or Scope 3 household accounting beyond purchased electricity.
- Market-based accounting or "zero-carbon" claims.
- Per-household disclosure: no public profile, no exact value, no rank, no named leaderboard.
- Live interval grid intensity. All intraday values are modelled.
- Multi-country operation. Sabah and Sarawak factors are stored but not selectable for Elmina.
- A second CMS. Content is authored only in the protected in-app admin route.
- Leaflet, or any second map implementation.
- Demo rows in real aggregates, and demo data as a silent fallback for a small real cohort.
- Native mobile apps.
- Live Overpass or Nominatim calls from the browser.
- CSV interval import, external ingestion jobs, and admin source health in the first
  release. These are documented here and deferred to Phase 7.

## 6. Global product rules

1. No number appears without an evidence label and a method or source link.
2. A recorded value is never overwritten by an estimate without explicit confirmation.
3. Estimates store the factor version and model version that produced them.
4. Scenario results never enter historical totals or community aggregates.
5. No household-level location is rendered on a map, and no household coordinates are stored for mapping.
6. Cohort outputs below k = 5 are suppressed, and every published count and kWh value is rounded to 5 (D24).
7. Seeded or illustrative data is labelled Demo, lives in its own namespace, and is excluded from real aggregates in the domain function, not only in a query.
8. Units are explicit: kWh, kg CO2e, t CO2e, kg CO2e/kWh. One tonne equals 1,000 kg.
9. Charts expose the same data in a table or text summary.
10. Deleting a household removes its usage, intervals, estimates, actions, profile, and consent, and triggers an aggregate rebuild.
11. The private branch always produces a complete product experience: dashboard, plan, goal, and read-only access to published zone statistics.
12. Zone (subzone) and precinct (Elmina) labels are never used interchangeably. Region names for the 5 mapped townships are labelled "regional context".

## 7. Verified source summary (checked 2026-10-19)

- Peninsular GEF 2024 provisional: 0.740 kg CO2e/kWh. Sabah 0.539, Sarawak 0.199. Energy Commission PDF only.
- `data.gov.my`: national monthly electricity consumption and supply, annual national GHG, district and state household statistics. No state electricity, township data, or sub-national CO2.
- `data.gov.my` API limit: 4 requests per minute. Use `storage.data.gov.my` CSV/Parquet for bulk ingestion.
- Open-Meteo archive and air quality: keyless, CORS-enabled, non-commercial free tier, attribution required.
- World Bank `EN.GHG.CO2.PC.CE.AR5`: Malaysia 8.039 t CO2e per capita (2023). `EN.ATM.CO2E.PC` is retired.
- Overpass: no CORS headers, server-side only, and returns 406 without a User-Agent. Nominatim: no runtime autocomplete.
- `tile.openstreetmap.org` blocked an automated request in testing. Use OpenFreeMap.
- No keyless public half-hourly Peninsular generation-mix API exists.
- OpenFreeMap: keyless vector tiles, commercial use allowed, attribution required.
- Elmina boundary: OSM way `866543395`, bbox `3.1602542,101.4924890,3.2135137,101.5288995`. Indicative, not gazetted.

## 8. Reading order

1. `01-prd-product.md` for behaviour.
2. `02-prd-carbon-methodology.md` before writing any calculation.
3. `03-prd-data-apis.md` before writing any adapter.
4. `04-prd-community-maps.md` before touching aggregation or maps.
5. `07-prd-household-profile.md` before touching the questionnaire or the comparison.
6. `05-prd-architecture.md` for structure and schema.
7. `06-prd-delivery.md` for build order and definition of done.
