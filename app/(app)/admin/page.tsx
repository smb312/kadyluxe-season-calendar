import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { AdminClient } from "@/components/admin/admin-client";
import { InventoryImport } from "@/components/admin/inventory-import";

// Admin-only. Server guard (defense in depth — the API routes guard too).
export default async function AdminPage() {
  const profile = await getProfile();
  if (!profile || profile.role !== "admin") redirect("/list");
  return (
    <>
      <AdminClient currentUserId={profile.id} />
      <InventoryImport />
    </>
  );
}
