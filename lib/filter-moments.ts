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
  if (!f.types.has(m.type)) return false;
  if (f.brandOnly && m.teams.length > 0) return false;
  if (f.team && !m.teams.includes(f.team)) return false;
  const channelOk = m.channels.length === 0 || m.channels.some((c) => f.channels.has(c));
  if (!channelOk) return false;
  return true;
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
