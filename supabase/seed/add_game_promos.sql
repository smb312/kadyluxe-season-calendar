-- add_game_promos.sql — game-tied promo placeholders (ADDITIVE, insert-only).
-- Transactional (COMMIT->ROLLBACK to dry-run). Run after the drops.
-- These are team-segmented promos tied to marquee national-TV games. They sit
-- ALONGSIDE the BFCM promos and the 12/25 Broncos activation already on those days.

begin;

with ins as (
  insert into moments (date, title, type, channels, product_note, notes) values
    ('2026-11-26', 'Cowboys Thanksgiving — promo (placeholder)', 'promo', '{paid,email,sms,banner}'::channel[],
     'Placeholder — set the offer', 'Cowboys play on Thanksgiving (day before Black Friday). Dallas-segmented promo.'),
    ('2026-11-27', 'Broncos Black Friday game — promo (placeholder)', 'promo', '{paid,email,sms,banner}'::channel[],
     'Placeholder — set the offer', 'Broncos at Pittsburgh on the NFL Black Friday game. Denver-segmented promo.'),
    ('2026-12-25', 'Broncos Christmas Day — promo (placeholder)', 'promo', '{paid,email,sms,banner}'::channel[],
     'Placeholder — set the offer', 'Broncos host Buffalo on Christmas Day. Denver-segmented promo.')
  returning id, title
)
insert into moment_teams (moment_id, team_code)
select id, case when title like 'Cowboys%' then 'DAL' else 'DEN' end
from ins;

-- verify (expect 3):
select count(*) as game_promos_added from moments where title like '%promo (placeholder)%';

commit;
