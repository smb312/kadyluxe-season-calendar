-- add_bfcm.sql — BFCM promotion placeholders (ADDITIVE — does not wipe drops).
-- Run any time after the drops are seeded. Transactional; COMMIT->ROLLBACK to dry-run.
-- Thanksgiving 2026 = Nov 26, so Black Friday = Nov 27, Cyber Monday = Nov 30.
-- Campaign launches one week before Black Friday (Nov 20) with an "Up to X% off".

begin;

insert into moments (date, title, type, channels, product_note, notes) values
  ('2026-11-20', 'BFCM Early Access — Up to X% off', 'promo', '{paid,email,sms,banner}'::channel[],
   'Placeholder — set the discount', 'Launches one week before Black Friday. Fill in the offer (Up to X% off).'),
  ('2026-11-27', 'Black Friday — Up to X% off', 'promo', '{paid,email,sms,banner}'::channel[],
   'Placeholder — set the discount', null),
  ('2026-11-30', 'Cyber Monday — Up to X% off', 'promo', '{paid,email,sms,banner}'::channel[],
   'Placeholder — set the discount', null);

-- brand-wide (no team rows). verify:
select count(*) as bfcm_promos from moments where type='promo' and date between '2026-11-20' and '2026-11-30';

commit;
