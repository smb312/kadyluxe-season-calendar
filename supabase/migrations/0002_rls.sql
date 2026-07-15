-- ============================================================================
-- 0002_rls.sql — Row-level security
-- RLS is THE security boundary. The UI hiding buttons is only a convenience.
-- Every read AND write requires an ACTIVE profile, so a deactivated (banned)
-- account cannot read or write even if a stale session lingers.
-- Run this SECOND, after 0001_schema.sql.
-- ============================================================================

alter table profiles       enable row level security;
alter table teams          enable row level security;
alter table moments        enable row level security;
alter table moment_teams   enable row level security;
alter table moment_history enable row level security;

-- ---------------- helpers ----------------
-- security definer so they can read profiles regardless of the caller's own
-- policies. search_path pinned to public to prevent function hijacking.

-- Is the caller a signed-in, ACTIVE user?
create or replace function is_active_user()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and active
  );
$$;

-- Does the caller have one of these roles AND is active?
create or replace function current_role_is(roles user_role[])
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and active and role = any(roles)
  );
$$;

-- ---------------- read policies ----------------
-- Every signed-in ACTIVE user reads the calendar.
drop policy if exists read_moments on moments;
create policy read_moments on moments
  for select using (is_active_user());

drop policy if exists read_moment_teams on moment_teams;
create policy read_moment_teams on moment_teams
  for select using (is_active_user());

drop policy if exists read_teams on teams;
create policy read_teams on teams
  for select using (is_active_user());

drop policy if exists read_history on moment_history;
create policy read_history on moment_history
  for select using (is_active_user());

-- ---------------- write policies ----------------
-- Only active admin/editor may write moments and team assignments.
-- Vendors (viewers) are rejected here, at the database.
drop policy if exists write_moments on moments;
create policy write_moments on moments
  for all using (current_role_is('{admin,editor}'))
  with check (current_role_is('{admin,editor}'));

drop policy if exists write_moment_teams on moment_teams;
create policy write_moment_teams on moment_teams
  for all using (current_role_is('{admin,editor}'))
  with check (current_role_is('{admin,editor}'));

-- teams: no write policy on purpose. Seeded via SQL (postgres role bypasses
-- RLS). No app path edits the registry in v1.

-- ---------------- profiles ----------------
-- A user reads their own profile; an admin reads all. Only an admin writes.
drop policy if exists read_own_profile on profiles;
create policy read_own_profile on profiles
  for select using (id = auth.uid() or current_role_is('{admin}'));

drop policy if exists admin_manage_profiles on profiles;
create policy admin_manage_profiles on profiles
  for all using (current_role_is('{admin}'))
  with check (current_role_is('{admin}'));

-- moment_history: no insert/update/delete policy. Written by the audit
-- trigger only (security definer, in 0003). Users can read, never write.
