import { createClient } from "@/lib/supabase/server";
import type { MemberDirectory, Moment, MomentRow, Team } from "@/lib/types";

// Server-side reads. RLS still applies (these run as the signed-in user).

// id -> display name. Before migration 0004 broadens profile reads, RLS returns
// only the caller's own row, so this degrades to just the current user.
export async function getDirectory(): Promise<MemberDirectory> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name, email");
  const dir: MemberDirectory = {};
  for (const p of data ?? []) dir[p.id] = p.full_name || p.email;
  return dir;
}

export async function getTeams(): Promise<Team[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("teams")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`getTeams: ${error.message}`);
  return (data as Team[]) ?? [];
}

type MomentWithJoin = MomentRow & { moment_teams: { team_code: string }[] };

export async function getMoments(): Promise<Moment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("moments")
    .select("*, moment_teams(team_code)")
    .order("date", { ascending: true });
  if (error) throw new Error(`getMoments: ${error.message}`);

  return ((data as MomentWithJoin[]) ?? []).map(({ moment_teams, ...m }) => ({
    ...m,
    teams: moment_teams.map((t) => t.team_code),
  }));
}
