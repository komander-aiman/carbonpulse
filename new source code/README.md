# CarbonPulse

Deployable Malaysia pilot for household electricity emissions: a confirmed monthly
kWh value becomes a flat-factor estimate, a modelled time-matched estimate, a
ranked action plan, an opt-in community scenario, and Elmina township content.

This app lives in `new source code/`. The original buildless prototype in `dist/`
is untouched and remains for reference.

## Run locally

```bash
cd "new source code"
npm install
cp .env.example .env.local        # then set SESSION_SECRET
npm run dev
```

Open http://localhost:3000. The demo household is seeded, so every route renders
without an account.

### Environment

| Variable | Purpose |
|---|---|
| `SESSION_SECRET` | Signs the household session cookie. Required in production. |
| `DEMO_MODE` | `true` (default) makes zero external calls and uses seeded data. |
| `NEXT_PUBLIC_APP_URL` | Absolute app URL for metadata. |
| `NEXT_PUBLIC_MAP_STYLE_URL` | MapLibre style; defaults to OpenFreeMap Positron. |
| `CRON_SECRET` | Bearer token for `/api/jobs/[job]`. |
| `ADMIN_STUB` | Enables the pilot admin view. Not a substitute for a real role check. |

Supabase variables are only needed once the in-memory store is replaced by
Postgres.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit`, strict |
| `npm test` | Vitest unit suite |
| `npm run calibrate` | Prints the intensity profile and its validation gates |
| `npm run test:e2e` | Playwright journeys, accessibility, and performance |

## Verification status

| Gate | Result |
|---|---|
| `tsc --noEmit` | clean, strict with `noUncheckedIndexedAccess` |
| `eslint` | clean |
| Unit tests | 85 passing across 6 files |
| E2E | 50 passing on Chromium and Pixel 7 |
| axe (WCAG 2.2 AA) | 0 serious or critical on 8 routes plus the modal, contrast included |
| Calibration | mean 0.739996, bounds 0.607–0.931, evening peak above mean, daytime below night, max hour jump 0.069 |
| Overview LCP | ~1.2 s under 4× CPU throttle and 4G |
| Third-party requests | none beyond Google Fonts |
| SQL tests | written; require a running Postgres (see `db/README.md`) |

## Structure

```
src/
  app/            Routes, API handlers, global styles
  adapters/       Source adapters, recorded fixtures, fallback contract
  components/     Shared UI, map, charts, evidence labels
  domain/         Framework-free logic: carbon, actions, community, content
  lib/            Session, stores, view models, context, formatting
  db/             Seed data: demo household, cohort, Elmina geography, articles
db/
  migrations/     Forward-only schema, RLS, suppression views
  seeds/          Reference data
tests/
  unit/           Domain and adapter tests with golden examples
  e2e/            Journeys, accessibility, performance
  sql/            RLS and suppression tests
scripts/          Build-time calibration
```

## Contracts worth knowing before changing code

- **Two numbers are mandatory.** Every energy screen shows the flat-factor
  estimate and the modelled time-matched estimate side by side. The modelled
  delta is not always negative: an evening-heavy household models higher than
  flat, and the UI never assumes "time-matched means lower".
- **Nothing is measured intraday.** Malaysia publishes no interval grid
  intensity. The hourly curve's annual mean is calibrated to the published
  0.740 factor; both the UI and the method panel say so.
- **Versions are immutable.** Every estimate stores its factor and model
  version. A factor update inserts a new row rather than rewriting history.
- **Suppression lives below the UI.** k = 10 is enforced inside the aggregation
  function, demo rows are excluded by namespace rather than by a query filter,
  and subzones inherit the same rule. A suppressed cohort publishes no count,
  median, band, or choropleth.
- **No household coordinates.** Maps render the indicative OSM boundary,
  subzone aggregates, and public POIs only.
- **Completing an action records intent.** It never produces a "saved kg"
  figure.
- **Anonymous identity is a signed cookie.** No API accepts a household id as a
  parameter.

## Verified external facts used here

- Peninsular GEF 2024 provisional: 0.740 kg CO2e/kWh (Energy Commission).
- `data.gov.my` allows 4 requests/minute; never call it from the browser.
- Open-Meteo free tier is non-commercial with attribution required.
- Overpass and Nominatim are server-side only; `tile.openstreetmap.org` must not
  be used in production.
- Elmina boundary is OSM way 866543395, indicative rather than gazetted.

## Not yet wired

The scaffold uses an in-memory store and seeded adapters so it renders and tests
without credentials. Still to land: swap `src/lib/household-store.ts` for
Supabase queries (schema, RLS, and suppression views are already written in
`db/`), live adapter fetches behind `DEMO_MODE=false`, magic-link claim, and
wiring the cron handlers to real ingestion.

`DEMO_MODE` defaults to on, so every route renders with zero external calls and
adapters fall back to recorded fixtures. Turning it off does not remove the
fallback: a failing source serves its last good value labelled Cached.
