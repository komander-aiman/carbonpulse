# CarbonPulse PRD Suite — Index and Locked Decisions

Status: Ready for implementation
Scope: Malaysia, City of Elmina pilot
Last updated: 2026-10-19

> Destination note: these documents are intended for `new source code/.md/`. Plan mode can only write to `.kilo/plans/`, so the implementation agent must copy this suite unchanged into `new source code/.md/`.

## 1. Purpose

CarbonPulse converts household electricity use into an explainable CO2e estimate, ranked practical actions, an opt-in community scenario, and locally relevant township climate content.

The product flow is fixed and must be preserved end to end:

```
Electricity usage -> CO2 estimate -> suggested action -> community scenario -> township climate content
```

Every number shown must carry an evidence label (Recorded, Estimated, Modelled, Scenario) and a data status (Live, Cached, Demo).

## 2. Document map

| Document | Contents | Primary audience |
|---|---|---|
| `1792434273536-00-carbonpulse-index.md` | Index, glossary, locked decisions, non-goals | All |
| `1792434273536-01-prd-product.md` | Personas, journeys, functional requirements, UX rules, metrics | Product, design, engineering |
| `1792434273536-02-prd-carbon-methodology.md` | Formulas, diurnal model, factor versioning, uncertainty, labelling | Engineering, data, review |
| `1792434273536-03-prd-data-apis.md` | Verified sources, adapters, caching, fallbacks, ingestion contracts | Engineering, data |
| `1792434273536-04-prd-community-maps.md` | Consent, k-anonymity, aggregation, scenario math, maps, content model | Product, engineering, privacy |
| `1792434273536-05-prd-architecture.md` | Stack, routes, schema, jobs, security, deployment, testing | Engineering |
| `1792434273536-06-prd-delivery.md` | Build order, acceptance criteria, risks, open questions | Delivery, QA |

## 3. Locked decisions

| ID | Decision | Rationale |
|---|---|---|
| D1 | Full-stack deployable app, not a static prototype | Community aggregation, consent, and admin content require a server |
| D2 | Next.js + TypeScript on Vercel; Supabase Postgres, Auth, Storage | Lowest operational load for a pilot |
| D3 | Anonymous-first identity; optional Supabase magic link to sync | Removes signup friction while allowing persistence |
| D4 | Malaysia / Peninsular grid; Elmina as the pilot township | Published factor and a bounded geography |
| D5 | Keyless Malaysian and open data only | No procurement or key-management dependency |
| D6 | Time-matched emissions via a calibrated diurnal model; interval math for uploaded CSV | No public intraday grid-intensity feed exists |
| D7 | Monthly kWh is the primary input; half-hourly CSV is optional | Most residents only have a bill |
| D8 | Community output uses cohort median and coarse percentile bands; minimum cohort k = 10 | Avoids ranking or exposing individual homes |
| D9 | MapLibre with OpenFreeMap vector tiles; Elmina boundary pre-extracted from OSM | No key, no runtime geocoding, attribution-compatible |
| D10 | Township content authored in a protected in-app admin route, stored in Postgres | No second CMS |
| D11 | No bill OCR in MVP | Accuracy and QA cost outweigh demo value |
| D12 | Every external data call has a cached or seeded fallback and a visible freshness badge | Demo must survive source failure |
| D13 | Household headline uses modelled time-matched emissions; the official flat-factor estimate is always shown alongside | Time-of-use insight without hiding the auditable number |
| D14 | Community aggregates use the same engine, factor, and model versions as households | Comparability across the cohort |

## 4. Glossary

| Term | Meaning in this product |
|---|---|
| Recorded | A value the resident confirmed from a bill or uploaded interval file |
| Estimated | A derived value with a disclosed method and factor version |
| Modelled | A derived value that depends on assumptions about load or intensity shape, not measured interval intensity |
| Scenario | A hypothetical calculation with user-controlled inputs; never a forecast |
| Baseline | Reference monthly kWh; for cohorts, the median of eligible households |
| Cohort | Consenting households in one township aggregate bucket with at least 10 members |
| GEF | Grid Emission Factor, kg CO2e per kWh |
| Time-matched | Emissions computed per interval using an intensity value for that interval |
| Flat factor | Total kWh multiplied by one annual GEF |
| Interval-timed | Actual consumption timestamps with modelled intensity per interval |
| Evidence label | Recorded, Estimated, Modelled, or Scenario |
| Data status | Live, Cached, or Demo |
| Suppression | Withholding an aggregate because the cohort is below k or a derived value could reveal it |

## 5. Non-goals for MVP

- Bill photo OCR or PDF table extraction.
- Direct smart-meter or TNB API integration.
- Carbon credits, REC retirement, offsets, or assurance-grade inventories.
- Scope 1 or Scope 3 household accounting beyond electricity.
- Multi-country operation. Sabah and Sarawak factors are stored but not selectable for Elmina.
- Named household leaderboards or public profiles.
- Native mobile apps.
- Claims of measured real-time grid intensity. All intraday values are modelled.
- Live Overpass or Nominatim calls from the browser.

## 6. Global product rules

1. No number appears without an evidence label and a method or source link.
2. A recorded value is never overwritten by an estimate without explicit confirmation.
3. Estimates store the factor version and model version that produced them.
4. Scenario results never enter historical totals or community aggregates.
5. No household-level location is rendered on a map.
6. Cohort outputs below k = 10 are suppressed, including counts that could reveal a small group.
7. Seeded or illustrative data is labelled Demo and excluded from real aggregates.
8. Units are explicit: kWh, kg CO2e, t CO2e, kg CO2e/kWh. One tonne equals 1,000 kg.
9. Charts expose the same data in a table or text summary.
10. Deleting a household removes its usage, intervals, estimates, actions, and consent, and triggers aggregate rebuild.

## 7. Verified source summary (2026-10-19)

- Peninsular GEF 2024 provisional: 0.740 kg CO2e/kWh. Sabah 0.539, Sarawak 0.199. Energy Commission PDF only.
- `data.gov.my`: national monthly electricity consumption and supply, annual national GHG, district and state household statistics. No state electricity, township data, or sub-national CO2.
- `data.gov.my` API limit: 4 requests per minute. Use `storage.data.gov.my` CSV/Parquet for bulk ingestion.
- Open-Meteo archive and air quality: keyless, CORS-enabled, non-commercial free tier, attribution required.
- World Bank `EN.GHG.CO2.PC.CE.AR5`: Malaysia 8.039 t CO2e per capita (2023). `EN.ATM.CO2E.PC` is retired.
- Overpass: no CORS headers, server-side only. Nominatim: no runtime autocomplete.
- No keyless public half-hourly Peninsular generation-mix API exists.
- OpenFreeMap: keyless vector tiles, commercial use allowed, attribution required.

## 8. Reading order

1. `01-prd-product.md` for behaviour.
2. `02-prd-carbon-methodology.md` before writing any calculation.
3. `03-prd-data-apis.md` before writing any adapter.
4. `04-prd-community-maps.md` before touching aggregation or maps.
5. `05-prd-architecture.md` for structure and schema.
6. `06-prd-delivery.md` for build order and definition of done.
