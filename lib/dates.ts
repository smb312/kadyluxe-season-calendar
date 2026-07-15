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

export function ymd(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export interface DayCell {
  iso: string | null; // null = out-of-month padding
  day: number | null;
  weekend: boolean;
}

// Weeks (Sun–Sat) for a month, with leading/trailing padding cells so each
// week has exactly 7 columns.
export function buildMonthWeeks(y: number, m: number): DayCell[][] {
  const first = new Date(y, m, 1).getDay(); // 0 = Sunday
  const days = new Date(y, m + 1, 0).getDate();
  const cells: DayCell[] = [];
  for (let i = 0; i < first; i++) cells.push({ iso: null, day: null, weekend: false });
  for (let d = 1; d <= days; d++) {
    const dow = new Date(y, m, d).getDay();
    cells.push({ iso: ymd(y, m, d), day: d, weekend: dow === 0 || dow === 6 });
  }
  while (cells.length % 7 !== 0) cells.push({ iso: null, day: null, weekend: false });
  const weeks: DayCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
