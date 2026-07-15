# Supabase setup — paste blocks (browser only, no terminal)

Open **Supabase → SQL Editor → New query**. Copy each block below (GitHub shows a
copy button on every code block), paste, **Run**, confirm success, then move to the
next. Do them **in order** — later blocks depend on earlier ones.

First finish **auth lockdown** and **keys** (steps 2–3 of SETUP.md) if you haven't:
Email provider on, "Confirm email" off, every other provider off, **"Allow new
users to sign up" OFF**. Then come back here.

---

## Block 1 — Schema (tables + enums)

`supabase/migrations/0001_schema.sql`

```sql
-- ============================================================================
-- 0001_schema.sql — KADYLUXE Season Calendar
-- Enums, profiles, teams, moments, moment_teams, moment_history.
-- Run this FIRST. Safe to re-run (guards on existence).
-- ============================================================================

-- ---------------- ENUMS ----------------
do $$ begin
  create type moment_type as enum ('drop','promo','activation','game','gate');
exception when duplicate_object then null; end $$;

do $$ begin
  create type channel as enum ('paid','email','sms','banner');
exception when duplicate_object then null; end $$;

do $$ begin
  create type user_role as enum ('admin','editor','viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lic_status as enum ('approved','pending','na');
exception when duplicate_object then null; end $$;

-- ---------------- PROFILES ----------------
-- One row per auth user. Created by the admin route, never by signup
-- (there is no signup). `active=false` + an auth ban = fully offboarded.
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  full_name   text,
  role        user_role not null default 'viewer',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------- TEAMS ----------------
-- Seeded from the prototype's TEAMS registry (41 teams) via seed/teams.sql.
-- `code` is the short UI key (DEN, DAL, OSU...). Team color is the only
-- chromatic element in the app and always comes from this table.
create table if not exists teams (
  code       text primary key,
  name       text not null,
  color      text not null,          -- hex, e.g. '#FB4F14'
  league     text not null,          -- 'NFL' | 'Pro' | 'CFB' | 'Affinity' | 'Core'
  tier       int,                    -- 1/2/3, nullable, for future use
  active     boolean not null default true,
  sort_order int not null default 0
);

-- ---------------- MOMENTS ----------------
create table if not exists moments (
  id             uuid primary key default gen_random_uuid(),
  date           date not null,
  end_date       date,               -- nullable; multi-day ranges (rush, BFCM)
  title          text not null,
  type           moment_type not null default 'activation',
  channels       channel[] not null default '{}',
  product_note   text,               -- 'Mini Icon · 7,847 units'
  owner          text,               -- free text, not a user FK
  notes          text,

  -- manual status fields (per the decoupling decision)
  licensing      lic_status not null default 'na',
  warehouse_date date,               -- last known 3PL receipt, typed by Haley
  blocked        boolean not null default false,
  blocked_reason text,

  created_by     uuid references profiles(id),
  created_at     timestamptz not null default now(),
  updated_by     uuid references profiles(id),
  updated_at     timestamptz not null default now(),

  -- a range must not end before it starts
  constraint end_after_start check (end_date is null or end_date >= date)
);
create index if not exists moments_date_idx on moments (date);
create index if not exists moments_type_idx on moments (type);

-- ---------------- MOMENT <-> TEAM ----------------
-- A moment with zero rows here is brand-wide. That is meaningful, not missing.
create table if not exists moment_teams (
  moment_id uuid not null references moments(id) on delete cascade,
  team_code text not null references teams(code) on delete cascade,
  primary key (moment_id, team_code)
);
create index if not exists moment_teams_team_idx on moment_teams (team_code);

-- ---------------- AUDIT ----------------
-- moment_id is deliberately NOT a FK so history survives a delete.
create table if not exists moment_history (
  id         bigserial primary key,
  moment_id  uuid not null,
  actor_id   uuid references profiles(id),
  action     text not null,           -- 'created' | 'updated' | 'deleted'
  diff       jsonb,                    -- { field: [old, new], ... }
  at         timestamptz not null default now()
);
create index if not exists moment_history_moment_idx on moment_history (moment_id, at desc);
```

> ▶ **Run it. Wait for _Success_ before Block 2.**


## Block 2 — Row-level security

`supabase/migrations/0002_rls.sql`

```sql
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
```

> ▶ **Run it. Wait for _Success_ before Block 3.**


## Block 3 — Audit trigger + stamping

`supabase/migrations/0003_history_trigger.sql`

```sql
-- ============================================================================
-- 0003_history_trigger.sql — audit trail + stamping
-- One history row per real change. Stamps created_by/updated_by/updated_at.
-- Run this THIRD, after 0002_rls.sql.
-- ============================================================================

create or replace function moments_audit()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  d jsonb;
begin
  if (tg_op = 'INSERT') then
    new.created_by := coalesce(new.created_by, auth.uid());
    new.created_at := coalesce(new.created_at, now());
    new.updated_by := coalesce(new.updated_by, auth.uid());
    new.updated_at := now();
    insert into moment_history (moment_id, actor_id, action, diff)
      values (new.id, auth.uid(), 'created', to_jsonb(new));
    return new;

  elsif (tg_op = 'UPDATE') then
    new.updated_by := auth.uid();
    new.updated_at := now();

    -- Field-level diff, ignoring the stamp columns themselves.
    select jsonb_object_agg(o.key, jsonb_build_array(o.value, n.value))
      into d
    from jsonb_each(to_jsonb(old)) o
    join jsonb_each(to_jsonb(new)) n on n.key = o.key
    where o.value is distinct from n.value
      and o.key not in ('updated_at', 'updated_by');

    -- Nothing meaningful changed (e.g. a no-op save) — don't log noise.
    if d is null then
      return new;
    end if;

    insert into moment_history (moment_id, actor_id, action, diff)
      values (new.id, auth.uid(), 'updated', d);
    return new;

  elsif (tg_op = 'DELETE') then
    insert into moment_history (moment_id, actor_id, action, diff)
      values (old.id, auth.uid(), 'deleted', to_jsonb(old));
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists moments_audit_trg on moments;
create trigger moments_audit_trg
  before insert or update or delete on moments
  for each row execute function moments_audit();
```

> ▶ **Run it. Wait for _Success_ before Block 4.**


## Block 4 — Member directory + Realtime

`supabase/migrations/0004_realtime_directory.sql`

```sql
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
```

> ▶ **Run it. Wait for _Success_ before Block 5.**


## Block 5 — Inventory snapshot table

`supabase/migrations/0005_inventory.sql`

```sql
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
```

> ▶ **Run it. Wait for _Success_ before Block 6.**


## Block 6 — Seed the 41 teams

`supabase/seed/teams.sql`  
After running, verify with the query below.

