-- Make exercise, sugar and weight independently optional.
--
-- The app has always modelled all three as nullable (`exercised` boolean|null,
-- `ate_sweets` boolean|null, `weight` string|null) — a day can be logged with
-- any one of them. But `entries` was created in the dashboard with NOT NULL on
-- at least one column, so clearing a value on an already-saved day failed with:
--
--   null value in column "exercised" violates not-null constraint   (SQLSTATE 23502)
--
-- That error used to be swallowed by the client, which is why it read as "save
-- does nothing" rather than as a failure.
--
-- Run in Supabase → SQL Editor. Safe to re-run: dropping NOT NULL from a column
-- that is already nullable is a no-op in Postgres.

alter table public.entries alter column exercised  drop not null;
alter table public.entries alter column ate_sweets drop not null;
alter table public.entries alter column weight     drop not null;
