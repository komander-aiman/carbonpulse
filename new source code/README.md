# CarbonPulse

A deployable Malaysia pilot for household electricity emissions. A confirmed
monthly kWh value becomes two honest numbers — a flat-factor estimate and a
modelled time-matched estimate — then a ranked action plan, an opt-in community
scenario, and Elmina township content.

This app lives in `new source code/`. The original buildless prototype in `dist/`
is untouched and remains for reference.

---

## Run locally

```bash
cd "new source code"
npm install
cp .env.example .env.local        # then set SESSION_SECRET
npm run dev
```

Open <http://localhost:3000>. A demo household is seeded, so every route renders
without an account and without any network call.

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

## Environment

| Variable | Required | Purpose |
|---|---|---|
| `SESSION_SECRET` | Production | Signs the household session cookie. At least 16 chars; the app throws in production if unset. |
| `DEMO_MODE` | No | `true` (default) makes zero external calls and serves seeded data. |
| `NEXT_PUBLIC_APP_URL` | Recommended | Absolute app URL for metadata, and a second allowed host for the CSRF check. |
| `NEXT_PUBLIC_MAP_STYLE_URL` | No | MapLibre style; defaults to OpenFreeMap Positron. |
| `CRON_SECRET` | Production | Bearer token for `/api/jobs/[job]`. |
| `ADMIN_STUB` | No | Enables the pilot admin view. **Not** a substitute for a real role check. |
| `NEXT_PUBLIC_SUPABASE_URL` etc. | Later | Only needed once the in-memory store is replaced by Postgres. |

## Routes

| Route | What it does |
|---|---|
| `/` | Overview: recorded kWh, both estimates, trend, next action, scenario teaser |
| `/energy` | Full billing history, flat vs modelled per period, method panel, target |
| `/energy/upload` | Manual kWh entry and half-hourly CSV import with validation |
| `/actions` | Ranked action plan with done / snooze / dismiss |
| `/community` | Cohort statistics, consent, scenario sliders, map |
| `/learn` | Method, evidence definitions, version registry, limitations |
| `/township` | Published Elmina articles |
| `/township/[slug]` | One article with cited sources and related actions |
| `/admin` | Pilot admin (role-gated; content and cohort health only) |

API: `/api/usage`, `/api/estimate`, `/api/actions`, `/api/consent`,
`/api/community`, `/api/scenario`, `/api/content`, `/api/jobs/[job]`.

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
| `npm run test:e2e` | Playwright: journeys, audit, CSP, accessibility, performance |
| `npm run calibrate` | Prints the intensity profile and its validation gates |

---

## Architecture

```
src/
  app/            App Router pages, API handlers, global styles
  adapters/       Source adapters + recorded fixtures + fallback contract
  components/     UI: sidebar, map, charts, evidence labels, privacy modal
  domain/         Framework-free logic — no React, no I/O
    carbon/       Factor registry, intensity model, load shapes, estimates, CSV
    actions/      Versioned evidence catalog, ranking, plan caps
    community/    k-anonymity, cohort stats, scenario, target
    content/      Markdown sanitizer, publish validation
  lib/            Session, stores, view models, context, CSRF, rate limits
  db/             Seed data: demo household, Elmina geography, articles
db/
  migrations/     Forward-only schema, RLS, suppression views
  seeds/          Reference data
tests/
  unit/           Domain + adapter + security tests with golden examples
  e2e/            Journeys, audit, CSP, accessibility, performance
  sql/            RLS and suppression tests (need a live Postgres)
scripts/          Build-time calibration
```

The dependency rule that keeps this testable: **`domain/` imports nothing from
`lib/`, `app/`, or React.** It is pure functions over plain data, which is why
102 unit tests run in about two seconds with no fixtures or mocks.

## How the carbon numbers work

1. **Recorded** — the kWh you confirm from a bill, or the total from an uploaded
   interval file. Never overwritten by an estimate.
2. **Estimated (flat)** — `kWh × 0.740`, the published Peninsular factor. This is
   the auditable headline number and it is always shown.
