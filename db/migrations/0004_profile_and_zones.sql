-- CarbonPulse revision 4: household profile, zone snapshots, comparison cache.
-- Forward-only. Rollback note: dropping this migration removes questionnaire
-- answers and zone snapshots; export `household_profile` and `zone_snapshot`
-- first in production.

-- ---------------------------------------------------------------------------
-- Household profile (PRD 07 §2)
-- ---------------------------------------------------------------------------
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

-- Derived profile-band columns. Stored so a group key is indexable and stable,
-- and so a rule change can be re-derived without parsing free text.
alter table household_profile
  add column size_band text generated always as (
    case when household_size <= 2 then '1-2'
         when household_size <= 4 then '3-4'
         else '5+' end
  ) stored,
  add column aircon_band text generated always as (
    case when aircon_count <= 0 then '0'
         when aircon_count <= 2 then '1-2'
         else '3+' end
  ) stored;

create index household_profile_band_idx
  on household_profile (home_type, size_band, aircon_band);

-- ---------------------------------------------------------------------------
-- Zone snapshots replace cohort_snapshot (D8, D15, D17, D24)
-- ---------------------------------------------------------------------------
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
  progress_pct numeric(5,2) check (progress_pct is null or (progress_pct >= 0 and progress_pct <= 100)),
  factor_version_id uuid not null references factor_version(id),
  model_version_id text references model_version(id),
  namespace text not null default 'real' check (namespace in ('real','demo')),
  suppressed boolean not null default false,
  k_threshold int not null default 5 check (k_threshold >= 5),
  computed_at timestamptz not null default now()
);

create index zone_snapshot_zone_period_idx
  on zone_snapshot (subzone_id, period desc, computed_at desc);
create index zone_snapshot_namespace_idx
  on zone_snapshot (namespace, suppressed);

-- A suppressed snapshot carries no numeric field. Enforced in the database so a
-- bug in the application cannot publish a count below k.
alter table zone_snapshot
  add constraint zone_snapshot_suppressed_payload check (
    suppressed = false or (
      household_count is null and median_kwh is null and p25_kwh is null and p75_kwh is null
      and p33_kwh is null and p67_kwh is null and median_kg_co2e is null
      and shared_goal_kwh is null and shared_reference_kwh is null and shared_current_kwh is null
      and progress_pct is null
    )
  );

-- Published rows only: the view a public read is allowed to use.
create view v_public_zone_stats as
  select id, township_id, subzone_id, period, household_count, median_kwh, p25_kwh, p75_kwh,
         p33_kwh, p67_kwh, median_kg_co2e, coverage_pct, shared_goal_kwh, shared_reference_kwh,
         shared_current_kwh, progress_pct, factor_version_id, model_version_id, k_threshold,
         computed_at
  from zone_snapshot
  where suppressed = false and namespace = 'real';

-- ---------------------------------------------------------------------------
-- Comparison cache (PRD 07 §5-6)
-- ---------------------------------------------------------------------------
create table comparison_snapshot (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  period date not null,
  tier text not null check (tier in ('T1','T2','T3')),
  group_n int not null check (group_n >= 5),
  median_kwh numeric(10,3) not null,
  p33_kwh numeric(10,3) not null,
  p67_kwh numeric(10,3) not null,
  suppressed boolean not null default false,
  computed_at timestamptz not null default now()
);

create index comparison_snapshot_household_idx
  on comparison_snapshot (household_id, period desc);

-- ---------------------------------------------------------------------------
-- Consent-gated contribution view
-- ---------------------------------------------------------------------------
-- Contribution requires the latest aggregation consent event to be `granted`.
-- Viewing does not: `v_public_zone_stats` is readable by any session (PRD 04 §2).
create view v_cohort_eligible as
  select h.id as household_id,
         h.subzone_id,
         h.township_id,
         u.period_start,
         u.kwh,
         p.home_type,
         p.household_size,
         p.aircon_count,
         p.size_band,
         p.aircon_band
  from household h
  join usage_month u on u.household_id = h.id and u.is_demo = false
  left join household_profile p on p.household_id = h.id
  where h.is_demo = false
    and h.invalid_data = false
    and h.deleted_at is null
    and (
      select c.action
      from consent_event c
      where c.household_id = h.id and c.scope = 'aggregation'
      order by c.created_at desc
      limit 1
    ) = 'granted';

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant select on v_public_zone_stats to anon, authenticated;
grant select on zone_snapshot to service_role;
grant select, insert, update on household_profile to service_role;
grant select, insert on comparison_snapshot to service_role;

revoke all on v_cohort_eligible from anon, authenticated;
grant select on v_cohort_eligible to service_role;
