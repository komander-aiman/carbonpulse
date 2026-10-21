-- CarbonPulse schema, revision 1.
-- Forward-only. Rollback note: dropping this migration removes all household
-- data; export `household` and `usage_month` first in production.

create extension if not exists "pgcrypto";

create table township (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  region text not null default 'peninsular'
    check (region in ('peninsular', 'sabah', 'sarawak')),
  boundary_geojson jsonb,
  boundary_source text,
  is_boundary_official boolean not null default false,
  created_at timestamptz not null default now()
);

create table subzone (
  id uuid primary key default gen_random_uuid(),
  township_id uuid not null references township(id) on delete cascade,
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
    check (archetype in ('ac_evening', 'ac_all_day', 'workday_absent', 'mixed')),
  claim_token text,
  claimed_at timestamptz,
  is_demo boolean not null default false,
  invalid_data boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index household_township_idx on household (township_id) where deleted_at is null;

create table factor_version (
  id uuid primary key default gen_random_uuid(),
  region text not null check (region in ('peninsular', 'sabah', 'sarawak')),
  year int not null check (year between 2000 and 2100),
  kg_per_kwh numeric(6, 4) not null check (kg_per_kwh > 0 and kg_per_kwh < 2),
  status text not null check (status in ('provisional', 'final')),
  basis text not null,
  source_id text not null,
  source_url text not null,
  published_on date not null,
  supersedes_id uuid references factor_version(id),
  created_at timestamptz not null default now(),
  unique (region, year, status, kg_per_kwh)
);

-- One active version per region and year. The application reads this view;
-- it never guesses which row is current.
create view v_active_factor as
  select distinct on (region)
    id, region, year, kg_per_kwh, status, basis, source_id, source_url, published_on
  from factor_version
  order by region, year desc, created_at desc;

create table model_version (
  id text primary key,
  description text not null,
  calibration_date date not null,
  coeffs jsonb not null,
  annual_mean numeric(6, 5) not null,
  min_value numeric(6, 4) not null,
  max_value numeric(6, 4) not null,
  changelog text,
  created_at timestamptz not null default now()
);

create table intensity_profile (
  model_version_id text not null references model_version(id) on delete cascade,
  month int not null check (month between 1 and 12),
  hour int not null check (hour between 0 and 23),
  day_class text not null check (day_class in ('weekday', 'saturday', 'sunday')),
  kg_per_kwh numeric(6, 4) not null check (kg_per_kwh between 0 and 2),
  primary key (model_version_id, month, hour, day_class)
);

create table usage_month (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  kwh numeric(10, 3) not null check (kwh > 0 and kwh <= 3000),
  source text not null check (source in ('manual', 'csv', 'derived')),
  confirmed_at timestamptz not null default now(),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  check (period_end > period_start),
  unique (household_id, period_start)
);

create index usage_month_household_period_idx on usage_month (household_id, period_start desc);

create table usage_interval (
  id bigserial primary key,
  household_id uuid not null references household(id) on delete cascade,
  interval_start timestamptz not null,
  kwh numeric(8, 4) not null check (kwh >= 0 and kwh <= 50),
  import_id uuid not null,
  created_at timestamptz not null default now(),
  unique (household_id, interval_start)
);

create index usage_interval_household_start_idx on usage_interval (household_id, interval_start);

create table usage_import (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  file_name text not null,
  row_count int not null check (row_count >= 0),
  coverage_pct numeric(5, 2) not null check (coverage_pct between 0 and 100),
  period_start date not null,
  period_end date not null,
  imported_at timestamptz not null default now()
);

create table estimate (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  usage_month_id uuid references usage_month(id) on delete cascade,
  factor_version_id uuid not null references factor_version(id),
  model_version_id text references model_version(id),
  method text not null check (method in ('flat', 'modelled', 'interval')),
  kwh numeric(10, 3) not null check (kwh >= 0),
  kg_co2e numeric(10, 3) not null,
  delta_kg numeric(10, 3),
  coverage_pct numeric(5, 2),
  input_hash text not null,
  computed_at timestamptz not null default now(),
  unique (usage_month_id, method, factor_version_id, model_version_id)
);

create index estimate_household_idx on estimate (household_id, computed_at desc);

-- Reference data for actions. Ranges are versioned rows, never free text.
create table action_evidence (
  action_id text not null,
  evidence_version text not null,
  title text not null,
  category text not null
    check (category in ('cooling', 'standby', 'lighting', 'hot_water', 'appliance_scheduling')),
  kwh_low numeric(6, 2) not null check (kwh_low >= 0),
  kwh_high numeric(6, 2) not null check (kwh_high >= kwh_low),
  effort int not null check (effort between 1 and 3),
  applies_to text[] not null,
  confidence text not null check (confidence in ('low', 'medium', 'high')),
  source text not null,
  created_at timestamptz not null default now(),
  primary key (action_id, evidence_version)
);

create table household_action (
  household_id uuid not null references household(id) on delete cascade,
  action_id text not null,
  evidence_version text not null,
  state text not null check (state in ('suggested', 'done', 'snoozed', 'dismissed')),
  updated_at timestamptz not null default now(),
  primary key (household_id, action_id)
);

create table consent_event (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  scope text not null check (scope in ('aggregation', 'content')),
  action text not null check (action in ('granted', 'withdrawn')),
  policy_version text not null,
  created_at timestamptz not null default now()
);

create index consent_event_household_idx on consent_event (household_id, created_at desc);

create table cohort_snapshot (
  id uuid primary key default gen_random_uuid(),
  township_id uuid not null references township(id),
  subzone_id uuid references subzone(id),
  period date not null,
  household_count int not null check (household_count >= 0),
  median_kwh numeric(10, 3),
  p25_kwh numeric(10, 3),
  p75_kwh numeric(10, 3),
  p33_kwh numeric(10, 3),
  p67_kwh numeric(10, 3),
  coverage_pct numeric(5, 2),
  median_kg_co2e numeric(10, 3),
  actions_completed int,
  factor_version_id uuid not null references factor_version(id),
  model_version_id text references model_version(id),
  suppressed boolean not null default false,
  suppression_reason text,
  k_threshold int not null default 10,
  computed_at timestamptz not null default now(),
  -- A suppressed snapshot must not carry any publishable value.
  check (
    suppressed = false
    or (median_kwh is null and p25_kwh is null and p75_kwh is null
        and median_kg_co2e is null and household_count < k_threshold)
  )
);

create index cohort_snapshot_lookup_idx
  on cohort_snapshot (township_id, period desc, computed_at desc);

create table content_article (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null check (char_length(title) <= 90),
  summary text not null check (char_length(summary) <= 240),
  body_markdown text not null,
  hero_image_url text,
  hero_alt text,
  tags text[] not null default '{}',
  related_action_ids text[] not null default '{}',
  stat_refs jsonb not null default '[]',
  status text not null check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  last_reviewed_at date,
  author_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (hero_image_url is null or hero_alt is not null),
  check (status <> 'published' or (published_at is not null and last_reviewed_at is not null))
);

create index content_article_status_idx on content_article (status, published_at desc);

create table source_snapshot (
  id bigserial primary key,
  source_id text not null,
  period text not null,
  payload jsonb not null,
  checksum text not null,
  fetched_at timestamptz not null default now(),
  source_updated_at timestamptz,
  status text not null check (status in ('live', 'cached', 'demo')),
  unique (source_id, period, checksum)
);

create table job_run (
  id bigserial primary key,
  job text not null,
  status text not null check (status in ('running', 'ok', 'failed', 'skipped')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  row_count int,
  checksum text,
  error_code text,
  -- Deliberately no free-text error message: it can carry user-derived values.
  detail jsonb
);

create index job_run_job_idx on job_run (job, started_at desc);
