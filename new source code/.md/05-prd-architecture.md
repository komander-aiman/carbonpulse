# PRD 05 — Technical Architecture

Parent: `1792434273536-00-carbonpulse-index.md`

## 1. Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript, strict mode | Server Components for reads, Route Handlers for mutations |
| Styling | Existing CSS tokens migrated to design tokens; CSS Modules or Tailwind | Reuse the current visual language; no component library mandate |
| Charts | Recharts or lightweight SVG components | Must expose accessible data tables |
| Map | MapLibre GL JS + OpenFreeMap | Client component, lazy loaded |
| Validation | Zod at every boundary | Shared schemas between client and server |
| Database | Supabase Postgres | RLS on all household data |
| Auth | Supabase Auth magic link, anonymous sessions | Optional upgrade path |
| Storage | Supabase Storage for content images only | No bill files |
| Jobs | Vercel Cron hitting protected route handlers | Idempotent, snapshot-based |
| Observability | Structured JSON logs, job run table, error alerting | No PII |
| Tests | Vitest for units, Playwright for journeys, SQL tests for RLS and aggregates | |

Do not introduce a separate Express server, a second database, a headless CMS, or keyed carbon APIs.

## 2. Repository layout

```
src/
  app/
    (marketing)/page.tsx
    energy/page.tsx
    energy/upload/page.tsx
    actions/page.tsx
    community/page.tsx
    learn/page.tsx
    township/[slug]/page.tsx
    admin/(protected)/page.tsx
    api/
      households/route.ts
      usage/route.ts
      usage/import/route.ts
      estimate/route.ts
      actions/route.ts
      consent/route.ts
      community/route.ts
      scenario/route.ts
      content/route.ts
      admin/content/route.ts
      jobs/[job]/route.ts
  domain/
    carbon/            # factor registry, flat, modelled, interval, rounding
    actions/           # ranking, evidence table access
    community/         # aggregation, suppression, scenario
    content/           # schema and sanitization
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
  lib/                 # auth, logging, fetch, env, result types
tests/
  unit/
  e2e/
  sql/
```

`domain/carbon` must be framework-free TypeScript with no database imports so it can be unit tested and reused by jobs.

## 3. Request flow

### 3.1 Estimate

```
POST /api/estimate
  -> Zod validate { householdId, period, kwh, archetype?, survey? }
  -> load active factor version and model version
  -> domain/carbon: flat, modelled, optional interval
  -> persist estimate row with versions and input hash
  -> return { flat, modelled, delta, labels, versions, sources }
```

- Server computes; the client never calculates emissions for display.
- The client may preview locally only to show an instant skeleton, and must replace it with the server value.
- `input_hash` prevents duplicate rows for identical inputs.

### 3.2 Interval import

```
POST /api/usage/import (multipart, max 5 MB)
  -> auth or anonymous session
  -> parse CSV in memory, validate rows
  -> if errors: return row-level report, persist nothing
  -> if valid: insert usage_interval rows in one transaction
  -> derive monthly summary if covered
  -> delete buffer, return summary and coverage
```

Files are never written to durable storage. Parsing happens in the route handler with a memory cap; larger files are rejected.

### 3.3 Community read

```
GET /api/community?township=elmina&period=2026-09
  -> read cohort_snapshot
  -> if household_count < 10: { suppressed: true }
  -> else return stats plus household coarse band
```

Reads use a database view `v_public_cohort_stats` that filters `is_demo = false`, active consent, and valid records.

### 3.4 Aggregation job

```
POST /api/jobs/rebuild-aggregates (cron secret)
  -> for each township and period with eligible households
     -> compute count, median, p25, p75, coverage
     -> suppression checks, secondary suppression
     -> insert new cohort_snapshot row (never update in place)
```

## 4. Data model

### 4.1 Core tables

