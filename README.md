# CarbonPulse

A Next.js + Supabase pilot that turns a household electricity bill into an explainable
CO2e estimate, a personal dashboard with a similar-home comparison, a questionnaire-driven
action plan with a provisional-or-confirmed goal, and — if the resident chooses — a
privacy-safe zone aggregate on one MapLibre map.

The specification lives in `src/.md/` (index, six PRDs, and PRD 07 for the household
profile). `src/` is the application. `dist/` is the original buildless prototype, kept as
a visual reference only; it is not deployed.

---

## Run locally

```bash
npm install
cp .env.example .env.local     # then set SESSION_SECRET
npm run dev
```

Open <http://localhost:3000>. Demo mode is on by default: a deterministic seeded household
and a 128-home demo cohort render every route without an account and without any network
call.

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

## Environment

| Variable | Required | Purpose |
|---|---|---|
| `SESSION_SECRET` | Production | Signs the household session cookie. At least 16 chars; the app throws in production if unset. |
| `DEMO_MODE` | No | Only the literal string `false` turns it off. `true`/unset makes zero external calls and serves seeded data. |
| `NEXT_PUBLIC_APP_URL` | Recommended | Absolute app URL for metadata, and a second allowed host for the CSRF check. |
| `NEXT_PUBLIC_MAP_STYLE_URL` | No | MapLibre style; defaults to OpenFreeMap Positron. |
| `CRON_SECRET` | Production | Bearer token for `/api/jobs/[job]`. |
| `ADMIN_STUB` | No | Enables the pilot admin view in this build. **Not** a substitute for a server-side admin claim. |
| `NEXT_PUBLIC_SUPABASE_URL` etc. | Later | Only needed once the in-memory store is replaced by Postgres. |

## Routes

| Route | What it does |
|---|---|
| `/` | Overview: recorded kWh, both estimates, six-month trend, goal with badge, similar-home card, next action, zone teaser |
| `/energy` | Billing history, flat vs modelled per period, method panel, goal rule |
| `/energy/upload` | Bill photo as a local reference, manual kWh entry, validation |
| `/questionnaire` | Eight-question household profile, skippable and editable |
| `/actions` | Ranked actions filtered by profile, plan selection, potential with overlap discount and cap, goal |
| `/community` | Zone statistics, shared-goal progress, suppression states, one map, demo toggle, consent |
| `/learn` | Method, evidence definitions, version registry, limitations, k = 5 rationale |
| `/township` | Published Elmina articles |
| `/township/[slug]` | One article with cited sources and related actions |
| `/admin` | Pilot admin: content readiness and zone health, never household usage rows |

API: `/api/usage`, `/api/estimate`, `/api/questionnaire`, `/api/actions`, `/api/consent`,
`/api/comparison`, `/api/zone`, `/api/zone/goal`, `/api/community`, `/api/scenario`,
`/api/content`, `/api/jobs/[job]`.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit`, strict with `noUncheckedIndexedAccess` |
| `npm test` | Vitest unit suite |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:e2e` | Playwright: journeys, profile and goal, audit, CSP, accessibility, performance |
| `npm run calibrate` | Prints the intensity profile and its validation gates |

---

## Architecture

```
src/
  app/            App Router pages, API handlers, global styles
  adapters/       Source adapters + recorded fixtures + fallback contract
  components/     UI: sidebar, one MapLibre map, charts, evidence labels, privacy modal
  domain/         Framework-free logic — no React, no I/O, no server-only
    carbon/       Factor registry, intensity model, load shapes, estimates, CSV
    profile/      Questionnaire -> archetype, profile band, action applicability
    actions/      Versioned evidence catalog, ranking, overlap discount, plan cap
    goal/         Provisional and confirmed goal rules (D18)
    comparison/   Similar-home tier ladder and suppression (D16)
    zone/         k = 5 gate, median, IQR, band edges, rounding (D8, D24)
    shared-goal/  Goal aggregation and progress (D17)
    community/    Cohort eligibility, quantiles, scenario, coarse bands
    content/      Markdown sanitizer, publish validation
  lib/            Session, stores, view models, context, CSRF, rate limits
  db/             Seed data: demo household, Elmina zones, articles
db/
  migrations/     Forward-only schema, RLS, suppression views
  seeds/          Reference data
tests/
  unit/           Domain + adapter + security tests with golden examples
  e2e/            Journeys, profile and goal, audit, CSP, accessibility, performance
  sql/            RLS, consent gating, and suppression tests (need a live Postgres)
scripts/          Build-time calibration
```