```sql
-- ============================================================================
-- teams.sql — the 41-team registry, ported from the prototype's TEAMS object.
-- Colors are each team's own. tier is unknown (null) for now. sort_order runs
-- league-first (NFL, Pro, CFB, Affinity, Core) then alphabetical by name,
-- matching the prototype's grouping. Idempotent: re-running updates in place.
-- Run AFTER the migrations.
-- ============================================================================

insert into teams (code, name, color, league, tier, active, sort_order) values
  -- NFL
  ('DAL',  'Dallas Cowboys',    '#041E42', 'NFL',      null, true, 10),
  ('DEN',  'Denver Broncos',    '#FB4F14', 'NFL',      null, true, 20),
  -- Pro (NBA/NHL)
  ('PHX',  'Phoenix Suns',      '#1D1160', 'Pro',      null, true, 30),
  ('SJS',  'San Jose Sharks',   '#006D75', 'Pro',      null, true, 40),
  ('UTM',  'Utah Mammoth',      '#3BA0D6', 'Pro',      null, true, 50),
  -- CFB (college), alphabetical by name
  ('BAMA', 'Alabama',           '#9E1B32', 'CFB',      null, true, 60),
  ('ASU',  'Arizona State',     '#8C1D40', 'CFB',      null, true, 70),
  ('AUB',  'Auburn',            '#0C2340', 'CFB',      null, true, 80),
  ('BSU',  'Boise State',       '#0033A0', 'CFB',      null, true, 90),
  ('BYU',  'BYU',               '#002E5D', 'CFB',      null, true, 100),
  ('CLEM', 'Clemson',           '#F66733', 'CFB',      null, true, 110),
  ('COLO', 'Colorado',          '#CFB87C', 'CFB',      null, true, 120),
  ('FLA',  'Florida',           '#0021A5', 'CFB',      null, true, 130),
  ('FSU',  'Florida State',     '#782F40', 'CFB',      null, true, 140),
  ('UGA',  'Georgia',           '#BA0C2F', 'CFB',      null, true, 150),
  ('ILL',  'Illinois',          '#13294B', 'CFB',      null, true, 160),
  ('IND',  'Indiana',           '#990000', 'CFB',      null, true, 170),
  ('IOWA', 'Iowa',              '#1C1C1C', 'CFB',      null, true, 180),
  ('KU',   'Kansas',            '#0051BA', 'CFB',      null, true, 190),
  ('KSU',  'Kansas State',      '#512888', 'CFB',      null, true, 200),
  ('UK',   'Kentucky',          '#0033A0', 'CFB',      null, true, 210),
  ('LSU',  'LSU',               '#461D7C', 'CFB',      null, true, 220),
  ('MIA',  'Miami',             '#F47321', 'CFB',      null, true, 230),
  ('MICH', 'Michigan',          '#00274C', 'CFB',      null, true, 240),
  ('MSU',  'Michigan State',    '#18453B', 'CFB',      null, true, 250),
  ('NEB',  'Nebraska',          '#E41C38', 'CFB',      null, true, 260),
  ('OSU',  'Ohio State',        '#BB0000', 'CFB',      null, true, 270),
  ('OU',   'Oklahoma',          '#841617', 'CFB',      null, true, 280),
  ('MISS', 'Ole Miss',          '#14213D', 'CFB',      null, true, 290),
  ('PSU',  'Penn State',        '#041E42', 'CFB',      null, true, 300),
  ('PUR',  'Purdue',            '#2B2B2B', 'CFB',      null, true, 310),
  ('TENN', 'Tennessee',         '#FF8200', 'CFB',      null, true, 320),
  ('TEX',  'Texas',             '#BF5700', 'CFB',      null, true, 330),
  ('TAMU', 'Texas A&M',         '#500000', 'CFB',      null, true, 340),
  ('UTAH', 'Utah',              '#CC0000', 'CFB',      null, true, 350),
  ('UVA',  'Virginia',          '#232D4B', 'CFB',      null, true, 360),
  ('VT',   'Virginia Tech',     '#630031', 'CFB',      null, true, 370),
  ('WIS',  'Wisconsin',         '#C5050C', 'CFB',      null, true, 380),
  ('WYO',  'Wyoming',           '#492F24', 'CFB',      null, true, 390),
  -- Affinity
  ('SOR',  'Sororities',        '#B08D57', 'Affinity', null, true, 400),
  -- Core / non-IP
  ('KL',   'KadyLuxe / non-IP', '#14110F', 'Core',     null, true, 410)
on conflict (code) do update set
  name       = excluded.name,
  color      = excluded.color,
  league     = excluded.league,
  tier       = excluded.tier,
  active     = excluded.active,
  sort_order = excluded.sort_order;
```

> ▶ **Run it. Wait for _Success_ before Block 7.**


**Verify teams (expect `41`):**

```sql
select count(*) as team_count from teams;
```

## Block 7 — Seed the 60 moments

`supabase/seed/moments.sql`  
The big one. After running, verify below.

