"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { MomentInput, MomentRow } from "@/lib/types";

// Client-side writes via the Supabase client directly (no ORM). RLS is the real
// guard — a viewer's write is rejected at the database even if a control leaks.

export async function updateMomentField(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<MomentRow>,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("moments").update(patch).eq("id", id);
  return { error: error?.message ?? null };
}

export async function createMoment(
  supabase: SupabaseClient,
  input: MomentInput,
): Promise<{ id: string | null; error: string | null }> {
  const { teams, ...row } = input;
  const { data, error } = await supabase.from("moments").insert(row).select("id").single();
  if (error || !data) return { id: null, error: error?.message ?? "Insert failed" };
  const id = data.id as string;
  if (teams.length) {
    const { error: tErr } = await supabase
      .from("moment_teams")
      .insert(teams.map((team_code) => ({ moment_id: id, team_code })));
    if (tErr) return { id, error: tErr.message };
  }
  return { id, error: null };
}

export async function saveMoment(
  supabase: SupabaseClient,
  id: string,
  input: MomentInput,
): Promise<{ error: string | null }> {
  const { teams, ...row } = input;
  const { error } = await supabase.from("moments").update(row).eq("id", id);
  if (error) return { error: error.message };
  return setMomentTeams(supabase, id, teams);
}

// Replace a moment's team set (delete-all + insert). moment_teams isn't audited.
export async function setMomentTeams(
  supabase: SupabaseClient,
  id: string,
  teamCodes: string[],
): Promise<{ error: string | null }> {
  const { error: delErr } = await supabase.from("moment_teams").delete().eq("moment_id", id);
  if (delErr) return { error: delErr.message };
  if (teamCodes.length) {
    const { error: insErr } = await supabase
      .from("moment_teams")
      .insert(teamCodes.map((team_code) => ({ moment_id: id, team_code })));
    if (insErr) return { error: insErr.message };
  }
  return { error: null };
}

export async function deleteMoment(
  supabase: SupabaseClient,
  id: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("moments").delete().eq("id", id);
  return { error: error?.message ?? null };
}