The dependency rule that keeps this testable: **`domain/` imports nothing from `lib/`,
`app/`, `components/`, or React.** It is pure functions over plain data.

## How the carbon numbers work

1. **Recorded** — the kWh you confirm from a bill.
2. **Estimated (flat)** — `kWh × 0.740`, the published Peninsular factor. This is the
   auditable headline number and it is always shown.
3. **Modelled (time-matched)** — the same kWh distributed across hours using an archetype
   load shape, multiplied by a modelled hourly intensity curve whose annual mean is solved
   so it equals the published factor exactly.

The modelled figure is higher than flat for evening-heavy households, because the evening
peak is more carbon-intensive than the annual average. Golden values for 300 kWh in
September 2026:

| Archetype | Flat | Modelled | Delta |
|---|---|---|---|
| `ac_evening` | 222.0 kg | 227.3 kg | +5.3 kg (+2.4%) |
| `workday_absent` | 222.0 kg | 228.4 kg | +6.4 kg (+2.9%) |
| `mixed` | 222.0 kg | 223.2 kg | +1.2 kg (+0.5%) |
| `ac_all_day` | 222.0 kg | 219.5 kg | −2.5 kg (−1.1%) |

The UI must never hardcode "time-matched means lower" or a "you saved" arrow.

### Calibration gates

`npm run calibrate` fails if any of these break:

- annual demand-weighted mean within 0.0005 of 0.740
- every point inside [0.45, 1.00]
- daytime mean below the evening peak
- no adjacent-hour jump above 0.08

Current: mean `0.739996`, range `0.607–0.931`, max jump `0.069`.

---

## Goal, comparison, and shared goal

**Goal (D18).** One or two confirmed periods give a *Provisional* goal:
`round5(0.9 × latest confirmed kWh)`. Three or more give a *Confirmed* goal:
`round5(0.9 × trailing 3-period median)`. The active rule is always labelled with a badge.

**Similar homes (D16).** The group is chosen by a tier ladder — same zone and same profile
band, then same zone, then same City of Elmina — and each tier needs n ≥ 5. The tier used
and the group size rounded to 5 are always shown. The viewer counts toward their own group.
No mean, rank, individual value, or percentile finer than thirds is ever published.

**Shared goal (D17).** The zone's target is the sum of each consenting household's own
goal. Progress compares the current period with a reference period, clamped 0–100, and is
published only when the zone itself publishes.

## Community privacy

- **k = 5** consenting households with a confirmed record, applied identically to counts,
  medians, band edges, shading, the comparison, and the shared goal.
- All published counts and kWh values are rounded to 5; band edges are never finer than
  5 kWh; thirds only.
- **Consent gates contribution, not viewing.** Anyone can read published zone statistics.
- Below k, every surface says "Not enough data yet" — no count, median, or band leaks.
- The demo namespace is explicit, labelled, and reachable only through the community
  toggle. It can never change a real median.
- No household coordinates are stored for mapping. The map shows zone polygons and public
  POIs only.

The residual inference risk at k = 5 is documented in PRD 04 §9, along with the required
privacy sign-off before a real cohort is enabled.

## Map

`/community` has one map: MapLibre GL JS with OpenFreeMap tiles. It renders the indicative
OSM boundary, six zone polygons shaded against the viewer's zone median, public POIs, and
the shared-goal summary. Suppressed zones are neutral grey. The map always has a table
equivalent and a labelled fallback panel if tiles fail.

Basemap attribution is rendered by MapLibre and includes "© OpenStreetMap contributors"
and "OpenFreeMap © OpenMapTiles".

## Security posture

- **CSP with a per-request nonce**, issued in `src/proxy.ts`. It is deliberately *not* in
  `next.config.ts`: a static policy blocks the App Router's inline bootstrap scripts and
  silently breaks hydration on every page. `csp.spec.ts` asserts the map still initialises,
  that every inline script has a nonce, and that an interactive control responds.
- **CSRF origin check** on every mutating route (`src/lib/csrf.ts`). A request with neither
  `Origin` nor `Referer` is refused.
