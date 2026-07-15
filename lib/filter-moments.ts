import type { Moment } from "@/lib/types";
import type { Channel, MomentType } from "@/lib/constants";
import { TYPE_ORDER } from "@/lib/constants";

export interface FilterState {
  types: Set<MomentType>;
  channels: Set<Channel>;
  team: string;
  brandOnly: boolean;
}

// Shared by the list rows and CSV export so they can never disagree.
// Channel rule: a moment passes if it has an active channel OR no channels at
// all (so channel-less gates / brand-wide rows are never hidden by channel
// toggles). By default every channel is on, so this is a no-op until narrowed.
export function passesFilters(m: Moment, f: FilterState): boolean {
  if (!passesStructural(m, f)) return false;
  const channelOk = m.channels.length === 0 || m.channels.some((c) => f.channels.has(c));
  if (!channelOk) return false;
  return true;
}

// Structural filters only (type / team / brand-wide). The calendar removes on
// these but DIMS on channels rather than removing, so it filters structurally
// and applies the channel test separately via `isDimmed`.
export function passesStructural(m: Moment, f: FilterState): boolean {
  if (!f.types.has(m.type)) return false;
  if (f.brandOnly && m.teams.length > 0) return false;
  if (f.team && !m.teams.includes(f.team)) return false;
  return true;
}

// A moment is dimmed when it has channels but none are in the active set.
export function isDimmed(m: Moment, channels: Set<Channel>): boolean {
  if (m.channels.length === 0) return false;
  return !m.channels.some((c) => channels.has(c));
}

// Multi-day if it carries an end_date strictly after its start.
export function isBand(m: Moment): boolean {
  return !!m.end_date && m.end_date > m.date;
}

export type SortKey = "date" | "type" | "title" | "owner";

export function sortMoments(rows: Moment[], key: SortKey, dir: "asc" | "desc"): Moment[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    let x: string | number;
    let y: string | number;
    if (key === "type") {
      x = TYPE_ORDER[a.type];
      y = TYPE_ORDER[b.type];
    } else {
      x = (a[key] ?? "").toString().toLowerCase();
      y = (b[key] ?? "").toString().toLowerCase();
    }
    if (x < y) return -1 * sign;
    if (x > y) return 1 * sign;
    return a.date.localeCompare(b.date); // stable tiebreak by date
  });
}
