// Date helpers. Moments are plain calendar dates (yyyy-mm-dd) with no timezone.
// We parse into a *local* Date to avoid the classic UTC off-by-one.

export function parseLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function pretty(iso: string): string {
  if (!iso) return "";
  return parseLocal(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function shortDate(iso: string): string {
  if (!iso) return "";
  return parseLocal(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// The "2026-08" month key for a given ISO date.
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}