```sql
-- moments.sql — generated from the prototype export (60 moments).
-- Faithful single-day import: no end_date inferred; licensing defaults to 'na'.
-- Paste into the Supabase SQL editor AFTER teams.sql. Run the guard query in
-- SUPABASE_PASTE.md first if you want to avoid double-inserting.

insert into moments (id, date, title, type, channels, product_note, owner, notes) values
  ('c4c0681a-817a-4e86-8c74-699f8b57982a', '2026-08-01', 'Two-Style Drop — Love Letter + Vinti', 'drop', '{paid,email,sms,banner}'::channel[], 'Love Letter (17 teams) + Vinti Cardi (3 teams)', 'Homestead / Eric', 'The only licensing-APPROVED styles in the book. Not a season launch. PDPs and collection pages must be live and indexed BEFORE Aug 1. Vinti approved teams: Dallas, Indiana, Arizona State.'),
  ('6edce4af-be33-4872-b7c3-36041c8029e1', '2026-08-01', 'PDPs + collection pages live', 'gate', '{}'::channel[], '17 approved teams', 'D2C Design / Haley', 'Hard gate. Pages indexed ahead of the drop, not on it.'),
  ('85d29d91-841f-43d9-96b3-af84ae60a706', '2026-08-05', 'Broncos licensing — 6 SKUs must clear', 'gate', '{}'::channel[], 'Throwback Crew, Mini Icon, Faux Fur Vest, SS Shine Hoodie, Bomber, Mesh Top', 'Haley', 'ALL SIX ARE PENDING. Nothing about Broncos Week is real until this clears. Four weeks of runway to Sept 8.'),
  ('c30e5231-07e0-4ce9-b20a-0fd90801e66f', '2026-08-05', 'Mini Icon licensing — 28 teams must clear', 'gate', '{}'::channel[], '7,847 units', 'Haley', 'Largest single style in the fall book. All 28 lines Pending.'),
  ('7e530863-744b-4881-ac22-d55ed776f0ff', '2026-08-10', 'Back-to-school layer opens', 'activation', '{email,banner}'::channel[], 'Sorority + campus audience', 'Savannah / Homestead', 'Positioning layer, NOT an offer. Move-in / first gameday / dinner after. No discount.'),
  ('41cdfb1b-2032-411a-93fa-0c50999d204f', '2026-08-01', 'GATE · Pull FLAP sorority licensing forward from Oct 1', 'gate', '{}'::channel[], '406 units · Love Letter 238 + Vinti 168 · already in WH', 'Haley / Kady', 'Sorority product currently carries an Oct 1 target launch and is licensing PENDING. Rush runs Aug 8-23. Bid Day is Aug 16 (Bama) and Aug 23 (Ole Miss). An Oct 1 launch misses the entire sorority season by six weeks, on units that are already sitting in the building. Pull it to Aug 1.'),
  ('9ba3404c-72e0-40ef-9766-d070b35578f2', '2026-08-01', 'GATE · Game Day Clear Clutch needs a 3PL date', 'gate', '{}'::channel[], '1,000 units · Sampling PP · no date', 'Haley', 'Rush and gameday both run clear-bag policies. This is the single most rush-appropriate SKU in the book and it has no warehouse date. Same undated-SKU problem as the Mesh Top.'),
  ('40216e28-25af-4414-975e-02b3aa0ac473', '2026-08-03', 'RUSH · List-build opens (PNM + mom + alumnae)', 'activation', '{paid,email,sms,banner}'::channel[], 'Capture, not convert', 'Homestead / Eric', 'We do not have a rush-week assortment — knitwear in 95-degree Alabama is the wrong product. We DO have the audience at the highest-attention moment of their year. Play: capture the list now, monetize at Bid Day gifting and gameday. Back-in-stock and preorder capture on Love Letter and Vinti by chapter and school.'),
  ('858aec2d-2107-4a32-8d36-ac3edbe74dea', '2026-08-06', 'RUSH · Paid goes live, geo-targeted', 'activation', '{paid}'::channel[], 'PNM early move-in begins (Bama Aug 6-7)', 'Eric', 'Meta + IG geo-targeted to Tuscaloosa and Oxford, plus lookalikes off the sorority customer file. Creative reads fashion, not merch. No gameday language.'),
  ('2ce4d756-99fa-4355-b119-24236a4261b5', '2026-08-08', 'RUSH · Alabama recruitment begins (Convocation)', 'activation', '{paid,email}'::channel[], 'Aug 8-16 · Bid Day Aug 16', 'Savannah / Homestead', 'Bama is the biggest recruitment in the country (2,500-3,000 PNMs). RushTok makes it a national attention event, not a local one. Organic social should be riding it.'),
  ('91641fc8-b2df-4924-b11b-4828dc7d5db7', '2026-08-12', 'RUSH · Mid-week send · Linen Easy Shirt lands', 'activation', '{paid,email,sms}'::channel[], 'Linen Easy Shirt arrives Aug 12', 'Homestead', 'One of only two styles that actually suit August weather. Position as the piece for the week AFTER rush, not during it.'),
  ('c3cefa79-9248-441f-b28f-45f1f4297294', '2026-08-16', 'BAMA BID DAY (Bryant-Denny)', 'activation', '{paid,email,sms,banner}'::channel[], 'Peak sorority moment of the year', 'All', 'Bids distributed in Bryant-Denny Stadium. New Member gifting is a real, established purchase category here (local vendors run New Member Packages). Mom and alumnae segments are the buyers, not the PNMs. Gift positioning, fall delivery.'),
  ('88d81512-5367-4f63-8c61-b094615f3a6b', '2026-08-17', 'RUSH · New member gifting — mom + alumnae segment', 'activation', '{paid,email}'::channel[], 'The buyer is not the wearer', 'Homestead / Eric', 'Post-Bid-Day window. Segment to moms and alumnae. Love Letter and Vinti as the welcome-to-the-chapter gift, delivered for fall.'),
  ('4ec42f6a-242f-4efe-bcad-279a48922a19', '2026-08-23', 'OLE MISS BID DAY (the Grove)', 'activation', '{paid,email,sms,banner}'::channel[], 'Rush Aug 13-23 · 2,200+ PNMs', 'All', 'Lands one day after the Mini Icon drop (Aug 22). Best sequencing luck on the whole calendar — use it. Ole Miss has the best unit economics in the catalog (4.6% discount rate, sells at MSRP).'),
  ('52256c5e-5cb9-48aa-9f54-83dba4a1b0eb', '2026-08-24', 'RUSH WAVE 2 — Big Ten + remaining schools', 'activation', '{paid,email}'::channel[], 'Dates NOT yet confirmed', 'Savannah', 'Rush timing varies by school — Big Ten generally runs later than the SEC, and some schools defer to spring. Somebody needs to pull the actual Panhellenic calendar for our Tier 1 schools before this is real. Do not assume.'),
  ('2e1bf641-5701-41cd-9e82-aad11a089421', '2026-08-12', 'Second wave — restock + new colorways', 'drop', '{email,banner}'::channel[], 'Shine Knit Hoodie, Faux Fur Vest, Linen Easy Shirt, Vinti colorways', 'Homestead', 'Low-lift send to warm list. Faux Fur Vest arrives Aug 8 (7 teams).'),
  ('e2ff02bc-58d5-41d8-a62c-8b2aa253696c', '2026-08-14', 'Broncos preseason opener at Atlanta', 'game', '{}'::channel[], 'Organic social only', 'Savannah', 'No paid, no product. Nothing is licensing-approved yet.'),
  ('dddf6208-ba5f-4cd5-832c-54960ce279d5', '2026-08-19', 'Mini Icon Sweater arrives at 3PL', 'gate', '{}'::channel[], '7,847 units · 28 teams', 'Haley', 'Biggest unit block in the book. Broncos Tan = 1,924 of it.'),
  ('96ff9f28-6034-4210-89c1-9a215c5be1db', '2026-08-21', 'Broncos Week creative approved', 'gate', '{}'::channel[], '6 creative sets', 'Kady / Keghan', 'Six drop days = six creative sets: email, SMS, paid, PDP, banner. Shot and approved by this date or the week does not run.'),
  ('cb846bbd-57be-4276-9cad-7bb139bbc2bf', '2026-08-22', 'MINI ICON DROP — 28 teams', 'drop', '{paid,email,sms,banner}'::channel[], '7,847 units · 28 teams', 'All', 'Biggest August moment. Dedicated collection page. Three days ahead of CFB Week 0. Paid budget follows this style.'),
  ('a341b4c2-1d12-4e58-916d-8c544b15b123', '2026-08-26', 'Pointelle Vest, Western Tee, Game Changer Tee land', 'drop', '{email}'::channel[], 'Fold into Mini Icon collection', 'Haley', 'Do not give these their own moment. Merchandise into the live collection.'),
  ('39e3aa0b-7dd7-41a7-a389-10f5e59cb71f', '2026-08-29', 'CFB Week 0', 'game', '{paid,email,banner}'::channel[], 'UNC v TCU (Dublin) + early slate', 'Savannah / Eric', 'First "your team is back" email of the season.'),
  ('96b6dac3-a0f3-4f59-a019-daebda832136', '2026-09-01', 'Broncos Week waitlists open', 'activation', '{email,sms,banner}'::channel[], 'One waitlist per SKU', 'Homestead', 'Broncos list is the only warm list we have. Open one week ahead of the drops.'),
  ('71084c7d-06e3-4158-ae06-6911468f1e84', '2026-09-03', 'CFB Week 1 opens', 'game', '{paid,email}'::channel[], 'Tier 1 schools only', 'Eric / Homestead', 'Team-segmented sends. Style of the week: Love Letter Sweater.'),
  ('3b3a5b1a-d3f0-4937-8842-cdd58b98f69c', '2026-09-05', 'CFB Week 1 — main slate', 'game', '{paid,email,sms,banner}'::channel[], 'Biggest organic + paid day of the month so far', 'All', null),
  ('db76b161-2bd5-4c17-98e6-5e6e299b88a1', '2026-09-07', 'Labor Day — NO SALE', 'gate', '{}'::channel[], 'Deliberate', 'Scott', 'Do not run a Labor Day promo. Run a first-Saturday recap and UGC push instead. Do not train the list to wait for a code.'),
  ('7fcd920d-328b-461e-8ea9-862c40862676', '2026-09-08', 'BRONCOS WEEK — Day 1 · Throwback Knit Crew', 'drop', '{paid,email,sms,banner}'::channel[], 'Royal · 1,924 units · in WH Aug 5', 'All', 'Biggest Broncos SKU. Opens the week.'),
  ('a1f3b808-432a-436e-afeb-3fa2d87782b3', '2026-09-09', 'Day 2 · Mini Icon Sweater (Tan)', 'drop', '{paid,email,sms,banner}'::channel[], 'Tan · 1,924 units · in WH Aug 19', 'All', 'Lands on NFL Kickoff Game night.'),
  ('99448bee-a86f-4912-ae66-a2f08a8278b5', '2026-09-09', 'NFL Kickoff Game', 'game', '{banner}'::channel[], 'Football is back', 'Savannah', null),
  ('b5791165-e8aa-4717-8ea3-17d34dd2453c', '2026-09-10', 'Day 3 · Reversible Faux Fur Vest (Navy)', 'drop', '{paid,email,sms,banner}'::channel[], 'Navy · 528 units · in WH Aug 16', 'All', null),
  ('2498174b-aede-4ab3-8069-fc88de3bdbe0', '2026-09-11', 'Day 4 · SS Shine Knit Hoodie (Navy)', 'drop', '{paid,email,sms,banner}'::channel[], 'Navy · 776 units · arrives Sept 2', 'All', 'Tightest of the four in-stock SKUs. Confirm receipt Sept 2.'),
  ('d857c037-55ae-4733-942c-4063235f5673', '2026-09-12', 'Day 5 · Mesh Top (Navy) — CONDITIONAL', 'drop', '{email,sms}'::channel[], 'Navy · 740 units · NO 3PL DATE', 'Haley', 'No warehouse date exists for this SKU. If no date lands, this becomes a full-collection "shop the drop" day instead.'),
  ('98e2dad4-684a-4ca6-a782-39fd09d4346f', '2026-09-13', 'Day 6 · Faux Fur Bomber — PREORDER', 'drop', '{paid,email,sms,banner}'::channel[], 'Orange · 1,480 units · arrives Sept 16', 'Kady decision', 'Cannot ship in-week. Options: preorder shipping late Sept (recommended), air-freight to hit Sept 8, or hold to October.'),
  ('b33908fd-acdb-447e-9643-b110cb679a8c', '2026-09-13', 'Cowboys open at NY Giants (SNF)', 'game', '{paid,email}'::channel[], 'Dallas-segmented ONLY', 'Homestead / Eric', 'Falls INSIDE Broncos Week. Must be a segmented send. A general-list Cowboys email 24h before the Broncos climax steps on the biggest day of the year. Dallas depth: Love Letter 700, Vinti 628, Game Changer Tee 553, Mini Icon 541.'),
  ('41c05bf9-c85c-44db-addc-1e92084d1b5b', '2026-09-14', 'BRONCOS OPENER at Kansas City (MNF)', 'game', '{paid,email,sms,banner}'::channel[], 'Full Broncos collection live', 'All', 'Peak intent day of the month. National primetime. Everything is live by now — this is the selling day, not a drop day.'),
  ('0865d279-6384-44ba-b3cf-43b9abc57bb7', '2026-09-20', 'Broncos home opener vs Jacksonville', 'game', '{paid,email,banner}'::channel[], 'Second selling peak', 'Eric / Homestead', 'Collection already live. Merchandising + paid moment.'),
  ('0c87e0bd-d116-4a77-a8bb-c1a7a2573e83', '2026-09-21', 'Style of the week — Vinti Cardi', 'activation', '{paid,email,banner}'::channel[], 'Premium AOV driver', 'Savannah / Eric', null),
  ('60288ca9-33c3-4d70-b135-382fd55a1e9a', '2026-09-27', 'Broncos vs LA Rams (SNF)', 'game', '{paid,email,banner}'::channel[], 'Second national Denver moment', 'Eric', 'Faux Fur Bomber preorders ship around here — fulfillment email is a second selling moment.'),
  ('a2137829-a74d-42a3-89e0-6ba0a6ad1549', '2026-09-28', 'Style of the week — Mini Icon Sweater', 'activation', '{paid,email,banner}'::channel[], 'Broadest team coverage', 'Savannah / Eric', 'Carries the CFB audience while Denver carries NFL.'),
  ('5845083d-cc4e-4c2c-9c28-3c63a5b78526', '2026-10-05', 'Weekly team spotlight — off the polls', 'activation', '{paid,email}'::channel[], 'Chosen off AP/CFP movement each Sunday', 'Savannah / Eric', 'Assign the team on the Sunday. This is the 24-hour lever the playbooks were built for.'),
  ('4f6dc4e6-c0fa-405a-bdbd-4fcbd47ba543', '2026-10-12', 'Faux Fur Bomber becomes fall hero', 'activation', '{paid,email,banner}'::channel[], 'Denver 1,480 · Phoenix 500 · Dallas 300 · Texas 300', 'Eric', 'Weather turns. Bomber takes over from the sweaters as the statement piece.'),
  ('337b6109-4341-42d3-991d-0cb42d45b3b2', '2026-10-15', 'Broncos vs Seattle (TNF, home)', 'game', '{paid,email,sms,banner}'::channel[], 'Only home game in a 4-week road stretch', 'All', 'Protect this date.'),
  ('a8aa8935-06a1-46ed-a099-ee122f96339a', '2026-10-15', 'Sell-through read for reorder decision', 'gate', '{}'::channel[], '40-day lead time', 'Scott → Kady/Matt', 'Holiday reorder call is Kady and Matt. I owe them the demand read by this date.'),
  ('d9b8f60e-ce3b-439d-9489-75cc8be90f2a', '2026-10-15', 'BFCM offer structure decided', 'gate', '{}'::channel[], 'Locks email, SMS and paid build', 'Kady / Matt / Scott', 'Recommendation: tiered SPEND thresholds, not % off. Heroes and new arrivals excluded. Discount the tail (84 of 200 SKUs sold <10 units last year).'),
  ('326adbce-05df-4ac1-836e-f73112d22d77', '2026-10-19', 'Rivalry + homecoming segments', 'activation', '{email,sms}'::channel[], 'By school', 'Homestead', 'Assign teams once the rivalry weeks are confirmed.'),
  ('0d294ed8-f6db-4c28-8f7e-16a648a137ad', '2026-10-26', 'Early holiday capture — warm list', 'activation', '{email,sms,banner}'::channel[], 'Ahead of BFCM noise', 'Homestead', 'Gifting positioning begins before everyone else starts shouting.'),
  ('cecb52e8-1219-4fdc-bcdc-4bff8694fedb', '2026-11-01', 'BFCM early-access list build opens', 'activation', '{email,sms,banner}'::channel[], 'Every send drives to it', 'Homestead', 'The BFCM revenue is actually made here, not on Black Friday.'),
  ('d3769e5c-c103-4392-a09a-d63d59c90356', '2026-11-10', 'Gift guide live', 'activation', '{paid,email,banner}'::channel[], 'By team, by price', 'Savannah / D2C Design', null),
  ('3f9bfc10-4a0a-4699-ad36-7a57fb0e240c', '2026-11-24', 'BFCM early access — list only', 'promo', '{email,sms}'::channel[], 'Best offer, list exclusive', 'Homestead', 'Rewards the list, protects the brand. Tiered spend thresholds.'),
  ('b9acf598-0385-4455-b3c4-3b159b0a6b74', '2026-11-26', 'Thanksgiving — Cowboys game', 'game', '{paid,email,banner}'::channel[], 'Cowboys creative, no hard sell', 'Eric / Savannah', null),
  ('19f1b218-fbff-400c-ad06-614768da7de0', '2026-11-27', 'BLACK FRIDAY — public offer', 'promo', '{paid,email,sms,banner}'::channel[], 'Softer than early access', 'All', 'Broncos play the NFL Black Friday game at Pittsburgh — run Denver-specific creative against it.'),
  ('45956c9d-b3c4-405c-bacb-a76bc4d29207', '2026-11-27', 'Broncos at Pittsburgh (NFL Black Friday game)', 'game', '{paid,banner}'::channel[], 'National window on Black Friday', 'Eric', null),
  ('c5b9c694-787e-4dfd-bc8f-e302fe2659ed', '2026-11-30', 'Cyber Monday — last call', 'promo', '{paid,email,sms,banner}'::channel[], 'Close the window', 'All', null),
  ('70d37722-4f04-4cee-a1f2-a0e9797261a4', '2026-12-01', 'Gifting becomes the primary story', 'activation', '{paid,email,banner}'::channel[], 'Team collections become gift collections', 'Savannah / Homestead', null),
  ('89a3e570-1bfc-4ab6-aad4-2ea6ba6a06ec', '2026-12-05', 'CFB conference championships', 'game', '{paid,email,sms}'::channel[], 'Team-specific creative', 'Eric / Savannah', 'Assign teams once the matchups are set.'),
  ('8a445e9c-82c8-46a1-b672-c9fb8b17ed70', '2026-12-06', 'Final CFP rankings — 12 teams named', 'game', '{paid,email,sms,banner}'::channel[], 'Highest-leverage 24 hours of the season', 'All', 'Twelve teams get named. We should be able to deploy paid, email and creative on any of them within a day. This is what the tier playbooks are for.'),
  ('962fa81c-936c-411f-8724-4cba5299c5e4', '2026-12-12', 'Shipping cutoff messaging begins', 'activation', '{email,sms,banner}'::channel[], 'Final cutoff TBC with 3PL', 'Haley / Homestead', 'Confirm actual cutoff date with the Salt Lake 3PL.'),
  ('0c698833-5eeb-42d5-a2d0-5ab0fed70e7e', '2026-12-18', 'CFP first round — campus sites', 'game', '{paid,email,sms,banner}'::channel[], 'Home fanbases maximally activated', 'All', null),
  ('8b0c6512-2b3e-4df5-8d97-2f34ef4019dc', '2026-12-25', 'BRONCOS ON CHRISTMAS DAY vs Buffalo (home)', 'game', '{paid,email,sms,banner}'::channel[], 'Best Broncos media moment of the season', 'All', 'National broadcast, Denver, holiday. Over-invest here.'),
  ('d705efcc-95f4-48fb-80f2-216d93827523', '2026-12-26', 'Post-holiday clearance — tail SKUs only', 'promo', '{email,banner}'::channel[], '84 of 200 SKUs sold <10 units last year', 'Homestead', 'Heroes are never marked down. Gift-card redemption flow live.');

insert into moment_teams (moment_id, team_code) values
  ('c4c0681a-817a-4e86-8c74-699f8b57982a', 'DAL'),
  ('c4c0681a-817a-4e86-8c74-699f8b57982a', 'OSU'),
  ('c4c0681a-817a-4e86-8c74-699f8b57982a', 'MICH'),
  ('c4c0681a-817a-4e86-8c74-699f8b57982a', 'MSU'),
  ('c4c0681a-817a-4e86-8c74-699f8b57982a', 'NEB'),
  ('c4c0681a-817a-4e86-8c74-699f8b57982a', 'TEX'),
  ('c4c0681a-817a-4e86-8c74-699f8b57982a', 'WIS'),
  ('c4c0681a-817a-4e86-8c74-699f8b57982a', 'IND'),
  ('c4c0681a-817a-4e86-8c74-699f8b57982a', 'IOWA'),
  ('c4c0681a-817a-4e86-8c74-699f8b57982a', 'BYU'),
  ('c4c0681a-817a-4e86-8c74-699f8b57982a', 'KU'),
  ('c4c0681a-817a-4e86-8c74-699f8b57982a', 'UTAH'),
  ('c4c0681a-817a-4e86-8c74-699f8b57982a', 'AUB'),
  ('c4c0681a-817a-4e86-8c74-699f8b57982a', 'LSU'),
  ('c4c0681a-817a-4e86-8c74-699f8b57982a', 'OU'),
  ('c4c0681a-817a-4e86-8c74-699f8b57982a', 'TAMU'),
  ('c4c0681a-817a-4e86-8c74-699f8b57982a', 'WYO'),
  ('c4c0681a-817a-4e86-8c74-699f8b57982a', 'ASU'),
  ('85d29d91-841f-43d9-96b3-af84ae60a706', 'DEN'),
  ('c30e5231-07e0-4ce9-b20a-0fd90801e66f', 'DEN'),
  ('c30e5231-07e0-4ce9-b20a-0fd90801e66f', 'DAL'),
  ('c30e5231-07e0-4ce9-b20a-0fd90801e66f', 'OSU'),
  ('c30e5231-07e0-4ce9-b20a-0fd90801e66f', 'MICH'),
  ('c30e5231-07e0-4ce9-b20a-0fd90801e66f', 'MSU'),
  ('c30e5231-07e0-4ce9-b20a-0fd90801e66f', 'IND'),
  ('c30e5231-07e0-4ce9-b20a-0fd90801e66f', 'IOWA'),
  ('c30e5231-07e0-4ce9-b20a-0fd90801e66f', 'NEB'),
  ('c30e5231-07e0-4ce9-b20a-0fd90801e66f', 'WIS'),
  ('c30e5231-07e0-4ce9-b20a-0fd90801e66f', 'ILL'),
  ('c30e5231-07e0-4ce9-b20a-0fd90801e66f', 'PSU'),
  ('c30e5231-07e0-4ce9-b20a-0fd90801e66f', 'TEX'),
  ('c30e5231-07e0-4ce9-b20a-0fd90801e66f', 'OU'),
  ('c30e5231-07e0-4ce9-b20a-0fd90801e66f', 'LSU'),
  ('c30e5231-07e0-4ce9-b20a-0fd90801e66f', 'BAMA'),
  ('c30e5231-07e0-4ce9-b20a-0fd90801e66f', 'AUB'),
  ('c30e5231-07e0-4ce9-b20a-0fd90801e66f', 'UGA'),
  ('c30e5231-07e0-4ce9-b20a-0fd90801e66f', 'TENN'),
  ('c30e5231-07e0-4ce9-b20a-0fd90801e66f', 'FLA'),
  ('c30e5231-07e0-4ce9-b20a-0fd90801e66f', 'UK'),
  ('c30e5231-07e0-4ce9-b20a-0fd90801e66f', 'CLEM'),
  ('c30e5231-07e0-4ce9-b20a-0fd90801e66f', 'BYU'),
  ('c30e5231-07e0-4ce9-b20a-0fd90801e66f', 'UTAH'),
  ('c30e5231-07e0-4ce9-b20a-0fd90801e66f', 'VT'),
  ('c30e5231-07e0-4ce9-b20a-0fd90801e66f', 'COLO'),
  ('c30e5231-07e0-4ce9-b20a-0fd90801e66f', 'PHX'),
  ('c30e5231-07e0-4ce9-b20a-0fd90801e66f', 'UTM'),
  ('c30e5231-07e0-4ce9-b20a-0fd90801e66f', 'WYO'),
  ('7e530863-744b-4881-ac22-d55ed776f0ff', 'SOR'),
  ('41cdfb1b-2032-411a-93fa-0c50999d204f', 'SOR'),
  ('9ba3404c-72e0-40ef-9766-d070b35578f2', 'SOR'),
  ('40216e28-25af-4414-975e-02b3aa0ac473', 'SOR'),
  ('40216e28-25af-4414-975e-02b3aa0ac473', 'BAMA'),
  ('40216e28-25af-4414-975e-02b3aa0ac473', 'MISS'),
  ('40216e28-25af-4414-975e-02b3aa0ac473', 'AUB'),
  ('40216e28-25af-4414-975e-02b3aa0ac473', 'UGA'),
  ('40216e28-25af-4414-975e-02b3aa0ac473', 'TENN'),
  ('40216e28-25af-4414-975e-02b3aa0ac473', 'LSU'),
  ('40216e28-25af-4414-975e-02b3aa0ac473', 'TEX'),
  ('40216e28-25af-4414-975e-02b3aa0ac473', 'TAMU'),
  ('858aec2d-2107-4a32-8d36-ac3edbe74dea', 'SOR'),
  ('858aec2d-2107-4a32-8d36-ac3edbe74dea', 'BAMA'),
  ('858aec2d-2107-4a32-8d36-ac3edbe74dea', 'MISS'),
  ('2ce4d756-99fa-4355-b119-24236a4261b5', 'SOR'),
  ('2ce4d756-99fa-4355-b119-24236a4261b5', 'BAMA'),
  ('91641fc8-b2df-4924-b11b-4828dc7d5db7', 'SOR'),
  ('91641fc8-b2df-4924-b11b-4828dc7d5db7', 'BAMA'),
  ('91641fc8-b2df-4924-b11b-4828dc7d5db7', 'MISS'),
  ('c3cefa79-9248-441f-b28f-45f1f4297294', 'SOR'),
  ('c3cefa79-9248-441f-b28f-45f1f4297294', 'BAMA'),
  ('88d81512-5367-4f63-8c61-b094615f3a6b', 'SOR'),
  ('88d81512-5367-4f63-8c61-b094615f3a6b', 'BAMA'),
  ('4ec42f6a-242f-4efe-bcad-279a48922a19', 'SOR'),
  ('4ec42f6a-242f-4efe-bcad-279a48922a19', 'MISS'),
  ('52256c5e-5cb9-48aa-9f54-83dba4a1b0eb', 'SOR'),
  ('52256c5e-5cb9-48aa-9f54-83dba4a1b0eb', 'OSU'),
  ('52256c5e-5cb9-48aa-9f54-83dba4a1b0eb', 'MICH'),
  ('52256c5e-5cb9-48aa-9f54-83dba4a1b0eb', 'IND'),
  ('52256c5e-5cb9-48aa-9f54-83dba4a1b0eb', 'IOWA'),
  ('52256c5e-5cb9-48aa-9f54-83dba4a1b0eb', 'NEB'),
  ('52256c5e-5cb9-48aa-9f54-83dba4a1b0eb', 'WIS'),
  ('52256c5e-5cb9-48aa-9f54-83dba4a1b0eb', 'PSU'),
  ('52256c5e-5cb9-48aa-9f54-83dba4a1b0eb', 'ILL'),
  ('2e1bf641-5701-41cd-9e82-aad11a089421', 'DAL'),
  ('2e1bf641-5701-41cd-9e82-aad11a089421', 'TEX'),
  ('2e1bf641-5701-41cd-9e82-aad11a089421', 'UGA'),
  ('2e1bf641-5701-41cd-9e82-aad11a089421', 'TENN'),
  ('2e1bf641-5701-41cd-9e82-aad11a089421', 'NEB'),
  ('2e1bf641-5701-41cd-9e82-aad11a089421', 'IOWA'),
  ('2e1bf641-5701-41cd-9e82-aad11a089421', 'COLO'),
  ('2e1bf641-5701-41cd-9e82-aad11a089421', 'BYU'),
  ('2e1bf641-5701-41cd-9e82-aad11a089421', 'WIS'),
  ('2e1bf641-5701-41cd-9e82-aad11a089421', 'UTAH'),
  ('2e1bf641-5701-41cd-9e82-aad11a089421', 'ILL'),
  ('2e1bf641-5701-41cd-9e82-aad11a089421', 'WYO'),
  ('2e1bf641-5701-41cd-9e82-aad11a089421', 'PHX'),
  ('2e1bf641-5701-41cd-9e82-aad11a089421', 'SJS'),
  ('e2ff02bc-58d5-41d8-a62c-8b2aa253696c', 'DEN'),
  ('dddf6208-ba5f-4cd5-832c-54960ce279d5', 'DEN'),
  ('96ff9f28-6034-4210-89c1-9a215c5be1db', 'DEN'),
  ('cb846bbd-57be-4276-9cad-7bb139bbc2bf', 'DEN'),
  ('cb846bbd-57be-4276-9cad-7bb139bbc2bf', 'DAL'),
  ('cb846bbd-57be-4276-9cad-7bb139bbc2bf', 'OSU'),
  ('cb846bbd-57be-4276-9cad-7bb139bbc2bf', 'MICH'),
  ('cb846bbd-57be-4276-9cad-7bb139bbc2bf', 'MSU'),
  ('cb846bbd-57be-4276-9cad-7bb139bbc2bf', 'IND'),
  ('cb846bbd-57be-4276-9cad-7bb139bbc2bf', 'IOWA'),
  ('cb846bbd-57be-4276-9cad-7bb139bbc2bf', 'NEB'),
  ('cb846bbd-57be-4276-9cad-7bb139bbc2bf', 'WIS'),
  ('cb846bbd-57be-4276-9cad-7bb139bbc2bf', 'ILL'),
  ('cb846bbd-57be-4276-9cad-7bb139bbc2bf', 'PSU'),
  ('cb846bbd-57be-4276-9cad-7bb139bbc2bf', 'TEX'),
  ('cb846bbd-57be-4276-9cad-7bb139bbc2bf', 'OU'),
  ('cb846bbd-57be-4276-9cad-7bb139bbc2bf', 'LSU'),
  ('cb846bbd-57be-4276-9cad-7bb139bbc2bf', 'BAMA'),
  ('cb846bbd-57be-4276-9cad-7bb139bbc2bf', 'AUB'),
  ('cb846bbd-57be-4276-9cad-7bb139bbc2bf', 'UGA'),
  ('cb846bbd-57be-4276-9cad-7bb139bbc2bf', 'TENN'),
  ('cb846bbd-57be-4276-9cad-7bb139bbc2bf', 'FLA'),
  ('cb846bbd-57be-4276-9cad-7bb139bbc2bf', 'UK'),
  ('cb846bbd-57be-4276-9cad-7bb139bbc2bf', 'CLEM'),
  ('cb846bbd-57be-4276-9cad-7bb139bbc2bf', 'BYU'),
  ('cb846bbd-57be-4276-9cad-7bb139bbc2bf', 'UTAH'),
  ('cb846bbd-57be-4276-9cad-7bb139bbc2bf', 'VT'),
  ('cb846bbd-57be-4276-9cad-7bb139bbc2bf', 'COLO'),
  ('cb846bbd-57be-4276-9cad-7bb139bbc2bf', 'PHX'),
  ('cb846bbd-57be-4276-9cad-7bb139bbc2bf', 'UTM'),
  ('cb846bbd-57be-4276-9cad-7bb139bbc2bf', 'WYO'),
  ('a341b4c2-1d12-4e58-916d-8c544b15b123', 'BAMA'),
  ('a341b4c2-1d12-4e58-916d-8c544b15b123', 'UGA'),
  ('a341b4c2-1d12-4e58-916d-8c544b15b123', 'TEX'),
  ('a341b4c2-1d12-4e58-916d-8c544b15b123', 'TENN'),
  ('a341b4c2-1d12-4e58-916d-8c544b15b123', 'TAMU'),
  ('a341b4c2-1d12-4e58-916d-8c544b15b123', 'NEB'),
  ('a341b4c2-1d12-4e58-916d-8c544b15b123', 'LSU'),
  ('a341b4c2-1d12-4e58-916d-8c544b15b123', 'IOWA'),
  ('a341b4c2-1d12-4e58-916d-8c544b15b123', 'IND'),
  ('a341b4c2-1d12-4e58-916d-8c544b15b123', 'ILL'),
  ('a341b4c2-1d12-4e58-916d-8c544b15b123', 'FSU'),
  ('a341b4c2-1d12-4e58-916d-8c544b15b123', 'FLA'),
  ('a341b4c2-1d12-4e58-916d-8c544b15b123', 'DAL'),
  ('a341b4c2-1d12-4e58-916d-8c544b15b123', 'CLEM'),
  ('a341b4c2-1d12-4e58-916d-8c544b15b123', 'AUB'),
  ('a341b4c2-1d12-4e58-916d-8c544b15b123', 'ASU'),
  ('a341b4c2-1d12-4e58-916d-8c544b15b123', 'UVA'),
  ('a341b4c2-1d12-4e58-916d-8c544b15b123', 'WIS'),
  ('a341b4c2-1d12-4e58-916d-8c544b15b123', 'OSU'),
  ('a341b4c2-1d12-4e58-916d-8c544b15b123', 'OU'),
  ('a341b4c2-1d12-4e58-916d-8c544b15b123', 'KL'),
  ('96b6dac3-a0f3-4f59-a019-daebda832136', 'DEN'),
  ('71084c7d-06e3-4158-ae06-6911468f1e84', 'OSU'),
  ('71084c7d-06e3-4158-ae06-6911468f1e84', 'TEX'),
  ('71084c7d-06e3-4158-ae06-6911468f1e84', 'BAMA'),
  ('71084c7d-06e3-4158-ae06-6911468f1e84', 'UGA'),
  ('71084c7d-06e3-4158-ae06-6911468f1e84', 'LSU'),
  ('71084c7d-06e3-4158-ae06-6911468f1e84', 'MICH'),
  ('71084c7d-06e3-4158-ae06-6911468f1e84', 'IND'),
  ('71084c7d-06e3-4158-ae06-6911468f1e84', 'OU'),
  ('71084c7d-06e3-4158-ae06-6911468f1e84', 'TENN'),
  ('71084c7d-06e3-4158-ae06-6911468f1e84', 'PSU'),
  ('7fcd920d-328b-461e-8ea9-862c40862676', 'DEN'),
  ('a1f3b808-432a-436e-afeb-3fa2d87782b3', 'DEN'),
  ('b5791165-e8aa-4717-8ea3-17d34dd2453c', 'DEN'),
  ('2498174b-aede-4ab3-8069-fc88de3bdbe0', 'DEN'),
  ('d857c037-55ae-4733-942c-4063235f5673', 'DEN'),
  ('98e2dad4-684a-4ca6-a782-39fd09d4346f', 'DEN'),
  ('b33908fd-acdb-447e-9643-b110cb679a8c', 'DAL'),
  ('41c05bf9-c85c-44db-addc-1e92084d1b5b', 'DEN'),
  ('0865d279-6384-44ba-b3cf-43b9abc57bb7', 'DEN'),
  ('0c87e0bd-d116-4a77-a8bb-c1a7a2573e83', 'DAL'),
  ('0c87e0bd-d116-4a77-a8bb-c1a7a2573e83', 'IND'),
  ('0c87e0bd-d116-4a77-a8bb-c1a7a2573e83', 'ASU'),
  ('0c87e0bd-d116-4a77-a8bb-c1a7a2573e83', 'BAMA'),
  ('0c87e0bd-d116-4a77-a8bb-c1a7a2573e83', 'LSU'),
  ('0c87e0bd-d116-4a77-a8bb-c1a7a2573e83', 'AUB'),
  ('0c87e0bd-d116-4a77-a8bb-c1a7a2573e83', 'CLEM'),
  ('0c87e0bd-d116-4a77-a8bb-c1a7a2573e83', 'OU'),
  ('0c87e0bd-d116-4a77-a8bb-c1a7a2573e83', 'PSU'),
  ('0c87e0bd-d116-4a77-a8bb-c1a7a2573e83', 'NEB'),
  ('0c87e0bd-d116-4a77-a8bb-c1a7a2573e83', 'WIS'),
  ('0c87e0bd-d116-4a77-a8bb-c1a7a2573e83', 'IOWA'),
  ('0c87e0bd-d116-4a77-a8bb-c1a7a2573e83', 'MSU'),
  ('0c87e0bd-d116-4a77-a8bb-c1a7a2573e83', 'BYU'),
  ('0c87e0bd-d116-4a77-a8bb-c1a7a2573e83', 'COLO'),
  ('0c87e0bd-d116-4a77-a8bb-c1a7a2573e83', 'UVA'),
  ('0c87e0bd-d116-4a77-a8bb-c1a7a2573e83', 'FSU'),
  ('0c87e0bd-d116-4a77-a8bb-c1a7a2573e83', 'WYO'),
  ('60288ca9-33c3-4d70-b135-382fd55a1e9a', 'DEN'),
  ('a2137829-a74d-42a3-89e0-6ba0a6ad1549', 'OSU'),
  ('a2137829-a74d-42a3-89e0-6ba0a6ad1549', 'MICH'),
  ('a2137829-a74d-42a3-89e0-6ba0a6ad1549', 'BAMA'),
  ('a2137829-a74d-42a3-89e0-6ba0a6ad1549', 'UGA'),
  ('a2137829-a74d-42a3-89e0-6ba0a6ad1549', 'TEX'),
  ('a2137829-a74d-42a3-89e0-6ba0a6ad1549', 'LSU'),
  ('a2137829-a74d-42a3-89e0-6ba0a6ad1549', 'IND'),
  ('a2137829-a74d-42a3-89e0-6ba0a6ad1549', 'TENN'),
  ('a2137829-a74d-42a3-89e0-6ba0a6ad1549', 'FLA'),
  ('a2137829-a74d-42a3-89e0-6ba0a6ad1549', 'CLEM'),
  ('4f6dc4e6-c0fa-405a-bdbd-4fcbd47ba543', 'DEN'),
  ('4f6dc4e6-c0fa-405a-bdbd-4fcbd47ba543', 'PHX'),
  ('4f6dc4e6-c0fa-405a-bdbd-4fcbd47ba543', 'DAL'),
  ('4f6dc4e6-c0fa-405a-bdbd-4fcbd47ba543', 'TEX'),
  ('337b6109-4341-42d3-991d-0cb42d45b3b2', 'DEN'),
  ('b9acf598-0385-4455-b3c4-3b159b0a6b74', 'DAL'),
  ('45956c9d-b3c4-405c-bacb-a76bc4d29207', 'DEN'),
  ('8b0c6512-2b3e-4df5-8d97-2f34ef4019dc', 'DEN'),
  ('d705efcc-95f4-48fb-80f2-216d93827523', 'KL');
```

