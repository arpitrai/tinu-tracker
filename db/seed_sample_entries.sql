-- Sample data for the Tinu Tracker reviewer / screenshot account.
-- 60 days: 2026-07-13 -> 2026-09-10 (ends today, 2026-09-10).
-- Every day has all three values set: exercised, ate_sweets and weight.
--
-- Weight trends 78.6 -> 75.3 kg with realistic daily noise.
-- Exercise on 41/60 days (68%), sweets on 22/60 days (37%).
--
-- Run in Supabase -> SQL Editor. Safe to re-run: the ON CONFLICT clause makes it
-- idempotent, overwriting these same 60 days rather than erroring or duplicating.
-- The user is resolved by email, so no UUID needs pasting in.

-- Optional: clear the stale Jun-2026 sample data (2026-05-29 -> 2026-06-27) that
-- now falls outside every default Trends window. Uncomment to remove it.
--
-- delete from public.entries
-- where user_id = (select id from auth.users where email = 'arpit_rai2014@pgp.isb.edu')
--   and date between '2026-05-29' and '2026-06-27';

insert into public.entries (user_id, date, exercised, ate_sweets, weight)
select u.id, v.date::date, v.exercised, v.ate_sweets, v.weight
from auth.users u
cross join (values
  ('2026-07-13', true, false, '78.5'),
  ('2026-07-14', true, false, '78.5'),
  ('2026-07-15', true, false, '78.4'),
  ('2026-07-16', true, false, '78.6'),
  ('2026-07-17', false, true, '78.6'),
  ('2026-07-18', true, true, '78.1'),
  ('2026-07-19', false, false, '78.5'),
  ('2026-07-20', true, false, '78.1'),
  ('2026-07-21', true, true, '78.0'),
  ('2026-07-22', true, false, '78.3'),
  ('2026-07-23', true, false, '78.1'),
  ('2026-07-24', true, true, '78.1'),
  ('2026-07-25', true, false, '78.0'),
  ('2026-07-26', true, false, '77.7'),
  ('2026-07-27', true, true, '77.7'),
  ('2026-07-28', false, true, '77.8'),
  ('2026-07-29', true, true, '77.5'),
  ('2026-07-30', true, false, '77.8'),
  ('2026-07-31', true, true, '77.5'),
  ('2026-08-01', true, false, '77.6'),
  ('2026-08-02', false, true, '77.3'),
  ('2026-08-03', true, false, '77.4'),
  ('2026-08-04', true, false, '77.5'),
  ('2026-08-05', true, true, '77.2'),
  ('2026-08-06', true, false, '77.4'),
  ('2026-08-07', true, true, '77.1'),
  ('2026-08-08', true, true, '77.0'),
  ('2026-08-09', false, true, '77.0'),
  ('2026-08-10', true, false, '76.9'),
  ('2026-08-11', true, false, '77.1'),
  ('2026-08-12', true, false, '77.2'),
  ('2026-08-13', true, false, '76.7'),
  ('2026-08-14', false, false, '76.8'),
  ('2026-08-15', true, false, '76.8'),
  ('2026-08-16', false, false, '76.7'),
  ('2026-08-17', true, false, '76.8'),
  ('2026-08-18', true, false, '76.6'),
  ('2026-08-19', false, true, '76.5'),
  ('2026-08-20', true, false, '76.7'),
  ('2026-08-21', true, true, '76.6'),
  ('2026-08-22', false, false, '76.5'),
  ('2026-08-23', false, true, '76.3'),
  ('2026-08-24', true, false, '76.3'),
  ('2026-08-25', true, false, '76.3'),
  ('2026-08-26', false, false, '76.1'),
  ('2026-08-27', true, false, '76.3'),
  ('2026-08-28', false, false, '75.9'),
  ('2026-08-29', false, true, '75.9'),
  ('2026-08-30', false, true, '76.0'),
  ('2026-08-31', true, true, '75.7'),
  ('2026-09-01', false, false, '75.9'),
  ('2026-09-02', true, false, '75.8'),
  ('2026-09-03', false, true, '75.6'),
  ('2026-09-04', true, true, '75.7'),
  ('2026-09-05', false, false, '75.6'),
  ('2026-09-06', false, false, '75.5'),
  ('2026-09-07', true, true, '75.7'),
  ('2026-09-08', true, false, '75.4'),
  ('2026-09-09', false, false, '75.2'),
  ('2026-09-10', true, false, '75.3')
) as v(date, exercised, ate_sweets, weight)
where u.email = 'arpit_rai2014@pgp.isb.edu'
on conflict (user_id, date) do update
  set exercised  = excluded.exercised,
      ate_sweets = excluded.ate_sweets,
      weight     = excluded.weight;

-- Verify: expect 60 rows, no nulls, 2026-07-13 -> 2026-09-10.
-- select count(*) as days,
--        count(exercised) as has_exercise,
--        count(ate_sweets) as has_sugar,
--        count(weight) as has_weight,
--        min(date) as first_day, max(date) as last_day
-- from public.entries
-- where user_id = (select id from auth.users where email = 'arpit_rai2014@pgp.isb.edu')
--   and date between '2026-07-13' and '2026-09-10';
