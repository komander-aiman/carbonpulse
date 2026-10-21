-- RLS and suppression tests. Run against a disposable database:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/sql/rls.test.sql
--
-- Every test raises on failure, so a non-zero exit means a real boundary break.
-- The whole file runs inside a transaction that is rolled back.

\set ON_ERROR_STOP on
begin;

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------

insert into township (id, slug, name, region)
values ('11111111-1111-4111-8111-111111111111', 'test-town', 'Test Township', 'peninsular');

insert into subzone (id, township_id, slug, name, geojson)
values
  ('22222222-2222-4222-8222-222222222221', '11111111-1111-4111-8111-111111111111', 'a', 'Zone A', '{"type":"Polygon","coordinates":[]}'::jsonb),
  ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'b', 'Zone B', '{"type":"Polygon","coordinates":[]}'::jsonb);

insert into household (id, display_name, township_id, subzone_id, is_demo)
select
  ('33333333-3333-4333-8333-0000000000' || lpad(i::text, 2, '0'))::uuid,
  'Household ' || i,
  '11111111-1111-4111-8111-111111111111',
  case when i % 2 = 0 then '22222222-2222-4222-8222-222222222221'::uuid
       else '22222222-2222-4222-8222-222222222222'::uuid end,
  false
from generate_series(1, 12) as i;

