import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import type { UserRole } from "@/lib/constants";

// Returns the signed-in user's profile (with role + active flag), or null.
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return (data as Profile | null) ?? null;
}

export function canWrite(role: UserRole | undefined | null): boolean {
  return role === "admin" || role === "editor";
}

export function isAdmin(role: UserRole | undefined | null): boolean {
  return role === "admin";
}
