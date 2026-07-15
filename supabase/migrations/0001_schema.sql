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