> ▶ **Run it. Confirm _Success_, then run the verify query below.**


**Verify moments (expect `60` moments, `206` team links):**

```sql
select
  (select count(*) from moments) as moments,
  (select count(*) from moment_teams) as team_links,
  (select count(*) from moments where not exists
     (select 1 from moment_teams mt where mt.moment_id = moments.id)) as brand_wide;
```

---

# Create the first two accounts (admin + viewer)

1. **Authentication → Users → Add user → Create new user** — email + password, **check "Auto Confirm User".** Do this twice (an admin email and a viewer email).
2. Link them to profiles with roles — paste, editing the two emails:

```sql
insert into profiles (id, email, full_name, role, active)
select id, email,
       case when email = 'ADMIN_EMAIL'  then 'Scott (admin)'
            when email = 'VIEWER_EMAIL' then 'Test viewer' end,
       case when email = 'ADMIN_EMAIL'  then 'admin'::user_role
            else 'viewer'::user_role end,
       true
from auth.users
where email in ('ADMIN_EMAIL', 'VIEWER_EMAIL')
on conflict (id) do update set role = excluded.role, active = excluded.active;
```

3. Get their ids for the RLS test (copy the two UUIDs):

```sql
select id, email, role from profiles order by role;
```

---

# The RLS viewer-rejection test — see the block with your own eyes

