-- Account self-deletion for Tinu Tracker.
--
-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- The app's "Delete account" button calls this via supabase.rpc('delete_user_account').
--
-- It is SECURITY DEFINER (runs with the function owner's privileges) because deleting
-- a row from auth.users requires elevated access the client must never have. It is
-- safe: it only ever deletes the *calling* user's own data, identified by auth.uid()
-- from their verified JWT — it cannot touch anyone else's account.

create or replace function public.delete_user_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.entries where user_id = auth.uid();
  delete from auth.users where id = auth.uid();
end;
$$;

-- Only signed-in users may call it; never anon or the public role.
revoke all on function public.delete_user_account() from public, anon;
grant execute on function public.delete_user_account() to authenticated;
