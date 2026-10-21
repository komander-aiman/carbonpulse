# PRD 05 — Technical Architecture

Parent: `00-carbonpulse-index.md`

## 1. Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript, strict mode | Server Components for reads, Route Handlers for mutations |
| Styling | Existing CSS tokens migrated to design tokens; CSS Modules or plain CSS | Reuse the current visual language; no component library mandate |
| Charts | Hand-built SVG components | Must expose accessible data tables |
| Map | MapLibre GL JS + OpenFreeMap | Client component, lazy loaded. Leaflet is not used |
| Validation | Zod at every boundary | Shared schemas between client and server |
| Database | Supabase Postgres | RLS on all household data |
| Auth | Supabase Auth magic link, anonymous sessions | Optional upgrade path |
| Storage | Supabase Storage for content images only | No bill files |
| Jobs | Vercel Cron hitting protected route handlers | Idempotent, snapshot-based |
| Observability | Structured JSON logs, job run table, error alerting | No PII |
| Tests | Vitest for units, Playwright for journeys, SQL tests for RLS and aggregates | |

Do not introduce a separate Express server, a second database, a headless CMS, or keyed
carbon APIs.

## 2. Repository layout (D25)

`src/` is the app root. `src/.md/` is the specification and is excluded from the build and
from `tsconfig` walks.

```
src/
  app/
    page.tsx                    Overview
    energy/page.tsx
    energy/upload/page.tsx
    questionnaire/page.tsx
    actions/page.tsx
    community/page.tsx
    learn/page.tsx
    township/page.tsx
    township/[slug]/page.tsx
    admin/page.tsx
    api/
      estimate/route.ts
      usage/route.ts
      questionnaire/route.ts
      actions/route.ts
      consent/route.ts
      comparison/route.ts
      zone/route.ts
      zone/goal/route.ts
      scenario/route.ts
      content/route.ts
      jobs/[job]/route.ts
  domain/
    carbon/         factor registry, flat, modelled, interval, rounding, load shapes
    profile/        questionnaire -> archetype, band, action applicability
    actions/        versioned evidence catalog, ranking, plan cap, overlap discount
    comparison/     tier ladder, band, suppression
    zone/           k gate, median, IQR, band edges, rounding
    shared-goal/    goal aggregation, progress, suppression
    community/      cohort eligibility, scenario, coarse band
    content/        schema and sanitizer
  adapters/
    data-gov-my/
    open-meteo/
    world-bank/
    energy-commission/
  db/
    migrations/
    queries/
    seeds/demo/
  components/
  lib/              session, stores, view models, context, CSRF, rate limits
tests/
  unit/
  e2e/
  sql/
```

`domain/` is framework-free TypeScript: no `import "server-only"`, no React, no cookies, no
`fetch`, no database imports. All I/O lives in `lib/`. This is what keeps the domain suite
fast and reusable by jobs.

## 3. Request flow

### 3.1 Estimate

```
POST /api/estimate
  -> Zod validate { kwh, periodStart, periodEnd, archetype? }
  -> load active factor version and model version
  -> domain/carbon: flat, modelled
  -> persist estimate row with versions and input hash
  -> return { flat, modelled, delta, labels, versions, sources }
```

- Server computes; the client never calculates an emission value for display.
- `input_hash` prevents duplicate rows for identical inputs.
- The household id comes only from the verified session cookie.

### 3.2 Questionnaire

```
POST /api/questionnaire
  -> Zod validate the eight answers
  -> domain/profile: archetype, band, applicability
  -> persist household_profile with completed_at and version
  -> recompute action applicability; never touch recorded kWh
```

### 3.3 Comparison read

```
GET /api/comparison
  -> resolve household from the signed cookie
  -> domain/comparison: tier ladder, n >= 5, band
  -> return { tier, groupN (rounded), medianKwh, p33, p67, band, differenceKwh, differenceKg }
  -> suppressed: true when no tier reaches 5
```

The viewer is included in their own group. No response contains another household's id.

### 3.4 Zone read

```
GET /api/zone?zone=elmina-north&period=2026-09
  -> read zone_snapshot (or compute from eligible rows)
  -> if household_count < 5: { suppressed: true, reason: "cohort_too_small" }
  -> else return stats, band, namespace, k
```

### 3.5 Shared-goal read

```
GET /api/zone/goal?zone=elmina-north&period=2026-09
  -> reference, current, target, progressPct
  -> suppressed when the zone is suppressed
```

### 3.6 Aggregation job

```
POST /api/jobs/rebuild-zones (cron secret)
  -> for each zone and period with eligible households
     -> compute count, median, p25, p75, p33, p67, shared goal, progress
     -> suppression checks at k = 5, rounding to 5
     -> insert a new zone_snapshot row (never update in place)
```

