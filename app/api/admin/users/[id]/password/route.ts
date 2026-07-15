import { NextResponse } from "next/server";
import { requireAdmin, generatePassword } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/admin/users/[id]/password — reset a user's password (admin only).
// Generates a new starting password, sets it, and returns it ONCE to hand over.
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await context.params;

  const password = generatePassword();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id, { password });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Returned once; not stored anywhere. Admin copies it and hands it over.
  return NextResponse.json({ password });
}
