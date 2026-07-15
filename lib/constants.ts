// Fixed domain vocabulary. These mirror the Postgres enums exactly.

export const CHANNELS = ["paid", "email", "sms", "banner"] as const;
export type Channel = (typeof CHANNELS)[number];

export const MOMENT_TYPES = [
  "drop",
  "promo",
  "activation",
  "game",
  "gate",
] as const;
export type MomentType = (typeof MOMENT_TYPES)[number];

export const LIC_STATUSES = ["approved", "pending", "na"] as const;
export type LicStatus = (typeof LIC_STATUSES)[number];

export const USER_ROLES = ["admin", "editor", "viewer"] as const;
export type UserRole = (typeof USER_ROLES)[number];

// Labels used in the UI (matches the prototype's TYPE_LABEL).
export const TYPE_LABEL: Record<MomentType, string> = {
  drop: "Drop",
  promo: "Promo",
  activation: "Activation",
  game: "Season",
  gate: "Gate",
};

export const CHANNEL_LABEL: Record<Channel, string> = {
  paid: "Paid · FB/Google",
  email: "Email",
  sms: "SMS",
  banner: "Site banner",
};

// Season window: August–December 2026. `m` is a 0-based month index.
export const MONTHS = [
  { y: 2026, m: 7, key: "2026-08", label: "August" },
  { y: 2026, m: 8, key: "2026-09", label: "September" },
  { y: 2026, m: 9, key: "2026-10", label: "October" },
  { y: 2026, m: 10, key: "2026-11", label: "November" },
  { y: 2026, m: 11, key: "2026-12", label: "December" },
] as const;

export const SEASON_MIN = "2026-08-01";
export const SEASON_MAX = "2026-12-31";

// Type sort order for the list view (drop first … gate last).
export const TYPE_ORDER: Record<MomentType, number> = {
  drop: 0,
  promo: 1,
  activation: 2,
  game: 3,
  gate: 4,
};

// League grouping order used in team pickers/filters.
export const LEAGUE_ORDER: Record<string, number> = {
  NFL: 0,
  Pro: 1,
  CFB: 2,
  Affinity: 3,
  Core: 4,
};

export const LEAGUE_LABEL: Record<string, string> = {
  NFL: "NFL",
  Pro: "Pro (NBA/NHL)",
  CFB: "College",
  Affinity: "Affinity",
  Core: "Non-IP",
};