## 4. Data model

### 4.1 Core tables

```sql
create table township (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  region text not null default 'peninsular'
    check (region in ('peninsular','sabah','sarawak')),
  boundary_geojson jsonb,
  boundary_source text,
  is_boundary_official boolean not null default false
);

create table subzone (
  id uuid primary key default gen_random_uuid(),
  township_id uuid not null references township(id),
  slug text not null,
  name text not null,
  geojson jsonb not null,
  unique (township_id, slug)
);

create table household (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  display_name text,
  township_id uuid not null references township(id),
  subzone_id uuid references subzone(id),
  archetype text not null default 'mixed'
    check (archetype in ('ac_evening','ac_all_day','workday_absent','mixed')),
  is_demo boolean not null default false,
  invalid_data boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table household_profile (
  household_id uuid primary key references household(id) on delete cascade,
  home_type text not null check (home_type in ('terrace','apartment','semi_d','bungalow')),
  household_size int not null check (household_size between 1 and 20),
  aircon_count int not null check (aircon_count between 0 and 20),
  occupancy text not null check (occupancy in ('home_all_day','out_weekdays','evenings_only','varies')),
  cooling_hours text not null check (cooling_hours in ('none','night','evening','all_day')),
  water_heating text not null check (water_heating in ('none','instant','tank')),
  ev_charging boolean not null default false,
  appliances text[] not null default '{}',
  questionnaire_version text not null,
  completed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Derived grouping columns, kept in sync by the profile writer and by a
-- generated expression where the database version allows it.
-- home_type, size_band, aircon_band form the profile band.

create table factor_version (
  id uuid primary key default gen_random_uuid(),
  region text not null,
  year int not null,
  kg_per_kwh numeric(6,4) not null,
  status text not null check (status in ('provisional','final')),
  basis text not null,
  source_id text not null,
  source_url text not null,
  published_on date not null,
  supersedes_id uuid references factor_version(id),
  created_at timestamptz not null default now(),
  unique (region, year, status, kg_per_kwh)
);

create table model_version (
  id text primary key,
  description text not null,
  calibration_date date not null,
  coeffs jsonb not null,
  annual_mean numeric(6,5) not null,
  min_value numeric(6,4) not null,
  max_value numeric(6,4) not null,
  changelog text
);

create table intensity_profile (
  model_version_id text not null references model_version(id),
  month int not null check (month between 1 and 12),
  hour int not null check (hour between 0 and 23),
  day_class text not null check (day_class in ('weekday','saturday','sunday')),
  kg_per_kwh numeric(6,4) not null,
  primary key (model_version_id, month, hour, day_class)
);

create table usage_month (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  kwh numeric(10,3) not null check (kwh > 0 and kwh <= 3000),
  source text not null check (source in ('manual','csv','derived')),
  confirmed_at timestamptz not null default now(),
  is_demo boolean not null default false,
  check (period_end > period_start),
  unique (household_id, period_start)
);

create table usage_interval (
  id bigserial primary key,
  household_id uuid not null references household(id) on delete cascade,
  interval_start timestamptz not null,
  kwh numeric(8,4) not null check (kwh >= 0),
  import_id uuid not null,
  unique (household_id, interval_start)
);

create table estimate (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  usage_month_id uuid references usage_month(id) on delete cascade,
  factor_version_id uuid not null references factor_version(id),
  model_version_id text references model_version(id),
  method text not null check (method in ('flat','modelled','interval')),
  kwh numeric(10,3) not null,
  kg_co2e numeric(10,3) not null,
  delta_kg numeric(10,3),
  coverage_pct numeric(5,2),
  input_hash text not null,
  computed_at timestamptz not null default now(),
  unique (usage_month_id, method, factor_version_id, model_version_id)
);

create table household_action (
  household_id uuid not null references household(id) on delete cascade,
  action_id text not null,
  evidence_version text not null,
  state text not null check (state in ('suggested','done','snoozed','dismissed')),
  updated_at timestamptz not null default now(),
  primary key (household_id, action_id)
);

create table consent_event (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  scope text not null check (scope in ('aggregation','content')),
  action text not null check (action in ('granted','withdrawn')),
  policy_version text not null,
  created_at timestamptz not null default now()
);

create table zone_snapshot (
  id uuid primary key default gen_random_uuid(),
  township_id uuid not null references township(id),
  subzone_id uuid not null references subzone(id),
  period date not null,
  household_count int,
  median_kwh numeric(10,3),
  p25_kwh numeric(10,3),
  p75_kwh numeric(10,3),
  p33_kwh numeric(10,3),
  p67_kwh numeric(10,3),
  median_kg_co2e numeric(10,3),
  coverage_pct numeric(5,2),
  shared_goal_kwh numeric(10,3),
  shared_reference_kwh numeric(10,3),
  shared_current_kwh numeric(10,3),
  progress_pct numeric(5,2),
  factor_version_id uuid not null references factor_version(id),
  model_version_id text references model_version(id),
  namespace text not null default 'real' check (namespace in ('real','demo')),
  suppressed boolean not null default false,
  k_threshold int not null default 5 check (k_threshold >= 5),
  computed_at timestamptz not null default now()
);

create table comparison_snapshot (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  period date not null,
  tier text not null check (tier in ('T1','T2','T3')),
  group_n int not null,
  median_kwh numeric(10,3) not null,
  p33_kwh numeric(10,3) not null,
  p67_kwh numeric(10,3) not null,
  suppressed boolean not null default false,
  computed_at timestamptz not null default now()
);

create table content_article (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  summary text not null,
  body_markdown text not null,
  hero_image_url text,
  hero_alt text,
  tags text[] not null default '{}',
  related_action_ids text[] not null default '{}',
  stat_refs jsonb not null default '[]',
  status text not null check (status in ('draft','published','archived')),
  published_at timestamptz,
  last_reviewed_at date,
  author_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table source_snapshot (
  id bigserial primary key,
  source_id text not null,
  period text not null,
  payload jsonb not null,
  checksum text not null,
  fetched_at timestamptz not null default now(),
  source_updated_at timestamptz,
  status text not null check (status in ('live','cached','demo')),
  unique (source_id, period, checksum)
);
```