-- A demo household and one without consent, both of which must never count.
insert into household (id, display_name, township_id, subzone_id, is_demo)
values ('33333333-3333-4333-8333-000000000099', 'Demo', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222221', true);

insert into usage_month (household_id, period_start, period_end, kwh, source, is_demo)
select id, '2026-09-01', '2026-10-01', 300 + (row_number() over (order by display_name)), 'manual', false
from household where display_name like 'Household %';

insert into usage_month (household_id, period_start, period_end, kwh, source, is_demo)
values ('33333333-3333-4333-8333-000000000099', '2026-09-01', '2026-10-01', 900, 'manual', true);

insert into consent_event (household_id, scope, action, policy_version)
select id, 'aggregation', 'granted', 'test-1'
from household where display_name like 'Household %' and id <> '33333333-3333-4333-8333-000000000010';

do $$
declare
  n int;
begin
  -- 11 consented non-demo households remain (12 minus one withdrawn, demo excluded).
  select count(distinct household_id) into n from v_public_cohort_stats;
  if n <> 1 then
    raise exception 'expected one aggregate row, got %', n;
  end if;

  select household_count into n from v_public_cohort_stats;
  if n <> 11 then
    raise exception 'demo or unconsented household leaked into the cohort: count=%', n;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Suppression: 9 households must produce no publishable value anywhere
-- ---------------------------------------------------------------------------

do $$
declare
  rec record;
begin
  delete from consent_event
   where household_id in (
     select id from household where display_name in ('Household 1', 'Household 2')
   );

  select * into rec from v_cohort_stats_published;
  if rec.household_count is not null then
    raise exception 'count not suppressed at k-1: %', rec.household_count;
  end if;
  if rec.median_kwh is not null or rec.p25_kwh is not null or rec.p67_kwh is not null then
    raise exception 'statistic leaked at k-1';
  end if;
  if rec.suppressed is not true then
    raise exception 'suppressed flag not set at k-1';
  end if;

  -- Restore for the remaining tests.
  insert into consent_event (household_id, scope, action, policy_version)
  select id, 'aggregation', 'granted', 'test-1'
  from household where display_name in ('Household 1', 'Household 2');
end $$;

-- ---------------------------------------------------------------------------
-- Counts are coarsened above k
-- ---------------------------------------------------------------------------

do $$
declare
  n int;
begin
  select household_count into n from v_cohort_stats_published;
  if n is null then
    raise exception 'count missing above k';
  end if;
  if n % 5 <> 0 then
    raise exception 'count not coarsened to nearest 5: %', n;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Owner isolation
-- ---------------------------------------------------------------------------

set local role authenticated;

-- Without a household bound, nothing is readable.
do $$
declare
  n int;
begin
  select count(*) into n from usage_month;
  if n <> 0 then
    raise exception 'unscoped session could read % usage rows', n;
  end if;
end $$;

select set_config('carbonpulse.household_id', '33333333-3333-4333-8333-000000000001', true);

do $$
declare
  n int;
  other int;
begin
  select count(*) into n from usage_month;
  if n <> 1 then
    raise exception 'owner should read exactly 1 row, read %', n;
  end if;

  select count(*) into other from usage_month
   where household_id = '33333333-3333-4333-8333-000000000002';
  if other <> 0 then
    raise exception 'cross-household read succeeded';
  end if;
end $$;

-- Writing another household's row must fail.
do $$
begin
  begin
    insert into usage_month (household_id, period_start, period_end, kwh, source)
    values ('33333333-3333-4333-8333-000000000002', '2026-11-01', '2026-12-01', 100, 'manual');
    raise exception 'cross-household insert succeeded';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlerrm like '%cross-household insert succeeded%' then raise; end if;
  end;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Content visibility
-- ---------------------------------------------------------------------------

insert into content_article (slug, title, summary, body_markdown, status, published_at, last_reviewed_at)
values
  ('published-one', 'Published', 'Visible.', 'Body', 'published', now(), current_date),
  ('draft-one', 'Draft', 'Hidden.', 'Body', 'draft', null, null);

set local role authenticated;

do $$
declare
  n int;
begin
  select count(*) into n from content_article;
  if n <> 1 then
    raise exception 'anonymous session saw % articles, expected 1 published', n;
  end if;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Suppressed snapshots are invisible
-- ---------------------------------------------------------------------------

insert into cohort_snapshot
  (township_id, period, household_count, factor_version_id, suppressed, suppression_reason)
values
  ('11111111-1111-4111-8111-111111111111', '2026-09-01', 4,
   '00000000-0000-4000-8000-000000000001', true, 'cohort_too_small');

set local role authenticated;

do $$
declare
  n int;
begin
  select count(*) into n from cohort_snapshot where suppressed = true;
  if n <> 0 then
    raise exception 'suppressed snapshot readable by a normal session';
  end if;
end $$;

reset role;

-- A suppressed snapshot cannot carry a statistic at all.
do $$
begin
  begin
    insert into cohort_snapshot
      (township_id, period, household_count, median_kwh, factor_version_id, suppressed)
    values
      ('11111111-1111-4111-8111-111111111111', '2026-10-01', 4, 300,
       '00000000-0000-4000-8000-000000000001', true);
    raise exception 'suppressed snapshot with a median was accepted';
  exception
    when check_violation then null;
    when others then
      if sqlerrm like '%was accepted%' then raise; end if;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Constraint coverage
-- ---------------------------------------------------------------------------

do $$
begin
  begin
    insert into usage_month (household_id, period_start, period_end, kwh, source)
    values ('33333333-3333-4333-8333-000000000001', '2026-09-01', '2026-10-01', 100, 'manual');
    raise exception 'duplicate (household_id, period_start) accepted';
  exception
    when unique_violation then null;
    when others then
      if sqlerrm like '%accepted%' then raise; end if;
  end;

  begin
    insert into usage_month (household_id, period_start, period_end, kwh, source)
    values ('33333333-3333-4333-8333-000000000001', '2026-12-01', '2027-01-01', 3001, 'manual');
    raise exception 'kWh above 3000 accepted';
  exception
    when check_violation then null;
    when others then
      if sqlerrm like '%accepted%' then raise; end if;
  end;

  begin
    insert into content_article (slug, title, summary, body_markdown, status)
    values ('no-hero-alt', 'T', 'S', 'B', 'published');
    raise exception 'published article without review date accepted';
  exception
    when check_violation then null;
    when others then
      if sqlerrm like '%accepted%' then raise; end if;
  end;
end $$;

select 'all rls and suppression tests passed' as result;

rollback;