This runs **inside the database as the viewer** (it sets the viewer's identity,
so RLS applies exactly as it would for their login). Paste the viewer's UUID
where shown. Everything rolls back — nothing is written.

**A) Viewer CAN read (expect a number):**

```sql
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', '{"sub":"PASTE_VIEWER_ID"}', true);
  select count(*) as viewer_can_read_moments from moments;
rollback;
```

**B) Viewer CANNOT write — this MUST error (that's the proof):**

```sql
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', '{"sub":"PASTE_VIEWER_ID"}', true);
  insert into moments (date, title, type)
  values ('2026-08-01', '__RLS_TEST__', 'activation');
rollback;
```

Expected result — a red error:
`new row violates row-level security policy for table "moments"`.
If instead it says a row was inserted, **stop** — RLS did not apply; recheck Block 2.

**C) Admin CAN write (expect one returned row, then rolled back):**

```sql
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', '{"sub":"PASTE_ADMIN_ID"}', true);
  insert into moments (date, title, type)
  values ('2026-08-01', '__RLS_TEST__ (rolls back)', 'activation')
  returning id, title;
rollback;
```

**Bonus — a banned viewer can't even read.** Set the viewer inactive, re-run **A**
(it now returns 0), then set it back:

```sql
update profiles set active = false where email = 'VIEWER_EMAIL';
-- re-run test A → viewer_can_read_moments is now 0
update profiles set active = true  where email = 'VIEWER_EMAIL';
```

Once B errors and C succeeds, the database boundary is proven — hand out logins.
