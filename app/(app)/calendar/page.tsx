import { getMoments } from "@/lib/data";
import { CalendarView } from "@/components/calendar/calendar-view";

// The visual read. Moments fetched server-side, hydrated into the client grid.
export default async function CalendarPage() {
  const moments = await getMoments();
  return <CalendarView initialMoments={moments} />;
}
