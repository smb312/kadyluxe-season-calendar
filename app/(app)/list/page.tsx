import { getMoments } from "@/lib/data";
import { ListView } from "@/components/list/list-view";

// The workhorse view. Moments are fetched server-side and hydrated into the
// client table; teams come from the app context (loaded in the layout).
export default async function ListPage() {
  const moments = await getMoments();
  return <ListView initialMoments={moments} />;
}