```sql
create table household (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  display_name text,
  township_id uuid not null references township(id),
  subzone_id uuid references subzone(id),
  archetype text not null default 'mixed',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table township (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  region text not null default 'peninsular',
  boundary_geojson jsonb,
  boundary_source text,
  is_boundary_official boolean not null default false
);

create table subzone (
  id uuid primary key default gen_random_uuid(),
  township_id uuid not null references township(id),
  name text not null,
  geojson jsonb not null
);

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

create table cohort_snapshot (
  id uuid primary key default gen_random_uuid(),
  township_id uuid not null references township(id),
  subzone_id uuid references subzone(id),
  period date not null,
  household_count int not null,
  median_kwh numeric(10,3),
  p25_kwh numeric(10,3),
  p75_kwh numeric(10,3),
  coverage_pct numeric(5,2),
  factor_version_id uuid not null references factor_version(id),
  model_version_id text references model_version(id),
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
- `cohort_snapshot (township_id, period desc, computed_at desc)`
- `consent_event (household_id, created_at desc)`
- `content_article (status, published_at desc)`

### 4.3 Row-level security

- `household`, `usage_month`, `usage_interval`, `estimate`, `household_action`, `consent_event`: owner-only via `auth_user_id`.
- Anonymous households use a signed session cookie containing a household id; the server validates the signature and never trusts a client-supplied household id.
- `cohort_snapshot`: readable by any authenticated or anonymous session in the same township, but only rows where `suppressed = false`.
- `content_article`: public read only when `status = 'published'`.
- Admin write paths use the service role only inside route handlers, never exposed to the client.

## 5. API surface

| Method | Route | Purpose | Auth |
|---|---|---|---|
| POST | `/api/households` | Create anonymous household | Session cookie |
| POST | `/api/claim` | Attach anonymous household to auth user | Magic link |
| POST | `/api/usage` | Save monthly kWh | Session |
| POST | `/api/usage/import` | Parse and save intervals | Session |
| POST | `/api/estimate` | Compute and persist estimates | Session |
| GET | `/api/estimate?period=` | Read stored estimates | Session |
| GET/POST | `/api/actions` | List and update action state | Session |
| POST | `/api/consent` | Grant or withdraw | Session |
| GET | `/api/community` | Cohort stats and household band | Session |
| POST | `/api/scenario` | Pure scenario calc | Session |
| GET | `/api/content` | Published list and article | Public |
| POST | `/api/admin/content` | Create, update, publish | Admin |
| POST | `/api/jobs/[job]` | Cron entry points | Cron secret |

All mutations return `{ ok, data }` or `{ ok: false, error: { code, message, fields? } }`.

## 6. Security

- Session cookie: HttpOnly, Secure, SameSite=Lax, signed, 180-day expiry.
- CSRF: same-site cookies plus origin check on mutations.
- Rate limits per IP and session: 20 estimates/hour, 5 imports/hour, 10 auth emails/hour.
- Upload limits: 5 MB, `.csv` or `.txt` only, MIME sniffing plus extension check, reject non-UTF-8.
- Markdown sanitized with an allowlist; images restricted to the Supabase Storage domain.
- No secrets in the client bundle; only Supabase anon key and map style URL are public.
- Service role key used only in server modules with `import 'server-only'`.
- Admin authorization checked server-side on every request, not by hiding UI.
- Dependency and secret scanning in CI.

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
- Alerts: sync failed twice consecutively, factor source unreachable, cohort count drops unexpectedly, aggregation job overdue.

## 9. Migration from the current prototype

1. Preserve the visual system: colours, typography, cards, iconography, sidebar, modal patterns, responsive breakpoints.
2. Port the five views to routes with identical content slots.
3. Replace hardcoded `FACTOR = 0.740` with a server-provided factor version.
4. Replace `localStorage` state with household session plus Postgres, keeping a one-time import of existing localStorage values for demo continuity.
5. Replace the static scenario math with the shared `domain/community` scenario function.
6. Replace the decorative map dots with MapLibre.
7. Keep the demo badge, but drive it from data status.
8. Delete or archive `dist/` only after parity is verified.

## 10. Testing strategy

| Level | Coverage |
|---|---|
| Unit | Factor math, load shape, interval validation, scenario, suppression, rounding |
| SQL | RLS owner isolation, demo exclusion, suppression view |
| Integration | Adapter normalization with recorded fixtures, cron idempotency |
| E2E | Five journeys, suppressed cohort, offline demo, admin publish |
| Accessibility | axe on all routes, keyboard map fallback, chart table |
| Load | 500 concurrent estimate reads, 10k interval rows import |

Definition of done requires: unit coverage above 85% in `domain/`, all SQL tests passing, E2E green on Chromium and WebKit, and a manual offline run.

## 11. Deployment

- Vercel preview per pull request; Supabase branch database for migrations.
- Production: Vercel + Supabase, region closest to Malaysia (Singapore).
- Cron configured in `vercel.json` with the secret header.
- Migrations applied via CI, forward-only, with a rollback note per migration.
- Backups: daily database snapshots, 7-day retention for the pilot.
