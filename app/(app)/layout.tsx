import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { getTeams, getDirectory } from "@/lib/data";
import { AppProvider } from "@/components/app-context";
import { AppShell } from "@/components/app-shell";

// Authenticated shell. Middleware already gates unauthenticated access; this is
// the second guard and the place we load the profile + team registry once.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!profile.active) {
    // Deactivated between requests — send them out.
    redirect("/login");
  }

  const [teams, directory] = await Promise.all([getTeams(), getDirectory()]);

  return (
    <AppProvider profile={profile} teams={teams} directory={directory}>
      <AppShell>{children}</AppShell>
    </AppProvider>
  );
}
