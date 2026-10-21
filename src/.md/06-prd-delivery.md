# PRD 06 — Delivery, Acceptance, and Risks

Parent: `00-carbonpulse-index.md`

## 1. Build order

Each phase must render before the next starts. Do not start a phase before the previous
phase's exit check passes.

### Phase 0 — Scaffold

1. Create `src/` as a Next.js App Router + TypeScript strict project (package.json, tsconfig, eslint, vitest, playwright). `src/.md/` is excluded from the build and from typecheck walks.
2. Add Supabase project config, `src/lib/supabase.ts` (server-only admin client), migrations directory, `.env.example`.
3. Port design tokens from `dist/styles.css`; keep the visual language (forest/lime/cream, sidebar, cards, modals).
4. Add `DEMO_MODE`, a demo household bootstrap (128-home deterministic cohort, seed `20261019`), and a visible data-status chip.
5. Add `src/proxy.ts` for the nonce-based CSP.

Exit: all routes render with seeded data; `typecheck`, `lint`, `build` pass.

### Phase 1 — Usage and carbon

1. `domain/carbon`: factor registry, flat estimate, rounding, intensity model, load shapes, modelled estimate.
2. `domain/carbon/interval`: pure functions may land now; the upload UI is Phase 7.
3. Migration and seed for `factor_version`, `model_version`, `intensity_profile`.
4. `/energy/upload`: photo picker (local only, never read for OCR), manual kWh, period, validation (1–3,000 kWh, no overlap, no future, ≤ 24 months).
5. `/energy`: history table, flat vs modelled per period, method panel with factor value, status, model version, source link.
6. `POST /api/estimate` server-side only; persist an `estimate` row with versions and input hash.

Exit: 300 kWh `ac_evening` gives 222.0 flat / 227.3 modelled to one decimal; selecting a photo performs zero network calls and writes zero files.

### Phase 2 — Questionnaire, actions, goal

1. `/questionnaire` with the eight questions, skip and edit paths, and a progress indicator.
2. `domain/profile`: mapping to archetype, profile band, action applicability.
3. `domain/actions`: versioned evidence table (at least 8 actions), ranking by kg saved per effort with a deterministic tie-break, 35% plan cap, overlap discount.
4. `/actions`: add/remove from the plan, mark done, snooze, dismiss; recompute potential on dismissal.
5. Goal: provisional at 1–2 periods, confirmed at 3+, with a badge wherever the goal appears.

Exit: answering "no aircons" removes cooling actions; the goal badge changes from Provisional to Confirmed at the third period.

### Phase 3 — Dashboard and similar homes

1. `/`: six-month trend, current vs previous, goal and badge, action progress, similar-home card, next action, zone teaser.
2. `domain/comparison`: band computation, tier ladder, suppression at n = 4, tier label.
3. `/api/comparison` returns band, rounded group size, difference, and tier — never a raw group member value.

Exit: a 1-person apartment is compared against other 1–2 person apartments in the same zone when n ≥ 5; at n = 4 the card shows the suppression copy.

### Phase 4 — Consent and zones

1. Consent screen (private vs share), `consent_event` rows, policy version, withdrawal.
2. `domain/zone`: k = 5 gate, median, IQR, band edges, rounding to 5.
3. `domain/shared-goal`: aggregation of household goals, progress formula, suppression.
4. `rebuild-zones` job: idempotent snapshot insert, never update in place.
5. `/community`: zone statistics, shared-goal bar, "Not enough data yet" state, demo toggle, consent that gates contribution only.

Exit: 4 consenting homes suppress every zone surface; the 5th publishes; the demo toggle never alters a real median; withdrawal removes the home at the next rebuild.

### Phase 5 — Map and climate context

1. One MapLibre map: OpenFreeMap style, Elmina boundary, 6 subzone polygons shaded by zone median vs precinct median, shared-goal progress, POIs, suppressed zones grey.
2. Data table equivalent, keyboard support, tile-failure fallback.
3. Climate context panel: atmospheric CO2, AQI, PM2.5, CO, weather, 1850–2030 timeline, SDP programme figures, all labelled and attributed, with seeded fallbacks and a 15-minute server-side cache.

Exit: the map renders with tiles blocked; no household coordinates exist in any payload; every non-household figure carries a source or "model estimate" label.

### Phase 6 — Learn, content, admin

1. `/learn`: method, evidence definitions, version registry, limitations, k = 5 rationale.
2. `/township` and `/township/[slug]`: 8 seeded articles, sanitized markdown, related actions, cited sources.
3. `/admin`: role-gated content publish and zone health; no household usage rows.
4. Remove `.openai/hosting.json`'s static `dist` deployment, or repoint it, before any deploy.

### Phase 7 — Deferred to a later release (documented, not built)

CSV interval import, `data.gov.my` / World Bank ingestion jobs, adapter cron, source-health
admin view. The PRD sections stay; they are marked "Phase 2 of delivery" so the suite still
describes the intended system.

### Phase 8 — Hardening

Accessibility (WCAG 2.2 AA, axe on all routes, chart tables), CSP with a nonce in
`src/proxy.ts`, CSRF origin check on all mutations, rate limits, signed HttpOnly session
cookie, secret handling, structured logs with no kWh or PII, unit coverage above 85% in
`domain/`, RLS tests against a live Postgres, offline run.

## 2. Definition of done

