import { getMoments } from "@/lib/data";
import { TeamView } from "@/components/team/team-view";

// New view (not in the prototype). The team is chosen via the shared filter,
// so a team timeline is a shareable link (?team=DAL).
export default async function TeamPage() {
  const moments = await getMoments();
  return <TeamView initialMoments={moments} />;
}
