import "server-only";
import { getProfile } from "@/lib/auth";
import type { Profile } from "@/lib/types";

// Guard for admin-only API routes. Returns the caller's profile if they are an
// active admin, otherwise a NextResponse-ready error payload. The check runs
// server-side against the DB (not a client claim) before any service-role use.
export async function requireAdmin(): Promise<
  { ok: true; profile: Profile } | { ok: false; status: number; error: string }
> {
  const profile = await getProfile();
  if (!profile) return { ok: false, status: 401, error: "Not signed in" };
  if (!profile.active) return { ok: false, status: 403, error: "Account is deactivated" };
  if (profile.role !== "admin") return { ok: false, status: 403, error: "Admins only" };
  return { ok: true, profile };
}

// A readable starting password to hand over (no ambiguous chars).
export function generatePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint32Array(14);
  crypto.getRandomValues(bytes);
  const body = Array.from(bytes, (n) => alphabet[n % alphabet.length]).join("");
  // Group for legibility: e.g. "Kx7m-Pq93-Rt5n-Wb"
  return body.replace(/(.{4})(?=.)/g, "$1-");
}
