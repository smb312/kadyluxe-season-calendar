-- ============================================================================
-- 0004_realtime_directory.sql
-- (a) Let active users read the member directory (id + names) so the app can
--     show "Savannah updated this". (b) Turn on Realtime for moments + teams.
-- Run this FOURTH, after 0003.
-- ============================================================================

-- (a) Broaden profile reads: any ACTIVE user may read profiles (for display
-- names on the realtime + history indicators). Writes stay admin-only.
-- Emails/roles are visible to signed-in users only — acceptable at this tool's
-- sensitivity level; the write boundary is unchanged.
drop policy if exists read_own_profile on profiles;
create policy read_profiles on profiles
  for select using (is_active_user() or id = auth.uid());

-- (b) Realtime. Full replica identity so UPDATE/DELETE payloads carry the row.
alter table moments      replica identity full;
alter table moment_teams replica identity full;

do $$ begin
  alter publication supabase_realtime add table moments;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table moment_teams;
exception when duplicate_object then null; end $$;