3. **Modelled (time-matched)** — the same kWh distributed across hours using an
   archetype load shape, multiplied by a modelled hourly intensity curve. Its
   annual mean is solved so it equals the published factor exactly.

Every energy screen shows 2 and 3 side by side with the delta and a ±15% range.

### Why the delta is not always negative

The modelled figure is higher than flat for evening-heavy households, because
the evening peak is more carbon-intensive than the annual average. Approved
golden values for 300 kWh in September 2026:

| Archetype | Flat | Modelled | Delta |
|---|---|---|---|
| `ac_evening` | 222.0 kg | 227.3 kg | **+5.3 kg** (+2.4%) |
| `workday_absent` | 222.0 kg | 228.4 kg | **+6.4 kg** (+2.9%) |
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

## Verification status

Last full run on this machine:

| Gate | Result |
|---|---|
| `npm audit --omit=dev` | **0 vulnerabilities** |
| `tsc --noEmit` | clean |
| `eslint` | 0 errors, 0 warnings |
| Unit (Vitest) | **102 passed**, 7 files |
| E2E (Playwright) | **77 passed, 1 skipped** (mobile LCP duplicate), Chromium + Pixel 7 |
| axe WCAG 2.2 AA | 0 serious/critical, 8 routes + modal, contrast **enabled** |
| Overview LCP | ~1.3 s at 4× CPU throttle, 4G |
| Third-party hosts | none beyond Google Fonts |
| Build | 18 routes, succeeds |
| Calibration | all gates pass |
| SQL suite | **not executed** — needs a live Postgres (see `db/README.md`) |

Reproduce:

```bash
npm run typecheck && npm run lint && npm test
npm run build && npm run test:e2e
```

## Security posture

- **CSP with a per-request nonce**, issued in `src/proxy.ts`. It is deliberately
  *not* in `next.config.ts`: a static policy blocks the App Router's inline
  bootstrap scripts and silently breaks hydration on every page. `csp.spec.ts`
  asserts the map still initialises, that every inline script has a nonce, and
  that an interactive control responds.
- **CSRF origin check** on every mutating route (`src/lib/csrf.ts`). A request
  with neither `Origin` nor `Referer` is refused. `SameSite=Lax` alone does not
  cover same-site subdomains.
- **Rate limits**: usage 20/h, CSV import 5/h (checked before the 5 MB parse),
  estimate 60/h, consent 30/h.
- **Signed session cookie**: `HttpOnly`, `Secure`, `SameSite=Lax`, HMAC-SHA256,
  verified with `timingSafeEqual`. No route or API body accepts a household id —
  identity comes only from the verified cookie.
- **Cron secret** compared in constant time.
- **Markdown is escaped, then a small allowlist is re-applied**, so a pasted
  `<script>` renders as visible text. Both `dangerouslySetInnerHTML` sinks use
  that renderer.
- **Admin RLS is not a blanket bypass**: an admin may read content, snapshots,
  and job runs, but never household usage rows.

### Fixed during the security audit

| Severity | Issue | Fix |
|---|---|---|
| Critical | `maplibre-gl` ≤ 6.4.0 zero-click XSS (CVE-2026-85061 / GHSA-jrc7-96c5-q579) | Upgraded to 6.15.0 |
| High | No CSRF protection on any mutating route | Origin/Referer check on all six POST handlers |
| High | No rate limiting despite PRD 05 §6 | Fixed-window limiter on all mutation paths |
| High | No security headers | CSP + nosniff, DENY, referrer, permissions, COOP, HSTS |
| High | Admin RLS could read every household's usage | Removed `is_admin()` from usage/household policies |
| Medium | CSV row errors swallowed — user saw "nothing saved" with no reason | Per-row issues now propagate |
| Medium | Overlapping billing periods accepted (double-counted electricity) | Interval-overlap check |
| Medium | Future billing periods accepted | Reject `periodEnd > now` |
| Medium | Cohort of exactly k=10 showed "suppressed" to every member | Viewer now counted in their own cohort |
| Low | Unbounded in-memory store | Capped at 5,000 with eviction |
| Low | `keydown` listener leak on map remount | Cleanup registered in the async callback |
| Low | Cron secret compared non-constant-time | `timingSafeEqual` |
| Low | Client could label manual entry as `"csv"` | `source` removed from the API schema |

