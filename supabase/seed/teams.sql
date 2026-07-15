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
