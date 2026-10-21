# Database

Forward-only migrations. Each file states its rollback note at the top.

| File | Contents |
|---|---|
| `migrations/0001_init.sql` | Tables, constraints, indexes, `v_active_factor` |
| `migrations/0002_rls.sql` | RLS policies, `current_household_id()`, `v_public_cohort_stats`, `v_cohort_stats_published` |
| `migrations/0003_server_role.sql` | Explicit server-only Data API grants when automatic table exposure is disabled |
| `seeds/reference.sql` | Township, 6 subzones, 5 factor versions, model version, 8 action evidence rows |

## Applying

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/0001_init.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/0002_rls.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/0003_server_role.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/seeds/reference.sql
```

## Session binding

`current_household_id()` reads `carbonpulse.household_id`, a transaction-local
setting. Only a route handler that has verified the signed cookie may set it:

```sql
select set_config('carbonpulse.household_id', $1, true);
```

It is never populated from a request body or query string. A client-supplied
household id therefore has no effect.

## Suppression

Two views, deliberately layered:

- `v_public_cohort_stats` — raw aggregates over eligible rows. Filters
  `is_demo = false`, active consent, non-deleted, non-invalid, and
  `usage_month.is_demo = false`. Never exposed to a client.
- `v_cohort_stats_published` — the only cohort view an app query may read. Below
  k = 10 it returns null statistics and `suppressed = true`; above k it rounds
  counts to the nearest 5 and quartiles to the nearest 5 kWh.

`cohort_snapshot` additionally has a CHECK constraint so a row marked
`suppressed = true` cannot carry a median or an IQR. A suppressed snapshot is
also invisible under RLS to non-admin sessions, which removes it from the map in
the same step.

## Testing

```bash
createdb carbonpulse_test
psql "postgres://localhost/carbonpulse_test" -v ON_ERROR_STOP=1 -f db/migrations/0001_init.sql
psql "postgres://localhost/carbonpulse_test" -v ON_ERROR_STOP=1 -f db/migrations/0002_rls.sql
psql "postgres://localhost/carbonpulse_test" -v ON_ERROR_STOP=1 -f db/seeds/reference.sql
psql "postgres://localhost/carbonpulse_test" -v ON_ERROR_STOP=1 -f tests/sql/rls.test.sql
```

`rls.test.sql` covers: demo exclusion, consent withdrawal, k-1 suppression of
counts and quartiles, count coarsening above k, unscoped-session isolation,
cross-household read and write attempts, draft invisibility, suppressed-snapshot
invisibility, the suppressed-row CHECK constraint, and the meaningful table
constraints. It runs in a transaction and rolls back.

Note: Supabase provisions `auth.users`; running against a plain Postgres
instance requires creating a stub `auth` schema with a `users` table first.

## Migration to this schema

The app currently uses an in-memory store (`src/lib/household-store.ts`) with the
same shapes. Swapping in Postgres means replacing that module's functions with
queries and calling `set_config` per transaction. Nothing in `src/domain/`
changes, and no page needs to know which store is behind it.
