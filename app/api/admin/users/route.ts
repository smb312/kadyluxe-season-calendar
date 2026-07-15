import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { USER_ROLES, type UserRole } from "@/lib/constants";

// GET /api/admin/users — list all users (admin only).
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, email, full_name, role, active, created_at")
    .order("role", { ascending: true })
    .order("email", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data });
}

// POST /api/admin/users — create a user (admin only).
// Body: { email, full_name?, role, password }
export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  let body: { email?: string; full_name?: string; role?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  const role = body.role as UserRole;
  const full_name = body.full_name?.trim() || null;

  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });
  if (password.length < 8)
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  if (!USER_ROLES.includes(role))
    return NextResponse.json({ error: "Role must be admin, editor, or viewer" }, { status: 400 });

  const admin = createAdminClient();

  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // no confirmation email; admin hands over the password
    user_metadata: { full_name },
  });
  if (authErr || !created.user) {
    return NextResponse.json({ error: authErr?.message ?? "Could not create auth user" }, { status: 400 });
  }

  const { data: profile, error: profErr } = await admin
    .from("profiles")
    .insert({ id: created.user.id, email, full_name, role, active: true })
    .select("id, email, full_name, role, active, created_at")
    .single();

  if (profErr) {
    // Roll back the auth user so we don't leave an orphan with no profile.
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: `Profile creation failed: ${profErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ user: profile }, { status: 201 });
}
