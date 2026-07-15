# KADYLUXE Season Calendar

Shared marketing calendar for KADYLUXE's Aug–Dec 2026 football season. Standalone
Next.js (App Router) + Supabase (Postgres + Auth + RLS). Ports the single-file
HTML prototype into a collaboratively-editable app.

## Status

Built through the first shippable slice (build order steps 1–3):

- **Schema + RLS + teams** — migrations, row-level security (reads and writes
  require an *active* profile, so deactivation actually revokes access), an audit
  trigger, and the 41-team registry. See `supabase/`.
- **Auth + accounts + admin** — email/password sign-in (no signup), middleware
  session gating, and an admin-only user-management page. Deactivate bans the
  auth user; delete removes it.
- **List view** — the dense, inline-editable table with save-on-blur, add/delete,
  sort, month scope, URL-backed filters, the shared moment editor drawer, and
  filter-respecting CSV export.

Not yet built (deliberately paused for review): Calendar view, Team view,
Realtime, history UI, inventory-snapshot import.

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
