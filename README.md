# KADYLUXE Season Calendar

Shared marketing calendar for KADYLUXE's Aug–Dec 2026 football season. Standalone
Next.js (App Router) + Supabase (Postgres + Auth + RLS). Ports the single-file
HTML prototype into a collaboratively-editable app.

## Status

All build-order steps are implemented:

- **Schema + RLS + teams** — migrations, row-level security (reads and writes
  require an *active* profile, so deactivation actually revokes access), an audit
  trigger, and the 41-team registry. See `supabase/`.
- **Auth + accounts + admin** — email/password sign-in (no signup), middleware
  session gating, and an admin-only user-management page. Deactivate bans the
  auth user; delete removes it.
- **List view** — dense, inline-editable table with save-on-blur, add/delete,
  sort, month scope, URL-backed filters, moment editor drawer, filter-respecting
  CSV export.
- **Calendar view** — month grid with multi-day bands, channel-dim filtering,
  mobile agenda fallback.
- **Team view** — a team's whole season as a vertical timeline with cadence bars.
- **Realtime** — live updates on `moments`/`moment_teams` with self-echo
  suppression, in-progress-edit protection, and a "… updated this" indicator.
- **History** — per-moment "last changed by" line + expandable change log.
- **Inventory snapshot** — admin xlsx import (replace-on-upload) with a
  per-moment comparison panel that flags disagreements with the typed values.

Everything ships behind the same RLS boundary and shared URL filter state. See
`SETUP.md` to stand it up.

## Getting started

Everything an operator needs — creating the Supabase project, running the
migrations, seeding, creating the first accounts, and running the database-level
RLS test — is in **[SETUP.md](./SETUP.md)**.

Once `.env.local` is filled in:

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm typecheck
pnpm build
pnpm test:rls     # proves a viewer can't write, at the database
pnpm seed:moments # after exporting the prototype's JSON
```

## Design

House style is ported verbatim from the prototype: warm paper ground, Fraunces /
JetBrains Mono / Inter (self-hosted via `next/font`), zero border-radius except
chips, no shadows or gradients. Team color is the only chromatic element and
always comes from the data.
