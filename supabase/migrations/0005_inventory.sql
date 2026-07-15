-- ============================================================================
-- 0005_inventory.sql — the inventory snapshot hedge (build-order step 9).
-- A replaceable import of the tracker export. It never auto-updates a moment;
-- it just sits alongside so the manual licensing/warehouse fields can be
-- checked against the source. Run this LAST, after 0004.
-- ============================================================================

create table if not exists inventory_snapshot (
  id             bigserial primary key,
  imported_at    timestamptz not null default now(),
  imported_by    uuid references profiles(id),
  po             text,
  status         text,        -- 'At WH' | 'In transit' | 'TOP' | ...
  licensing      text,        -- 'Approved' | 'Pending'
  team_raw       text,        -- as it appears in the export
  team_code      text references teams(code),  -- nullable; fuzzy-matched on import
  style          text,
  color          text,
  units          int,
  target_launch  date,
  received_3pl   date
);
create index if not exists inventory_snapshot_team_style_idx
  on inventory_snapshot (team_code, style);

alter table inventory_snapshot enable row level security;

-- Any active user can read the snapshot (it informs the calendar).
drop policy if exists read_inventory on inventory_snapshot;
create policy read_inventory on inventory_snapshot
  for select using (is_active_user());

-- No client write policy: the import runs server-side with the service role
-- (truncate + insert), so writes never come from the browser.