- **Rate limits**: usage 20/h, estimate 60/h, consent 30/h, questionnaire 30/h, CSV import
  5/h (checked before the 5 MB parse). They are per-process, so a multi-instance deployment
  must move them to Redis or Postgres.
- **Signed session cookie**: `HttpOnly`, `Secure`, `SameSite=Lax`, HMAC-SHA256, verified
  with `timingSafeEqual`. No route or API body accepts a household id.
- **Cron secret** compared in constant time.
- **Markdown is escaped, then a small allowlist is re-applied**, so a pasted `<script>`
  renders as visible text.
- **Admin is not a blanket bypass**: the admin view never reads household usage rows.
- **No bill image is ever uploaded.** The photo picker is a local reference only.

### Known limitations, stated rather than hidden

- The in-memory store and rate limits are **per-process**. A multi-instance deployment must
  move both to Postgres or Redis.
- `ADMIN_STUB` is an environment flag in this build, not a real server-side role check.
- The **SQL suite has never run against a live database**; migration 0004 is reviewed but
  unexecuted.
- Open-Meteo's free tier is non-commercial. Commercialising the pilot requires a paid host
  and key.

---

## Contracts worth knowing before changing code

- **Two numbers are mandatory.** Every energy screen shows flat and modelled side by side.
  The delta direction varies by household; never assume it.
- **Nothing intraday is measured.** Malaysia publishes no interval grid intensity. Only the
  annual mean is anchored to an official value. Say so wherever a modelled figure appears.
- **Versions are immutable.** Each estimate stores its factor and model version. A factor
  update inserts a new row; it never rewrites history.
- **Suppression lives below the UI.** k = 5 is enforced in the zone aggregation function and
  in the database constraint and view, not in a query filter. Demo rows are separated by
  namespace in the domain function as well as the view.
- **Scenario and zone aggregates are separate code.** Scenario is pure, unpersisted, and
  labelled Scenario. Zone statistics are consent-gated snapshots.
- **No household coordinates.** The map shows the indicative OSM boundary, zone
  aggregates, and public POIs only.
- **Completing an action records intent.** It never produces a "saved kg" figure.
- **`domain/` stays pure.** If you need `fetch`, a cookie, or a React hook, it belongs in
  `lib/` or `app/`.

## Verified external facts

Recorded during planning; do not "improve" these into guesses.

- Peninsular GEF 2024 provisional: **0.740 kg CO₂e/kWh** (Energy Commission).
- There is **no public keyless half-hourly Peninsular generation-mix API**.
- `data.gov.my`: 4 requests/minute, CORS `*` but must be server-side only. Filter syntax is
  `ifilter=Petaling@district`; `filter=` returns HTTP 400. `ghg_emissions` returns one row
  per source per date and `net` has a **null** value — filter on `source` or you
  double-count.
- World Bank returns `[meta, rows]`; `EN.ATM.CO2E.PC` is retired, use `EN.GHG.CO2.PC.CE.AR5`.
- Overpass has no CORS headers and returns 406 without a User-Agent. Nominatim blocks
  automated patterns. `tile.openstreetmap.org` blocked an automated request — use
  OpenFreeMap.
- `data.gov.my` has no state-level electricity, no township data, and no sub-national CO₂.
  Every zone statistic is cohort-derived, never a measured township figure.
- Elmina boundary: OSM way `866543395`, bbox `3.1602542,101.4924890,3.2135137,
  101.5288995`. Indicative, not gazetted.

## Not yet wired

The scaffold uses an in-memory store and seeded adapters so it renders and tests without
credentials. Still to land:

1. Replace the in-memory stores with Supabase queries. The schema, RLS, zone and
   comparison tables, and the suppression views already exist in `db/`.
2. Live adapter fetches behind `DEMO_MODE=false`, writing `source_snapshot` rows.
3. The `rebuild-zones` cron handler, wired to real aggregation and snapshot inserts.
4. CSV interval import (deferred to Phase 7 of delivery).
5. Run `tests/sql/rls.test.sql` against a real Postgres.

`DEMO_MODE` defaults to on, so every route renders with zero external calls, and adapters
fall back to recorded fixtures. Turning it off does not remove the fallback: a failing
source serves its last good value labelled **Cached**.
