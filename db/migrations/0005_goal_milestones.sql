-- CarbonPulse revision 5: recorded goal milestones for the carbon journey.
-- Forward-only. Rollback note: dropping this migration removes recorded goal
-- milestones only. Billing periods and their stored estimates are untouched.

-- A milestone is written at the moment a newly confirmed usage period meets
-- the goal computed from the periods before it. It is a historical record, not
-- a recomputed view: later goal-rule changes must not rewrite it, which is why
-- the goal value, rule and label are copied onto the row.
create table goal_milestone (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  period_id uuid not null references usage_month(id) on delete cascade,
  goal_kwh numeric(10, 3) not null check (goal_kwh > 0),
  rule text not null check (rule in ('provisional', 'confirmed')),
  label text not null check (label in ('Provisional', 'Confirmed')),
  achieved_kwh numeric(10, 3) not null check (achieved_kwh > 0),
  occurred_at timestamptz not null default now(),
  is_demo boolean not null default false,
  -- One milestone per achieved period; re-reading or retrying cannot duplicate it.
  unique (household_id, period_id)
);

create index goal_milestone_household_time_idx
  on goal_milestone (household_id, occurred_at);

alter table goal_milestone enable row level security;

-- Owner-only, scoped to the verified signed-session household id. There is no
-- admin bypass: milestones describe a household's own history.
create policy goal_milestone_owner_all on goal_milestone
  for all using (household_id = current_household_id())
  with check (household_id = current_household_id());

grant select, insert, update, delete on goal_milestone to service_role;

-- Explicit Data API exposure (migration 0003 already grants all tables to
-- service_role and keeps anon/authenticated without access).
comment on table goal_milestone is
  'Recorded goal milestones. Written only when a new confirmed bill meets the goal computed before it.';
