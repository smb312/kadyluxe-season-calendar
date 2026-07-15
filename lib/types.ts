import type { Channel, LicStatus, MomentType, UserRole } from "./constants";

// Row shapes matching the Postgres schema (supabase/migrations).
// Hand-written rather than ORM-generated, per the "no ORM" decision.

export interface Team {
  code: string;
  name: string;
  color: string; // hex, e.g. '#FB4F14'
  league: string; // 'NFL' | 'Pro' | 'CFB' | 'Affinity' | 'Core'
  tier: number | null;
  active: boolean;
  sort_order: number;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  active: boolean;
  created_at: string;
}

export interface MomentRow {
  id: string;
  date: string; // ISO date (yyyy-mm-dd)
  end_date: string | null;
  title: string;
  type: MomentType;
  channels: Channel[];
  product_note: string | null;
  owner: string | null;
  notes: string | null;
  licensing: LicStatus;
  warehouse_date: string | null;
  blocked: boolean;
  blocked_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
}

// A moment joined with its team codes, the shape the UI works with.
export interface Moment extends MomentRow {
  teams: string[]; // team codes
}

export interface MomentHistory {
  id: number;
  moment_id: string;
  actor_id: string | null;
  action: "created" | "updated" | "deleted";
  diff: Record<string, [unknown, unknown]> | null;
  at: string;
}

// Fields an editor can write through the UI.
export type MomentInput = Pick<
  MomentRow,
  | "date"
  | "end_date"
  | "title"
  | "type"
  | "channels"
  | "product_note"
  | "owner"
  | "notes"
  | "licensing"
  | "warehouse_date"
  | "blocked"
  | "blocked_reason"
> & { teams: string[] };