- All six journeys pass E2E, including the questionnaire.
- Every displayed number has an evidence label and a source or method link.
- Factor and model versions are persisted with every estimate.
- Suppression works at k = 5 on statistics, the comparison, the map choropleth, and the shared goal.
- Every published count and kWh value is rounded to 5.
- A non-consenting resident can read every published zone surface.
- Consent withdrawal affects the next snapshot within one hour.
- The demo toggle cannot change a real snapshot, and demo mode makes zero external calls.
- The goal is labelled Provisional at 1–2 periods and Confirmed at 3+.
- No bill image is uploaded, stored, or read for OCR.
- Unit coverage above 85% in `domain/`.
- RLS tests prove one household cannot read another's usage and that contribution requires an active consent event.
- Accessibility: no critical axe violations; the map has a table equivalent.
- No PII or kWh values in logs.
- Method and privacy copy reviewed and approved, including the k = 5 privacy sign-off.

## 3. Test matrix

| Scenario | Expected |
|---|---|
| Manual 300 kWh, default archetype | Flat 222.0 kg, modelled value with delta and label |
| Manual 300 kWh, `ac_evening` | Flat 222.0 kg, modelled 227.3 kg |
| Billing period overlapping an existing record | Validation error, no overwrite |
| Billing period ending in the future | Validation error |
| Photo selected, no kWh typed | Zero network requests, zero stored files, form still requires a typed value |
| Questionnaire: no aircons | All cooling actions removed |
| Questionnaire skipped | `mixed` archetype, labelled as default |
| 1 confirmed period | Goal from latest period, badge Provisional |
| 2 confirmed periods | Goal from latest period, badge Provisional |
| 3 confirmed periods | Goal from trailing median, badge Confirmed |
| Comparison tier T1 has n = 4, T2 has n = 12 | Falls back to T2, tier label shown |
| Every comparison tier has n ≤ 4 | Comparison card suppressed, no median or difference |
| Zone with 4 consenting homes | Suppressed on statistics, map, band, comparison, shared goal |
| Zone with 5 consenting homes | Published, count and kWh rounded to 5, no mean |
| Shared goal, worked example | Reference 1,510, current 1,450, target 1,390 → 50% |
| Shared goal, current above reference | Progress 0, "above the shared goal" copy |
| Consent withdrawn | Removed within one hour; confirmation shown |
| Demo toggle on, real zone published | Real median unchanged |
| Demo toggle on, real zone suppressed | "Not enough data yet" remains; demo numbers labelled and separate |
| External source down | Cached badge with timestamp; page renders |
| Network fully offline, demo mode | All views render; map fallback and table visible |
| Admin publishes incomplete article | Blocked with field-level errors |
| Anonymous requests admin route | 404 or redirect, never a flash of admin UI |

## 4. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| k = 5 increases inference risk in a small zone | Privacy harm, trust loss | D24 controls; residual risk stated in PRD 04 §9; privacy sign-off gate before a real cohort; thirds only; no exact counts or per-household values |
| Rebuild discards tested logic from the reference app | Regressions, lost security fixes | Treat the reference as read-only input, port domain logic and tests, and re-run the ported security checklist in PRD 05 §6.1 |
| Extended questionnaire raises drop-off | Lower completion | Eight questions in three groups, skippable, defaults to `mixed`, never blocks the first estimate |
| Demo toggle mistaken for real data | Misleading statistics | Banner, badge, map border, namespaced snapshots, and a test that a toggle cannot change a real median |
| Two geographies (zone vs precinct) confuse users | Wrong comparisons | Namespaced ids, glossary, consistent labels, map legend, and copy rules in PRD 04 and 07 |
| Modelled intraday shape challenged as fabricated | Credibility loss | Label Modelled everywhere; anchor the mean to the official factor; publish the method and limitations; keep flat primary |
| Official factor updated or finalized | Stale estimates | Immutable versions, explicit recalculation, admin refresh |
| Zone never reaches k = 5 | Community feature looks empty | Honest "Not enough data yet" state, recruitment copy, demo toggle clearly separated; do not lower k |
| `data.gov.my` rate limit hit | Sync failures | Bulk files only, 4 req/min ceiling, server-side schedule |
| OSM boundary not official | Geographic inaccuracy | Label indicative; allow admin boundary replacement |
| Map tiles blocked or slow | Broken map | Static GeoJSON fallback, lazy load, data table |
| Upload parsing abuse | Resource exhaustion | Size cap, row cap, in-memory limit, rate limit before parse |
| Consent ambiguity | Legal and ethical exposure | Separate scope, policy version, withdrawal path, event log |
| Team scope creep toward OCR or live intensity | Schedule slip | Explicit non-goals; no new sources without a PRD change |
| Suite grows to eight documents | Divergence | Index document map, reading order, and cross-references use real filenames |

## 5. Open questions

1. Should the pilot recruit through a single community organisation, or allow self-signup with a zone code? Recommendation: zone code issued by the coordinator, validated server-side.
2. Should subzones be grid cells or road-bounded neighbourhoods? **Resolved for the pilot by D15:** the 6 subzones are grid cells split from the OSM boundary. A road-bounded set can replace them later without changing the zone model.
3. Who owns final approval of method copy? Recommendation: a named reviewer on the pilot team must sign off before launch, and the k = 5 privacy sign-off is a separate gate.
4. Is there an official Elmina boundary available from the developer or local authority? Recommendation: request it; keep OSM as fallback.
5. Should anonymous households expire? Recommendation: expire after 180 days of inactivity, with an email reminder only for claimed accounts.

Questions 1 and 3 must be resolved before a real cohort is enabled.

## 6. Out-of-scope follow-ups

- OCR and PDF bill extraction.
- Smart-meter or TNB integration.
- Measured interval grid intensity if a public feed appears.
- Multi-township expansion and Sabah/Sarawak regions.
- Market-based accounting with RECs.
- Native apps.
