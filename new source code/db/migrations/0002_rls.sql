-- Row-level security and the public suppression view, revision 2.
--
-- Two rules matter more than the rest:
--   1. Household rows are readable only by their owner (auth user, or the
--      household bound to the signed session cookie).
--   2. Demo exclusion and consent filtering happen inside the view, so no
--      application query path can bypass them.

-- The signed session cookie resolves to a household id. The route handler
-- verifies the HMAC and sets this setting per transaction. A client-supplied
-- value never reaches it.
create or replace function current_household_id() returns uuid
language sql stable as $$
  select nullif(current_setting('carbonpulse.household_id', true), '')::uuid;
$$;

create or replace function is_admin() returns boolean
language sql stable as $$
  select coalesce(
    (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'admin'
    or current_setting('carbonpulse.admin', true) = 'true',
    false
  );
$$;

alter table township enable row level security;
alter table subzone enable row level security;
alter table household enable row level security;
alter table usage_month enable row level security;
alter table usage_interval enable row level security;
alter table usage_import enable row level security;
alter table estimate enable row level security;
alter table household_action enable row level security;
alter table consent_event enable row level security;
alter table cohort_snapshot enable row level security;
alter table content_article enable row level security;
alter table factor_version enable row level security;
alter table model_version enable row level security;
alter table intensity_profile enable row level security;
alter table action_evidence enable row level security;
alter table source_snapshot enable row level security;
alter table job_run enable row level security;

-- Reference and public data: readable by anyone, writable by nobody through
-- the anon or authenticated role.
create policy township_read on township for select using (true);
create policy subzone_read on subzone for select using (true);
create policy factor_read on factor_version for select using (true);
create policy model_read on model_version for select using (true);
create policy intensity_read on intensity_profile for select using (true);
create policy action_evidence_read on action_evidence for select using (true);

-- Owner-only household data. The insert path is a route handler using the
-- session household id; reads and writes are both scoped to it.
-- PRD 04 §6: an admin may read content and cohort health, never household
-- usage rows. The admin claim is therefore absent from the usage policies; it
-- appears only on the tables an admin legitimately needs (content, snapshots,
-- job runs). `is_admin()` must not be used as a blanket bypass.
create policy household_owner_select on household
  for select using (id = current_household_id() or auth_user_id = auth.uid());
create policy household_owner_update on household
  for update using (id = current_household_id() or auth_user_id = auth.uid())
  with check (id = current_household_id() or auth_user_id = auth.uid());

create policy usage_month_owner_all on usage_month
  for all using (household_id = current_household_id())
  with check (household_id = current_household_id());

create policy usage_interval_owner_all on usage_interval
  for all using (household_id = current_household_id())
  with check (household_id = current_household_id());

create policy usage_import_owner_all on usage_import
  for all using (household_id = current_household_id())
  with check (household_id = current_household_id());

create policy estimate_owner_all on estimate
  for all using (household_id = current_household_id())
  with check (household_id = current_household_id());

create policy household_action_owner_all on household_action
  for all using (household_id = current_household_id())
  with check (household_id = current_household_id());

create policy consent_owner_all on consent_event
  for all using (household_id = current_household_id())
  with check (household_id = current_household_id());

-- Snapshots are readable only when published. A suppressed row is invisible
-- to every non-admin session, which also removes it from the map.
create policy cohort_snapshot_read on cohort_snapshot
  for select using (suppressed = false or is_admin());

create policy content_public_read on content_article
  for select using (status = 'published' or is_admin());

create policy source_snapshot_read on source_snapshot
  for select using (true);

create policy job_run_admin_read on job_run
  for select using (is_admin());

-- ---------------------------------------------------------------------------
-- Public cohort view.
-- ---------------------------------------------------------------------------

create or replace view v_public_cohort_stats as
with active_consent as (
  select distinct on (household_id) household_id, action, policy_version, created_at
  from consent_event
  where scope = 'aggregation'
  order by household_id, created_at desc
),
eligible as (
  select
    h.id as household_id,
    h.township_id,
    h.subzone_id,
    um.period_start,
    um.kwh
  from household h
  join usage_month um on um.household_id = h.id
  join active_consent c on c.household_id = h.id
  where c.action = 'granted'
    and h.is_demo = false
    and h.deleted_at is null
    and h.invalid_data = false
    and um.is_demo = false
)
select
  township_id,
  subzone_id,
  period_start,
  count(*)::int as household_count,
  percentile_cont(0.5) within group (order by kwh) as median_kwh,
  percentile_cont(0.25) within group (order by kwh) as p25_kwh,
  percentile_cont(0.75) within group (order by kwh) as p75_kwh,
  percentile_cont(1.0 / 3) within group (order by kwh) as p33_kwh,
  percentile_cont(2.0 / 3) within group (order by kwh) as p67_kwh
from eligible
group by township_id, subzone_id, period_start;

-- The application-facing view: everything below k is served as a suppressed
-- row with null statistics, and counts are coarsened above k so they cannot be
-- differenced against a known neighbourhood.
create or replace view v_cohort_stats_published as
select
  township_id,
  subzone_id,
  period_start,
  case when household_count >= 10 then greatest(10, round(household_count / 5.0) * 5) end
    ::int as household_count,
  case when household_count >= 10 then round(median_kwh) end as median_kwh,
  case when household_count >= 10 then round(p25_kwh / 5) * 5 end as p25_kwh,
  case when household_count >= 10 then round(p75_kwh / 5) * 5 end as p75_kwh,
  case when household_count >= 10 then round(p33_kwh / 5) * 5 end as p33_kwh,
  case when household_count >= 10 then round(p67_kwh / 5) * 5 end as p67_kwh,
  (household_count < 10) as suppressed,
  case when household_count < 10 then 'cohort_too_small' else null end as suppression_reason
from v_public_cohort_stats;

comment on view v_public_cohort_stats is
  'Eligible consented non-demo records only. Never expose directly to clients.';
comment on view v_cohort_stats_published is
  'Suppression-safe cohort statistics. Counts below k are null; above k rounded to 5.';
