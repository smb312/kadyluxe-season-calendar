import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { USER_ROLES, type UserRole } from "@/lib/constants";

// Ban far into the future = effectively permanent, until reactivated.
const BAN_FOREVER = "876000h"; // ~100 years

// PATCH /api/admin/users/[id] — change role and/or active state (admin only).
// Body: { role?, active? }. Deactivation bans the auth user AND flips active,
// so a deactivated account can neither sign in nor read (RLS checks active).
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await context.params;

  let body: { role?: string; active?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: { role?: UserRole; active?: boolean } = {};
  if (body.role !== undefined) {
    if (!USER_ROLES.includes(body.role as UserRole))
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    patch.role = body.role as UserRole;
  }
  if (body.active !== undefined) {
    if (id === guard.profile.id && body.active === false)
      return NextResponse.json({ error: "You can't deactivate your own account" }, { status: 400 });
    patch.active = body.active;
  }
  if (Object.keys(patch).length === 0)
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const admin = createAdminClient();

  // Ban / unban the auth user when the active flag changes.
  if (patch.active !== undefined) {
    const { error: banErr } = await admin.auth.admin.updateUserById(id, {
      ban_duration: patch.active ? "none" : BAN_FOREVER,
    });
    if (banErr) return NextResponse.json({ error: banErr.message }, { status: 400 });
  }

  const { data, error } = await admin
    .from("profiles")
    .update(patch)
    .eq("id", id)
    .select("id, email, full_name, role, active, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ user: data });
}

// DELETE /api/admin/users/[id] — remove the auth user (profile cascades).
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await context.params;

  if (id === guard.profile.id)
    return NextResponse.json({ error: "You can't delete your own account" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
