/**
 * seed-moments.ts — one-shot import of the prototype's exported moments.
 *
 * Usage:
 *   pnpm seed:moments <path-to-export.json>      (defaults to the file below)
 *   FORCE=1 pnpm seed:moments <path>             (wipe moments first, then insert)
 *
 * Reads the JSON exported by the prototype's "Export JSON" button and inserts
 * into `moments` + `moment_teams`. Imports FAITHFULLY as single-day rows — no
 * end_date is inferred (multi-day ranges are confirmed by hand later). Manual
 * status fields default to na / null / false.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in .env.local.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { CHANNELS, MOMENT_TYPES, SEASON_MIN, SEASON_MAX } from "../../lib/constants";

config({ path: ".env.local" });

const DEFAULT_FILE = "supabase/seed/kadyluxe_season_calendar.json";

// The prototype's exported record shape.
interface ExportedMoment {
  id?: string;
  date: string;
  title: string;
  type?: string;
  channels?: string[];
  teams?: string[];
  meta?: string;
  owner?: string;
  notes?: string;
}

function fail(msg: string): never {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    fail("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }

  const file = resolve(process.argv[2] ?? DEFAULT_FILE);
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    fail(
      `Could not read ${file}\n  Export the JSON from the prototype and save it there, ` +
        `or pass a path: pnpm seed:moments path/to/export.json`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    fail(`${file} is not valid JSON`);
  }
  if (!Array.isArray(parsed)) fail(`${file} must be a JSON array of moments`);
  const input = parsed as ExportedMoment[];

  const supabase = createClient(url!, key!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Known team codes — used to validate assignments (FK would reject bad ones).
  const { data: teamRows, error: teamErr } = await supabase.from("teams").select("code");
  if (teamErr) fail(`Could not read teams: ${teamErr.message}. Did you run teams.sql first?`);
  const knownTeams = new Set((teamRows ?? []).map((t) => t.code));
  if (knownTeams.size === 0) fail("No teams found. Run supabase/seed/teams.sql before seeding moments.");

  // Guard against double-seeding.
  const { count } = await supabase.from("moments").select("id", { count: "exact", head: true });
  if ((count ?? 0) > 0) {
    if (process.env.FORCE !== "1") {
      fail(
        `moments already has ${count} rows. Re-run with FORCE=1 to wipe and re-import:\n` +
          `  FORCE=1 pnpm seed:moments ${process.argv[2] ?? ""}`.trimEnd(),
      );
    }
    console.log(`FORCE=1 — deleting ${count} existing moments…`);
    const { error } = await supabase.from("moments").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) fail(`Failed to clear moments: ${error.message}`);
  }

  // Build rows with fresh uuids so moment_teams can reference them.
  const momentRows: Record<string, unknown>[] = [];
  const teamRowsToInsert: { moment_id: string; team_code: string }[] = [];
  const warnings: string[] = [];

  input.forEach((m, i) => {
    if (!m.date || !m.title) {
      warnings.push(`row ${i}: missing date or title — skipped`);
      return;
    }
    const type = (m.type && (MOMENT_TYPES as readonly string[]).includes(m.type) ? m.type : "activation");
    if (m.type && type !== m.type) warnings.push(`row ${i} (${m.title}): unknown type "${m.type}" → activation`);

    const channels = (m.channels ?? []).filter((c) => (CHANNELS as readonly string[]).includes(c));
    const droppedCh = (m.channels ?? []).filter((c) => !(CHANNELS as readonly string[]).includes(c));
    if (droppedCh.length) warnings.push(`row ${i} (${m.title}): unknown channels ${droppedCh.join(", ")} dropped`);

    if (m.date < SEASON_MIN || m.date > SEASON_MAX)
      warnings.push(`row ${i} (${m.title}): date ${m.date} is outside the season window`);

    const id = randomUUID();
    momentRows.push({
      id,
      date: m.date,
      end_date: null, // import faithfully; ranges confirmed by hand later
      title: m.title,
      type,
      channels,
      product_note: m.meta?.trim() || null,
      owner: m.owner?.trim() || null,
      notes: m.notes?.trim() || null,
      licensing: "na",
      warehouse_date: null,
      blocked: false,
      blocked_reason: null,
    });

    (m.teams ?? []).forEach((code) => {
      if (!knownTeams.has(code)) {
        warnings.push(`row ${i} (${m.title}): unknown team "${code}" skipped`);
        return;
      }
      teamRowsToInsert.push({ moment_id: id, team_code: code });
    });
  });

  const { error: mErr } = await supabase.from("moments").insert(momentRows);
  if (mErr) fail(`Insert moments failed: ${mErr.message}`);

  if (teamRowsToInsert.length) {
    const { error: tErr } = await supabase.from("moment_teams").insert(teamRowsToInsert);
    if (tErr) fail(`Insert moment_teams failed: ${tErr.message}`);
  }

  console.log(`\n✓ Seeded ${momentRows.length} moments and ${teamRowsToInsert.length} team assignments.`);
  const brandWide = momentRows.filter((r) => !teamRowsToInsert.some((t) => t.moment_id === r.id)).length;
  console.log(`  ${brandWide} are brand-wide (no team).`);
  if (warnings.length) {
    console.log(`\n⚠ ${warnings.length} warning(s):`);
    warnings.forEach((w) => console.log(`  - ${w}`));
  }
}

main();
