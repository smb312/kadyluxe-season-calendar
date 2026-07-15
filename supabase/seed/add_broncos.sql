-- add_broncos.sql — Broncos preseason spots + home-game activations (ADDITIVE).
-- Insert-only; does not wipe drops/BFCM. Transactional (COMMIT->ROLLBACK to dry-run).
-- Home games = Broncos listed on the bottom of the schedule. The Jan 10, 2027
-- home game vs the Chargers is outside the Aug–Dec calendar window, so it's omitted.
-- Every row here is Broncos-tagged, so team links are added in one pass.

begin;

with ins as (
  insert into moments (date, title, type, channels, product_note, notes) values
    -- Preseason: one 30-second broadcast spot per game (tagged as promotion)
    ('2026-08-14', 'Broncos preseason @ Atlanta — 30s spot', 'promo', '{}'::channel[],
     '30-second broadcast spot', 'Away vs Atlanta Falcons · Fri 5:00 PM MT. One 30-second spot.'),
    ('2026-08-21', 'Broncos preseason vs Green Bay — 30s spot', 'promo', '{}'::channel[],
     '30-second broadcast spot', 'Home vs Green Bay Packers · Fri 7:00 PM MT. One 30-second spot.'),
    ('2026-08-28', 'Broncos preseason vs Minnesota — 30s spot', 'promo', '{}'::channel[],
     '30-second broadcast spot', 'Home vs Minnesota Vikings · Fri 7:00 PM MT. One 30-second spot.'),
    -- Home-game stadium activations (an event at every home game)
    ('2026-09-20', 'Launch Party — Broncos Home Opener vs Jaguars', 'activation', '{paid,email,sms,banner}'::channel[],
     'Flagship stadium activation', 'Home opener vs Jacksonville. Our big Launch Party event.'),
    ('2026-09-27', 'Broncos home game vs Rams — stadium activation', 'activation', '{email,banner}'::channel[],
     'Stadium event', null),
    ('2026-10-15', 'Broncos home game vs Seahawks — stadium activation', 'activation', '{email,banner}'::channel[],
     'Stadium event', 'Thursday night home game.'),
    ('2026-11-01', 'Broncos home game vs Chiefs — stadium activation', 'activation', '{email,banner}'::channel[],
     'Stadium event', null),
    ('2026-11-22', 'Broncos home game vs Raiders — stadium activation', 'activation', '{email,banner}'::channel[],
     'Stadium event', null),
    ('2026-12-06', 'Broncos home game vs Dolphins — stadium activation', 'activation', '{email,banner}'::channel[],
     'Stadium event', null),
    ('2026-12-25', 'Broncos home game vs Bills — stadium activation', 'activation', '{email,banner}'::channel[],
     'Stadium event', 'Christmas Day home game — big media moment.')
  returning id
)
insert into moment_teams (moment_id, team_code)
select id, 'DEN' from ins;

-- verify (expect 10: 3 preseason promos + 1 Launch Party + 6 home-game activations):
select count(*) as broncos_added
from moments
where title like 'Broncos preseason%'
   or title like 'Broncos home game%'
   or title like 'Launch Party%';

commit;