### Known limitations, stated rather than hidden

- The in-memory store and rate limits are **per-process**. A multi-instance
  deployment must move both to Postgres or Redis.
- `ADMIN_STUB` is an environment flag, not a real server-side role check.
- The **SQL suite has never run against a live database**; database migration
  0002 is reviewed but unexecuted.
- Open-Meteo's free tier is non-commercial. Commercialising the pilot requires a
  paid host and key, which breaks the original keyless constraint.

---

## Contracts worth knowing before changing code

- **Two numbers are mandatory.** Every energy screen shows flat and modelled
  side by side. The delta direction varies by household; never assume it.
- **Nothing intraday is measured.** Malaysia publishes no interval grid
  intensity. Only the annual mean is anchored to an official value. Say so
  wherever a modelled figure appears.
- **Versions are immutable.** Each estimate stores its factor and model version.
  A factor update inserts a new row; it never rewrites history.
- **Suppression lives below the UI.** k = 10 is enforced in the aggregation
  function and in `v_cohort_stats_published`, not in a query filter. Demo rows
  are separated by namespace. A suppressed cohort publishes no count, median,
  band, or choropleth.
- **No household coordinates.** The map shows the indicative OSM boundary,
  subzone aggregates, and public POIs only.
- **Completing an action records intent.** It never produces a "saved kg"
  figure; savings are only described when a later recorded period is lower, and
  then as an association.
- **`domain/` stays pure.** If you need `fetch`, a cookie, or a React hook, it
  belongs in `lib/` or `app/`.

## Verified external facts

Recorded during planning; do not "improve" these into guesses.

- Peninsular GEF 2024 provisional: **0.740 kg CO₂e/kWh** (Energy Commission).
- There is **no public keyless half-hourly Peninsular generation-mix API**.
  GSO and TNB publish HTML/chart dashboards only, so any intraday number is
  necessarily modelled.
- `data.gov.my`: 4 requests/minute, CORS `*` (so it looks browser-safe but must
  be server-side only). Filter syntax is `ifilter=Petaling@district`; `filter=`
  returns HTTP 400. `ghg_emissions` returns one row per source per date and
  `net` has a **null** value — filter on `source` or you double-count.
- World Bank returns `[meta, rows]`; `EN.ATM.CO2E.PC` is retired, use
  `EN.GHG.CO2.PC.CE.AR5`.
- Overpass has no CORS headers and returns 406 without a User-Agent. Nominatim
  blocks automated patterns. `tile.openstreetmap.org` blocked an automated
  request in testing — use OpenFreeMap.
- `data.gov.my` has no state-level electricity, no township data, and no
  sub-national CO₂. Every "township" statistic here is cohort-derived or
  context, never a measured township figure.
- Elmina boundary: OSM way `866543395`, bbox `3.1602542,101.4924890,3.2135137,
  101.5288995`. Indicative, not gazetted.

## Not yet wired

The scaffold uses an in-memory store and seeded adapters so it renders and tests
without credentials. Still to land:

1. Replace `src/lib/household-store.ts` with Supabase queries. The schema, RLS,
   and suppression views already exist in `db/`.
2. Live adapter fetches behind `DEMO_MODE=false`, writing `source_snapshot` rows.
3. Magic-link claim (`household.claim_token` → `auth_user_id`).
4. Wire the cron handlers to real ingestion and aggregate rebuild.
5. Run `tests/sql/rls.test.sql` against a real Postgres.

`DEMO_MODE` defaults to on, so every route renders with zero external calls, and
adapters fall back to recorded fixtures. Turning it off does not remove the
fallback: a failing source serves its last good value labelled **Cached**.
