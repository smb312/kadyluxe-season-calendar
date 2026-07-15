# SETUP — KADYLUXE Season Calendar

A runbook you run yourself. No keys leave your hands. Follow it top to bottom.
Every SQL block is in `supabase/migrations/` or `supabase/seed/`; every "click"
is spelled out. Budget ~20 minutes.

Legend: **[Dashboard]** = the Supabase web UI · **[SQL]** = SQL Editor · **[Local]** = your terminal.

---

## 0. Prerequisites

- Node 20+ and `pnpm` installed.
- A Supabase account.
- `pnpm install` already run in this repo.

---

## 1. Create the Supabase project — **[Dashboard]**

1. supabase.com → **New project**. Name it `kadyluxe-season-calendar`. Pick a
   region close to the team. Set a strong database password and save it.
2. Wait for provisioning (~2 min).

## 2. Lock down auth — **[Dashboard]**

This app has **no signup**. Turn public registration off before anything else.

1. **Authentication → Providers → Email**: ensure **Email** is enabled.
   Turn **Confirm email** OFF (admin sets passwords; there's no email round-trip).
2. **Authentication → Providers**: confirm every other provider (Google, magic
   link, phone, etc.) is **disabled**.
3. **Authentication → Sign In / Providers → "Allow new users to sign up"**:
   turn this **OFF**. (Also called *Disable signup*.) This is the switch that
   makes the whole app invite-only.

## 3. Get your keys — **[Dashboard] → [Local]**

1. **Project Settings → API**. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (server-only; never commit)
2. `cp .env.local.example .env.local` and paste the three values in.

## 4. Run the migrations — **[SQL]**

Open **SQL Editor → New query**. Run each file's contents **in order**, one at a
time (paste, Run, confirm success, next):

1. `supabase/migrations/0001_schema.sql` — tables + enums
2. `supabase/migrations/0002_rls.sql` — row-level security + helpers
3. `supabase/migrations/0003_history_trigger.sql` — audit trail + stamping
4. `supabase/migrations/0004_realtime_directory.sql` — member directory read + Realtime
5. `supabase/migrations/0005_inventory.sql` — inventory snapshot table

Then seed the team registry:

6. `supabase/seed/teams.sql` — the 41 teams

Sanity check (should return **41**):

```sql
select count(*) from teams;
```

---

## 5. Create the first two accounts — **[Dashboard] + [SQL]**

You need one **admin** and one **viewer** to run the RLS test (step 6) and to
bootstrap everyone else. There is no signup, so the very first accounts are made
by hand here. (After this, the in-app **Admin** page is how accounts get made —
see step 8.)

For **each** of the two accounts:

1. **Authentication → Users → Add user → Create new user.**
   - Email + a starting password.
   - **Check "Auto Confirm User".**
2. Note which email is the admin and which is the viewer.

Then link both to profiles with the right roles — **[SQL]**:

```sql
-- See the user ids you just created:
select id, email from auth.users order by created_at;

-- Insert a profile per user. Replace the emails with the ones you used.
insert into profiles (id, email, full_name, role, active)
select id, email,
       case when email = 'ADMIN_EMAIL_HERE'  then 'Scott (admin)'
            when email = 'VIEWER_EMAIL_HERE' then 'Test viewer' end,
       case when email = 'ADMIN_EMAIL_HERE'  then 'admin'::user_role
            else 'viewer'::user_role end,
       true
from auth.users
where email in ('ADMIN_EMAIL_HERE', 'VIEWER_EMAIL_HERE')
on conflict (id) do update set role = excluded.role, active = excluded.active;
```

Confirm (should show one `admin` and one `viewer`):

```sql
select email, role, active from profiles order by role;
```

Put both accounts' credentials into `.env.local`:
`TEST_ADMIN_EMAIL/PASSWORD` and `TEST_VIEWER_EMAIL/PASSWORD`.

---

## 6. Run the RLS viewer-rejection test — **[Local]**  ← run it NOW, here

Do this **after step 5** (both accounts exist) and **before** trusting any UI.
It signs in with the anon key so RLS fully applies, and proves at the database
that a viewer can read but cannot write:

```bash
pnpm test:rls
```

Expected: `✓ PASS`. It asserts a viewer can read, a viewer's insert/update/
delete/team-assign are all rejected, and an admin can insert (then cleans up).
If it fails, **stop** — re-check that 0002_rls.sql ran and the viewer's profile
`role = 'viewer'`, `active = true`. Do not build UI on a broken boundary.

> Bonus check — the "banned user can't read" guarantee. Set the viewer's
> `active` to false (`update profiles set active=false where email='VIEWER_EMAIL'`),
> re-run `pnpm test:rls`; the "viewer can read" assertion now fails as intended
> (an inactive profile reads nothing). Set it back to `true` afterward. In
> production, deactivation from the Admin page also bans the auth user, so they
> can't even get a session.

---

## 7. Seed the moments — **[Local]** (after you send me the exported JSON)

Export the calendar from the prototype (**Export JSON** button) and save the
file to `supabase/seed/kadyluxe_season_calendar.json` (gitignored). Then:

```bash
pnpm seed:moments
# re-import from scratch later with:  FORCE=1 pnpm seed:moments
```

It imports every row as a single-day moment (no `end_date` guessed), maps
`meta → product_note`, defaults licensing to `na`, and reports how many are
brand-wide. Unknown teams/channels are skipped with a warning, not a crash.

---

## 8. Run the app — **[Local]**

```bash
pnpm dev      # http://localhost:3000
```

Sign in as the admin. The **Admin** page (admin-only) is where you create the
remaining ~7 real accounts (Haley, Savannah, Kady as `editor`; Matt, Homestead,
Eric as `viewer`), reset passwords, change roles, and deactivate/delete people.
Deactivation bans the auth user *and* flips `active=false`, so offboarding is
real, not cosmetic.

**Realtime** works once 0004 has run and the tables are in the
`supabase_realtime` publication (the migration adds them). Two editors in the
list at once will see each other's changes land with a small "… updated this"
indicator. No dashboard toggle is required beyond the migration.

## 8a. Inventory snapshot import — **[App, admin]** (optional, do last)

On the **Admin** page, the **Inventory snapshot** panel takes the
`tracking_fall_*.xlsx` export. Each upload **replaces** the snapshot. It never
changes a moment — it shows the real licensing/warehouse values on each
moment's editor (matched by team) and flags where they disagree with what was
typed. The importer maps columns by header name; after your first import it
reports which columns it mapped and which it ignored, so if your headers differ
from the defaults, send me that list and I'll widen the aliases.

---

## 9. Deploy — **[Vercel]** (later)

Import the repo in Vercel. Add the same three env vars
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`) in **Project → Settings → Environment Variables**.
The service-role key stays server-side (used only by the admin API routes).

---

### Migration order, at a glance

| Step | File | What |
|---|---|---|
| 4.1 | `migrations/0001_schema.sql` | tables + enums |
| 4.2 | `migrations/0002_rls.sql` | RLS + `is_active_user()` / `current_role_is()` |
| 4.3 | `migrations/0003_history_trigger.sql` | audit trigger + stamping |
| 4.4 | `migrations/0004_realtime_directory.sql` | member directory read + Realtime |
| 4.5 | `migrations/0005_inventory.sql` | inventory snapshot table |
| 4.6 | `seed/teams.sql` | 41 teams |
| 6 | `pnpm test:rls` | **prove the boundary** |
| 7 | `pnpm seed:moments` | import moments (after you send the JSON) |
| 8a | Admin → Inventory snapshot | upload `tracking_fall_*.xlsx` (optional) |
