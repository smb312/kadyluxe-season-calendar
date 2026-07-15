/**
 * rls.test.ts — proves the security boundary at the DATABASE, not the UI.
 *
 * Run this AFTER you have created the first two accounts (one admin, one
 * viewer) per SETUP.md, and filled TEST_* creds in .env.local:
 *
 *   pnpm test:rls
 *
 * It signs in with the ANON key (so RLS fully applies) as each user and asserts:
 *   - a viewer CAN read moments
 *   - a viewer CANNOT insert / update / delete moments or assign teams
 *   - an admin CAN insert (then cleans up)
 *
 * Exit code is non-zero if any assertion fails.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${detail ? `  — ${detail}` : ""}`);
  }
}

async function signIn(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(url!, anon!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    console.error(`\n✗ Could not sign in as ${email}: ${error.message}`);
    console.error("  Create the account (SETUP.md Phase 2) and set TEST_* creds in .env.local.\n");
    process.exit(1);
  }
  return client;
}

function sampleMoment() {
  return {
    date: "2026-08-01",
    title: "__RLS_TEST__ (safe to delete)",
    type: "activation",
    channels: [],
  };
}

async function main() {
  if (!url || !anon) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
    process.exit(1);
  }
  const admin = {
    email: process.env.TEST_ADMIN_EMAIL,
    password: process.env.TEST_ADMIN_PASSWORD,
  };
  const viewer = {
    email: process.env.TEST_VIEWER_EMAIL,
    password: process.env.TEST_VIEWER_PASSWORD,
  };
  if (!admin.email || !admin.password || !viewer.email || !viewer.password) {
    console.error("Set TEST_ADMIN_* and TEST_VIEWER_* in .env.local first.");
    process.exit(1);
  }

  // ---- VIEWER ----
  console.log("\nViewer (should read, must not write):");
  const v = await signIn(viewer.email, viewer.password);

  const read = await v.from("moments").select("id").limit(1);
  check("viewer can read moments", read.error === null, read.error?.message);

  const vInsert = await v.from("moments").insert(sampleMoment()).select("id");
  check(
    "viewer INSERT into moments is rejected",
    vInsert.error !== null || (vInsert.data?.length ?? 0) === 0,
    vInsert.error ? "" : "insert unexpectedly succeeded",
  );
  // If it somehow inserted, clean it up with the admin later via title match.

  const existingId = read.data?.[0]?.id as string | undefined;
  if (existingId) {
    const vUpdate = await v.from("moments").update({ title: "__HACKED__" }).eq("id", existingId).select("id");
    check(
      "viewer UPDATE of a moment affects no rows",
      (vUpdate.data?.length ?? 0) === 0,
      vUpdate.error ? vUpdate.error.message : "update unexpectedly changed a row",
    );

    const vDelete = await v.from("moments").delete().eq("id", existingId).select("id");
    check(
      "viewer DELETE of a moment affects no rows",
      (vDelete.data?.length ?? 0) === 0,
      "delete unexpectedly removed a row",
    );

    const vTeam = await v.from("moment_teams").insert({ moment_id: existingId, team_code: "DEN" }).select();
    check(
      "viewer INSERT into moment_teams is rejected",
      vTeam.error !== null || (vTeam.data?.length ?? 0) === 0,
      vTeam.error ? "" : "team assignment unexpectedly succeeded",
    );
  } else {
    console.log("  (no existing moment to test update/delete against — seed first for full coverage)");
  }

  // ---- ADMIN ----
  console.log("\nAdmin (should write):");
  const a = await signIn(admin.email, admin.password);

  const aInsert = await a.from("moments").insert(sampleMoment()).select("id");
  const newId = aInsert.data?.[0]?.id as string | undefined;
  check("admin INSERT into moments succeeds", aInsert.error === null && !!newId, aInsert.error?.message);

  // cleanup — remove any test rows this run (or a stray viewer insert) created.
  const cleanup = await a.from("moments").delete().eq("title", "__RLS_TEST__ (safe to delete)").select("id");
  check("admin cleanup removed the test row(s)", (cleanup.data?.length ?? 0) >= 1, "nothing cleaned up");

  console.log(`\n${failed === 0 ? "✓ PASS" : "✗ FAIL"} — ${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
