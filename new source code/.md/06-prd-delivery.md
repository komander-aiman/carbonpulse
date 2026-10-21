# PRD 06 — Delivery, Acceptance, and Risks

Parent: `1792434273536-00-carbonpulse-index.md`

## 1. Build order

Each phase must be demoable. Do not start a phase before the previous phase's exit check passes.

### Phase 0 — Foundation

1. Scaffold Next.js + TypeScript strict, lint, formatting, Vitest, Playwright.
2. Add Supabase project, migration tooling, and local dev instructions.
3. Migrate design tokens and shared layout from `dist/styles.css` and `dist/index.html`.
4. Port the five views as routes with static demo data, preserving visual parity.
5. Add `DEMO_MODE` and a demo household bootstrap.

Exit: all routes render with seeded data, visual regression baseline captured, CI green.

### Phase 1 — Usage and carbon engine

1. Implement `domain/carbon` with factor registry, flat calculation, and rounding.
2. Seed factor versions (Peninsular 2022–2024, Sabah, Sarawak) with source metadata.
3. Build the load-shape archetypes and the diurnal intensity calibration script.
4. Store `model_version` and `intensity_profile` rows; add calibration tests.
5. Implement modelled time-matched calculation and delta copy.
6. Implement CSV interval parsing, validation, coverage, and interval-timed calculation.
7. Build `/energy/upload`, `/energy`, and the estimate API.
8. Add method panel with factor value, provisional status, model version, and source link.

Exit: golden-file examples from the methodology PRD match to one decimal; upload and manual paths both persist and render.

### Phase 2 — Actions

1. Create the versioned action evidence table with at least 8 actions across cooling, standby, lighting, hot water, and appliance scheduling.
2. Implement ranking by CO2e reduction per effort with deterministic tie-breaks.
3. Port the action plan UI and completion states to the database.
4. Compute the 10% target from the trailing three-month median.
5. Ensure completing an action never reports measured savings.

Exit: ranking changes sensibly with household profile; no "you saved X" language without recorded comparison.

### Phase 3 — Community, consent, and maps

1. Add consent flow, events, and withdrawal.
2. Build aggregation job and `cohort_snapshot` snapshots with suppression.
3. Build `/community` with cohort stats, coarse band, and suppression states.
4. Implement the shared scenario function and sliders.
5. Add MapLibre with OpenFreeMap, boundary, subzones, and PRD 04 layers.
6. Add map data-table fallback and keyboard support.

Exit: 9-household cohort is suppressed end to end; 10-household cohort publishes; map works with tiles blocked; demo rows excluded.

### Phase 4 — Content and admin

1. Build content schema, sanitizer, and `/township/[slug]`.
2. Build `/admin` with role gate, draft, preview, publish, archive.
3. Seed 8 Elmina articles with sources and linked actions.
4. Add freshness badges and stale-source warnings.

Exit: anonymous users cannot reach drafts; published articles render sources and related actions.

### Phase 5 — Data adapters and operations

1. Implement adapters for data.gov.my bulk files, World Bank, Open-Meteo, and the Energy Commission factor extraction.
2. Add cron jobs, idempotent snapshots, and `job_run` logging.
3. Add context blocks to Overview, Community, and content pages.
4. Add admin source-health view and alerting.
5. Run the offline and failure drills.

Exit: every adapter can fail without blanking a page; cached values carry timestamps; no browser call to restricted hosts.

### Phase 6 — Polish and hardening

1. Accessibility audit and fixes.
2. Performance budget check on Overview and Community.
3. Privacy review of logs, cookies, and admin access.
4. Threat-model review of aggregation and map layers.
5. Final visual regression and E2E suite.

Exit: definition of done met.

## 2. Definition of done

- All five core journeys pass E2E.
- Every displayed number has an evidence label and a source or method link.
- Factor and model versions are persisted with every estimate.
- Suppression works for cohorts below 10, including derived counts and map layers.
- Consent withdrawal affects the next snapshot within one hour.
- Demo mode makes zero external calls and renders all pages.
- Unit coverage above 85% in `domain/`.
- RLS tests prove one household cannot read another's usage.
- Accessibility: no critical axe violations; map has a table equivalent.
- No PII or kWh values in logs.
- Uploads are deleted within one hour.
- Method and privacy copy reviewed and approved.

## 3. Test matrix

| Scenario | Expected |
|---|---|
| Manual 300 kWh, default archetype | Flat 222.0 kg; modelled value with delta and label |
| CSV with 1,440 valid rows, 99% coverage | Interval result, coverage shown |
| CSV with duplicate timestamps | Row-level errors, nothing saved |
| CSV with values above 50 kWh per interval | Blocked pending unit confirmation |
| Billing period overlapping existing | Validation error, no overwrite |
| Factor version superseded | Old estimate remains; recalculation shows delta |
| Cohort 9 | Suppressed stats, counts, and map choropleth |
| Cohort 10 | Published stats with rounded counts |
| One household in a band | Secondary suppression on that band |
| Consent withdrawn | Removed within one hour; confirmation shown |
| External source down | Cached badge with timestamp; page renders |
| Network fully offline, demo mode | All views render; map fallback visible |
| Admin publishes incomplete article | Blocked with field-level errors |
| Anonymous requests admin route | 404 or redirect, never a flash of admin UI |

## 4. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Modelled intraday shape is challenged as fabricated | Credibility loss | Label Modelled everywhere; anchor mean to official factor; publish method and limitations; keep flat factor primary |
| Official factor updated or finalized | Stale estimates | Immutable versions, explicit recalculation, admin refresh |
| Cohort never reaches k = 10 | Community feature looks empty | Demo cohort labelled Demo; recruitment copy; suppress honestly rather than lowering k |
| data.gov.my rate limit hit | Sync failures | Bulk files only, 4 req/min ceiling, server-side schedule |
| OSM boundary not official | Geographic inaccuracy | Label indicative; allow admin boundary replacement |
| Map tiles blocked or slow | Broken map | Static GeoJSON fallback, lazy load, data table |
| Upload parsing abuse | Resource exhaustion | Size cap, row cap, in-memory limit, rate limit |
| Consent ambiguity | Legal and ethical exposure | Separate scope, policy version, withdrawal path, audit log |
| Team scope creep toward OCR or live intensity | Schedule slip | Explicit non-goals; no new sources without a PRD change |

## 5. Open questions

1. Should the pilot recruit through a single community organisation, or allow self-signup with a township code? Recommendation: township code issued by the coordinator, validated server-side.
2. Should subzones be grid cells or road-bounded neighbourhoods? Recommendation: 6 road-bounded polygons derived once from OSM and reviewed by the coordinator.
3. Who owns final approval of method copy? Recommendation: a named reviewer on the pilot team must sign off before launch.
4. Is there an official Elmina boundary available from the developer or local authority? Recommendation: request it; keep OSM as fallback.
5. Should anonymous households expire? Recommendation: expire after 180 days of inactivity, with an email reminder only for claimed accounts.

None of these block Phases 0–2. Questions 1 and 2 must be resolved before Phase 3 ships.

## 6. Out-of-scope follow-ups

- OCR and PDF bill extraction.
- Smart-meter or TNB integration.
- Measured interval grid intensity if a public feed appears.
- Multi-township expansion and Sabah/Sarawak regions.
- Market-based accounting with RECs.
- Native apps.