### 4.2 Indexes

- `usage_month (household_id, period_start desc)`
- `usage_interval (household_id, interval_start)`
- `consent_event (household_id, created_at desc)`
- `zone_snapshot (subzone_id, period desc, computed_at desc)` and `zone_snapshot (namespace, suppressed)`
- `comparison_snapshot (household_id, period desc)`
- `content_article (status, published_at desc)`

### 4.3 Row-level security

- `household`, `usage_month`, `usage_interval`, `estimate`, `household_action`, `household_profile`, `consent_event`: owner-only via `auth_user_id` or the server-side session.
- Anonymous households use a signed session cookie containing a household id; the server validates the signature and never trusts a client-supplied household id.
- **Contribution** requires an active `granted` consent event. The aggregate view joins the latest consent event per household and filters `action = 'granted'`.
- `zone_snapshot`: **public read for published rows** (`suppressed = false`), for any session, consented or not (D21). Suppressed rows are never exposed.
- No zone response contains a household id at any layer.
- `content_article`: public read only when `status = 'published'`.
- Admin write paths use the service role only inside route handlers, never exposed to the client. Admin is a server-side claim, not an env flag.

## 5. API surface

| Method | Route | Purpose | Auth |
|---|---|---|---|
| POST | `/api/usage` | Save monthly kWh | Session |
| POST | `/api/usage/import` | Parse and save intervals (Phase 7) | Session |
| POST | `/api/estimate` | Compute and persist estimates | Session |
| GET | `/api/estimate?period=` | Read stored estimates | Session |
| GET/POST | `/api/questionnaire` | Read and save the profile | Session |
| GET/POST | `/api/actions` | List and update action state | Session |
| POST | `/api/consent` | Grant or withdraw | Session |
| GET | `/api/comparison` | Similar-home group, tier, band | Session |
| GET | `/api/zone` | Zone aggregate or k-gate state | Public |
| GET | `/api/zone/goal` | Shared-goal progress or suppression | Public |
| POST | `/api/scenario` | Pure scenario calc | Public |
| GET | `/api/content` | Published list and article | Public |
| POST | `/api/admin/content` | Create, update, publish | Admin claim |
| POST | `/api/jobs/[job]` | Cron entry points | Cron secret |

All mutations return `{ ok, data }` or `{ ok: false, error: { code, message, fields? } }`.
Every zone read returns the k-gate state, so a client cannot render a number without one.

## 6. Security

