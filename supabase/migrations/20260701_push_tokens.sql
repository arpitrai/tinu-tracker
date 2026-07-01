-- Stores one row per device that has registered for remote push.
-- The app upserts (token) on every launch; a token is globally unique to a
-- device, so ON CONFLICT (token) re-owns it if a different user signs in.
create table if not exists public.push_tokens (
  token       text primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  platform    text,
  updated_at  timestamptz not null default now()
);

create index if not exists push_tokens_user_id_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

-- A signed-in user may only see and manage their own device tokens. The send
-- side runs as the service role (in the Edge Function), which bypasses RLS.
create policy "own tokens - select" on public.push_tokens
  for select using (auth.uid() = user_id);

create policy "own tokens - insert" on public.push_tokens
  for insert with check (auth.uid() = user_id);

create policy "own tokens - update" on public.push_tokens
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own tokens - delete" on public.push_tokens
  for delete using (auth.uid() = user_id);
