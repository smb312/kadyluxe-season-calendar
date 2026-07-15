"use client";

import { useApp } from "@/components/app-context";
import { useFilters } from "@/lib/use-filters";
import {
  CHANNELS,
  MOMENT_TYPES,
  CHANNEL_LABEL,
  TYPE_LABEL,
  LEAGUE_ORDER,
  LEAGUE_LABEL,
  type Channel,
} from "@/lib/constants";

const CH_COLOR: Record<Channel, string> = {
  paid: "#1D4ED8",
  email: "#047857",
  sms: "#6D28D9",
  banner: "#B45309",
};

const TYPE_CHIP_LABEL: Record<string, string> = {
  drop: "Product drop",
  promo: "Promotion",
  activation: "Activation",
  game: "Game / season",
  gate: "Gate / deadline",
};

export function FilterBar() {
  const { teams } = useApp();
  const f = useFilters();

  // Group teams by league for the select, in league order then sort_order.
  const leagues = [...new Set(teams.map((t) => t.league))].sort(
    (a, b) => (LEAGUE_ORDER[a] ?? 9) - (LEAGUE_ORDER[b] ?? 9),
  );

  const chipBase =
    "inline-flex items-center gap-1.5 border px-2.5 py-1 text-[11px] font-semibold tracking-[0.02em] rounded-chip transition-colors";

  return (
    <div className="flex gap-6 items-center flex-wrap py-3 border-b border-rule mb-4">
      {/* Channels */}
      <div className="flex gap-2 items-center flex-wrap">
        <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-ink-38 mr-0.5">
          Channels
        </span>
        {CHANNELS.map((c) => {
          const on = f.isChannelOn(c);
          return (
            <button
              key={c}
              onClick={() => f.toggleChannel(c)}
              className={chipBase}
              style={
                on
                  ? { background: CH_COLOR[c], color: "#F4F1EA", borderColor: "transparent" }
                  : { color: "var(--ink-60)", borderColor: "var(--rule)" }
              }
            >
              <span
                className="w-[7px] h-[7px] rounded-full"
                style={{ background: on ? "#F4F1EA" : CH_COLOR[c] }}
              />
              {CHANNEL_LABEL[c]}
            </button>
          );
        })}
      </div>

      {/* Team */}
      <div className="flex gap-2 items-center flex-wrap">
        <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-ink-38 mr-0.5">
          Team
        </span>
        <select
          value={f.team}
          onChange={(e) => f.setTeam(e.target.value)}
          className="px-2.5 py-1.5 border border-ink bg-transparent font-mono text-[11px] tracking-[0.05em] uppercase text-ink"
        >
          <option value="">All teams</option>
          {leagues.map((lg) => (
            <optgroup key={lg} label={LEAGUE_LABEL[lg] ?? lg}>
              {teams
                .filter((t) => t.league === lg)
                .map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        <button
          onClick={() => f.setBrandOnly(!f.brandOnly)}
          className={chipBase}
          style={
            f.brandOnly
              ? { background: "var(--ink)", color: "#F4F1EA", borderColor: "transparent" }
              : { color: "var(--ink-60)", borderColor: "var(--rule)" }
          }
        >
          Brand-wide only
        </button>
      </div>

      {/* Type */}
      <div className="flex gap-2 items-center flex-wrap">
        <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-ink-38 mr-0.5">
          Type
        </span>
        {MOMENT_TYPES.map((t) => {
          const on = f.isTypeOn(t);
          return (
            <button
              key={t}
              onClick={() => f.toggleType(t)}
              className={chipBase}
              style={
                on
                  ? { background: "var(--ink)", color: "#F4F1EA", borderColor: "transparent" }
                  : { color: "var(--ink-60)", borderColor: "var(--rule)" }
              }
              title={TYPE_LABEL[t]}
            >
              {TYPE_CHIP_LABEL[t]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