- Session cookie: HttpOnly, Secure, SameSite=Lax, signed HMAC-SHA256, verified with `timingSafeEqual`, 180-day expiry.
- CSRF: same-site cookies plus an Origin/Referer check on every mutation. A request with neither is refused.
- Rate limits are per-process fixed windows: usage 20/h, CSV import 5/h, estimate 60/h, consent 30/h, questionnaire 30/h. **A multi-instance deployment must move these to Postgres or Redis**; the in-process limiter is a pilot limitation, not a production control.
- Upload limits (Phase 7): 5 MB, `.csv` or `.txt` only, MIME sniffing plus extension check, reject non-UTF-8, rate limit checked before the parse, max span 90 days, max 20,000 rows.
- Markdown sanitized with an allowlist; images restricted to the Supabase Storage domain.
- No secrets in the client bundle; only the Supabase anon key and map style URL are public.
- Service role key used only in server modules with `import "server-only"`.
- Admin authorization checked server-side on every request, not by hiding UI and not by `ADMIN_STUB`.
- Nonce-based CSP issued in `src/proxy.ts`, never a static policy in `next.config.ts`. A static CSP blocks the App Router's inline bootstrap scripts and breaks hydration silently.
- `connect-src` and `img-src` allow `tiles.openfreemap.org` only for tiles; the Leaflet/CARTO/Esri hosts are removed.
- Dependency and secret scanning in CI.

### 6.1 Ported security checklist

The rebuild discards none of the following. Each is re-tested after Phase 4.

| Severity | Issue | Control |
|---|---|---|
| Critical | Map library zero-click XSS | Pin a patched MapLibre version |
| High | No CSRF protection | Origin/Referer check on every POST handler |
| High | No rate limiting | Fixed-window limiter on all mutation paths |
| High | No security headers | CSP + nosniff, DENY, referrer, permissions, COOP, HSTS |
| High | Admin could read household usage | Admin claim never grants usage rows |
| Medium | CSV row errors swallowed | Per-row issues propagate to the resident |
| Medium | Overlapping billing periods | Interval-overlap check on save |
| Medium | Future billing periods | Reject `periodEnd > now` |
| Medium | Viewer excluded from own cohort | Viewer counts toward the group's n |
| Low | Unbounded in-memory store | Capped with eviction |
| Low | `keydown` listener leak on map remount | Cleanup registered inside the async callback |
| Low | Cron secret compared non-constant-time | `timingSafeEqual` |
| Low | Client could label typed input as `"csv"` | `source` removed from the API schema |

## 7. Environment variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SESSION_SECRET
CRON_SECRET
NEXT_PUBLIC_MAP_STYLE_URL
DEMO_MODE
NEXT_PUBLIC_APP_URL
```

## 8. Reliability

- Every page renders with cached or demo data if the database read succeeds but external sync is stale.
- If the database is unavailable, show a maintenance state with the last-known values only if safely cached; otherwise a clear error, not fabricated numbers.
- Jobs record start, end, status, row counts, and error in `job_run`.
- Alerts: sync failed twice consecutively, factor source unreachable, zone count drops unexpectedly, aggregation job overdue.

## 9. Build fresh in `src/`

1. Preserve the visual system from `dist/`: colours, typography, cards, iconography, sidebar, modal patterns, responsive breakpoints. It is reference, not a build target.
2. Build the routes in `src/` directly; do not migrate the prototype's `localStorage` state as a shipped feature.
3. Replace every hardcoded `FACTOR = 0.740` with a server-provided factor version.
4. Household state lives in the session plus Postgres, never in `localStorage`.
5. Scenario math is the shared `domain/community` function; zone statistics are separate code.
6. The decorative map dots and the Leaflet map are replaced by one MapLibre map.
7. Keep the demo badge, but drive it from the namespace and the data status.
8. `dist/` is never deployed. `.openai/hosting.json` is removed or repointed before any deploy.

## 10. Testing strategy

| Level | Coverage |
|---|---|
| Unit | Factor math, load shape, interval validation, scenario, suppression, rounding, goal rule, comparison tiers, shared goal, profile mapping |
| SQL | RLS owner isolation, demo exclusion, consent-gated aggregation, suppression view |
| Integration | Adapter normalization with recorded fixtures, cron idempotency |
| E2E | Questionnaire flow, six journeys, suppressed zone, demo toggle, offline demo, admin publish |
| Accessibility | axe on all routes, keyboard map fallback, chart table |
| Load | 500 concurrent estimate reads, 10k interval rows import |

Definition of done requires: unit coverage above 85% in `domain/`, SQL tests passing against
a live Postgres, E2E green on Chromium and mobile, and a manual offline run.

## 11. Deployment

- Vercel preview per pull request; Supabase branch database for migrations.
- Production: Vercel + Supabase, region closest to Malaysia (Singapore).
- Cron configured in `vercel.json` with the secret header.
- Migrations applied via CI, forward-only, with a rollback note per migration.
- Backups: daily database snapshots, 7-day retention for the pilot.
- The static `dist/` deployment in `.openai/hosting.json` is removed before the first deploy of the Next.js app.
