"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/components/app-context";
import { useFilters } from "@/lib/use-filters";
import { isDimmed } from "@/lib/filter-moments";
import { pretty, monthKey } from "@/lib/dates";
import { CHANNELS, MONTHS, TYPE_LABEL, type Channel } from "@/lib/constants";
import type { Moment } from "@/lib/types";
import { MomentDrawer, type EditTarget } from "@/components/moment/moment-drawer";

const CH_COLOR: Record<Channel, string> = {
  paid: "#1D4ED8",
  email: "#047857",
  sms: "#6D28D9",
  banner: "#B45309",
};

const ACCENT: Record<string, string> = {
  drop: "#14110F",
  promo: "#9F1239",
  activation: "#B45309",
  game: "rgba(20,17,15,.38)",
  gate: "#9F1239",
};

export function TeamView({ initialMoments }: { initialMoments: Moment[] }) {
  const { teams, teamsByCode } = useApp();
  const f = useFilters();
  const [moments, setMoments] = useState<Moment[]>(initialMoments);
  const [target, setTarget] = useState<EditTarget>(null);

  const team = f.team ? teamsByCode[f.team] : null;

  const rows = useMemo(() => {
    if (!f.team) return [];
    return moments
      .filter((m) => m.teams.includes(f.team) && f.types.has(m.type))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [moments, f.team, f.types]);

  // Per-month counts, to make cadence + gaps obvious at a glance.
  const perMonth = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of MONTHS) counts[m.key] = 0;
    rows.forEach((r) => (counts[monthKey(r.date)] = (counts[monthKey(r.date)] ?? 0) + 1));
    return counts;
  }, [rows]);

  const byType = useMemo(() => {
    const t: Record<string, number> = {};
    rows.forEach((r) => (t[r.type] = (t[r.type] ?? 0) + 1));
    return t;
  }, [rows]);

  function upsert(mm: Moment) {
    setMoments((ms) => (ms.some((x) => x.id === mm.id) ? ms.map((x) => (x.id === mm.id ? mm : x)) : [...ms, mm]));
  }
  function remove(id: string) {
    setMoments((ms) => ms.filter((x) => x.id !== id));
  }

  if (!f.team) {
    return (
      <div className="border border-rule bg-[#FBFAF6] p-10 text-center">
        <div className="font-serif text-[20px] mb-2">Pick a team</div>
        <p className="text-[13px] text-ink-60 mb-5 max-w-md mx-auto leading-relaxed">
          Choose a team in the filter bar above to see its whole season as a vertical timeline —
          every moment it&apos;s tagged to, in order, with the gaps visible.
        </p>
        <div className="flex flex-wrap gap-2 justify-center max-w-2xl mx-auto">
          {teams.map((t) => (
            <button
              key={t.code}
              onClick={() => f.setTeam(t.code)}
              className="inline-flex items-center gap-2 border border-rule px-3 py-1.5 text-[12px] font-mono uppercase tracking-[0.04em] text-ink-60 hover:border-ink hover:text-ink"
            >
              <i className="w-2.5 h-2.5" style={{ background: t.color }} />
              {t.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const maxMonth = Math.max(1, ...Object.values(perMonth));

  return (
    <div>
      {/* team header */}
      <div className="flex items-start gap-4 flex-wrap mb-5 pb-4 border-b border-rule">
        <div className="w-3 self-stretch min-h-[64px]" style={{ background: team?.color }} />
        <div className="flex-1 min-w-[220px]">
          <h2 className="font-serif text-[26px] font-medium leading-none">{team?.name}</h2>
          <div className="font-mono text-[10px] tracking-[0.1em] uppercase text-ink-60 mt-2">
            {team?.league} · {rows.length} moments this season
          </div>
          <div className="flex gap-3 flex-wrap mt-2">
            {Object.entries(byType).map(([t, n]) => (
              <span key={t} className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-60">
                {n} {TYPE_LABEL[t as keyof typeof TYPE_LABEL] ?? t}
              </span>
            ))}
          </div>
        </div>
        {/* per-month cadence bars */}
        <div className="flex gap-2 items-end">
          {MONTHS.map((mo) => (
            <div key={mo.key} className="flex flex-col items-center gap-1">
              <div className="w-7 bg-paper-2 flex items-end" style={{ height: 44 }} title={`${perMonth[mo.key]} in ${mo.label}`}>
                <div className="w-full" style={{ height: `${(perMonth[mo.key] / maxMonth) * 100}%`, background: team?.color, minHeight: perMonth[mo.key] ? 3 : 0 }} />
              </div>
              <span className="font-mono text-[9px] uppercase text-ink-38">{mo.label.slice(0, 3)}</span>
              <span className="font-mono text-[10px] text-ink-60">{perMonth[mo.key]}</span>
            </div>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="p-9 text-center text-ink-60 text-[13px]">
          No moments for {team?.name} match the current type filter.
        </div>
      ) : (
        <ol className="relative ml-2">
          {/* the season spine, in the team's color */}
          <div className="absolute left-[6px] top-1 bottom-1 w-[2px]" style={{ background: team?.color, opacity: 0.35 }} />
          {rows.map((m) => {
            const dim = isDimmed(m, f.channels);
            return (
              <li key={m.id} className={`relative pl-7 py-2.5 ${dim ? "opacity-30" : ""}`}>
                <span
                  className="absolute left-[1px] top-[15px] w-3.5 h-3.5 border-2 border-paper"
                  style={{ background: ACCENT[m.type] }}
                />
                <button onClick={() => setTarget({ mode: "edit", moment: m })} className="text-left w-full group">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-mono text-[11px] text-ink-60 tabular-nums">{pretty(m.date)}</span>
                    <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-ink-38">{TYPE_LABEL[m.type]}</span>
                    {m.end_date && m.end_date > m.date && (
                      <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-ink-38">→ {pretty(m.end_date)}</span>
                    )}
                  </div>
                  <div className="text-[14px] font-semibold group-hover:underline underline-offset-2 mt-0.5">
                    {m.title || "Untitled"}
                  </div>
                  {m.product_note && <div className="text-[12px] text-ink-60 mt-0.5">{m.product_note}</div>}
                  <div className="flex gap-1 mt-1.5">
                    {CHANNELS.map((c) => (
                      <span
                        key={c}
                        className="h-[3px] w-9"
                        style={{ background: m.channels.includes(c) ? CH_COLOR[c] : "var(--rule)" }}
                      />
                    ))}
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      )}

      <MomentDrawer target={target} onClose={() => setTarget(null)} onUpsert={upsert} onRemove={remove} />
    </div>
  );
}
