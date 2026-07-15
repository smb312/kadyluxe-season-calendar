"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/components/app-context";
import { useFilters } from "@/lib/use-filters";
import { passesStructural, isDimmed, isBand } from "@/lib/filter-moments";
import { buildMonthWeeks, pretty, shortDate, type DayCell } from "@/lib/dates";
import { MONTHS } from "@/lib/constants";
import type { Moment } from "@/lib/types";
import { MomentCard } from "@/components/calendar/moment-card";
import { MomentDrawer, type EditTarget } from "@/components/moment/moment-drawer";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface BandSeg {
  m: Moment;
  startCol: number; // 0-based column within the week
  endCol: number;
  lane: number;
}

export function CalendarView({ initialMoments }: { initialMoments: Moment[] }) {
  const { teamsByCode } = useApp();
  const f = useFilters();
  const [moments, setMoments] = useState<Moment[]>(initialMoments);
  const [monthIdx, setMonthIdx] = useState(0);
  const [target, setTarget] = useState<EditTarget>(null);

  const filterState = { types: f.types, channels: f.channels, team: f.team, brandOnly: f.brandOnly };

  // Structural filter (type/team/brand) removes; channel filter only dims.
  const structural = useMemo(
    () => moments.filter((m) => passesStructural(m, filterState)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [moments, f.types, f.team, f.brandOnly],
  );
  const singles = structural.filter((m) => !isBand(m));
  const bands = structural.filter(isBand);

  const { y, m } = MONTHS[monthIdx];
  const monthPrefix = MONTHS[monthIdx].key;
  const weeks = useMemo(() => buildMonthWeeks(y, m), [y, m]);

  function upsert(mm: Moment) {
    setMoments((ms) => (ms.some((x) => x.id === mm.id) ? ms.map((x) => (x.id === mm.id ? mm : x)) : [...ms, mm]));
  }
  function remove(id: string) {
    setMoments((ms) => ms.filter((x) => x.id !== id));
  }

  // Compute band segments + lane packing for one week.
  function bandSegments(week: DayCell[]): { segs: BandSeg[]; lanes: number } {
    const raw: Omit<BandSeg, "lane">[] = [];
    for (const b of bands) {
      const end = b.end_date ?? b.date;
      let startCol = -1;
      let endCol = -1;
      week.forEach((c, i) => {
        if (c.iso && c.iso >= b.date && c.iso <= end) {
          if (startCol === -1) startCol = i;
          endCol = i;
        }
      });
      if (startCol !== -1) raw.push({ m: b, startCol, endCol });
    }
    // greedy lane packing
    raw.sort((a, b) => a.startCol - b.startCol);
    const laneEnds: number[] = [];
    const segs: BandSeg[] = raw.map((r) => {
      let lane = laneEnds.findIndex((end) => end < r.startCol);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(r.endCol);
      } else {
        laneEnds[lane] = r.endCol;
      }
      return { ...r, lane };
    });
    return { segs, lanes: laneEnds.length };
  }

  const monthSingles = singles.filter((mm) => mm.date.startsWith(monthPrefix));

  return (
    <div>
      {/* month tabs */}
      <div className="flex border border-ink w-fit mb-5" role="tablist">
        {MONTHS.map((mo, i) => (
          <button
            key={mo.key}
            role="tab"
            aria-selected={i === monthIdx}
            onClick={() => setMonthIdx(i)}
            className={`border-r border-ink last:border-r-0 px-[18px] py-[9px] font-mono text-[11px] tracking-[0.1em] uppercase ${
              i === monthIdx ? "bg-ink text-paper" : "text-ink-60 hover:text-ink"
            }`}
          >
            {mo.label}
          </button>
        ))}
      </div>

      {/* desktop grid */}
      <div className="hidden sm:block">
        <div className="cal-grid-head">
          {WEEKDAYS.map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="cal-grid">
          {weeks.map((week, wi) => {
            const { segs, lanes } = bandSegments(week);
            return (
              <div key={wi}>
                {lanes > 0 && (
                  <div className="cal-bandlane" style={{ gridTemplateRows: `repeat(${lanes}, auto)` }}>
                    {segs.map((s) => (
                      <div
                        key={s.m.id}
                        className="cal-band"
                        data-type={s.m.type}
                        style={{ gridColumn: `${s.startCol + 1} / ${s.endCol + 2}`, gridRow: s.lane + 1 }}
                        onClick={() => setTarget({ mode: "edit", moment: s.m })}
                        title={`${s.m.title} · ${shortDate(s.m.date)}–${shortDate(s.m.end_date ?? s.m.date)}`}
                      >
                        <span className="cal-band-teams">
                          {s.m.teams.slice(0, 4).map((k) => (
                            <i key={k} style={{ background: teamsByCode[k]?.color ?? "#999" }} />
                          ))}
                        </span>
                        <span className="overflow-hidden text-ellipsis">{s.m.title}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="cal-week">
                  {week.map((cell, ci) => {
                    if (!cell.iso) return <div key={ci} className="day out" />;
                    const dayMoments = monthSingles.filter((mm) => mm.date === cell.iso);
                    return (
                      <div
                        key={ci}
                        className={`day${cell.weekend ? " weekend" : ""}`}
                        role="button"
                        tabIndex={0}
                        aria-label={`Add moment on ${pretty(cell.iso)}`}
                        onClick={() => setTarget({ mode: "new", date: cell.iso! })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setTarget({ mode: "new", date: cell.iso! });
                          }
                        }}
                      >
                        <div className="dnum">{String(cell.day).padStart(2, "0")}</div>
                        {dayMoments.map((mm) => (
                          <MomentCard
                            key={mm.id}
                            m={mm}
                            dim={isDimmed(mm, f.channels)}
                            teamFilter={f.team}
                            onClick={() => setTarget({ mode: "edit", moment: mm })}
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* mobile agenda */}
      <div className="sm:hidden">
        <MobileAgenda
          monthPrefix={monthPrefix}
          singles={monthSingles}
          bands={bands.filter((b) => (b.end_date ?? b.date) >= `${monthPrefix}-01` && b.date <= `${monthPrefix}-31`)}
          channels={f.channels}
          teamFilter={f.team}
          onOpen={(mm) => setTarget({ mode: "edit", moment: mm })}
        />
      </div>

      <MomentDrawer target={target} onClose={() => setTarget(null)} onUpsert={upsert} onRemove={remove} />
    </div>
  );
}

function MobileAgenda({
  monthPrefix,
  singles,
  bands,
  channels,
  teamFilter,
  onOpen,
}: {
  monthPrefix: string;
  singles: Moment[];
  bands: Moment[];
  channels: Set<import("@/lib/constants").Channel>;
  teamFilter: string;
  onOpen: (m: Moment) => void;
}) {
  // Group single-day moments by date; bands surface on their start day.
  const byDate = new Map<string, Moment[]>();
  for (const m of singles) {
    if (!byDate.has(m.date)) byDate.set(m.date, []);
    byDate.get(m.date)!.push(m);
  }
  for (const b of bands) {
    const key = b.date < `${monthPrefix}-01` ? `${monthPrefix}-01` : b.date;
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(b);
  }
  const dates = [...byDate.keys()].sort();

  if (dates.length === 0) {
    return <div className="p-9 text-center text-ink-60 text-[13px]">Nothing this month matches these filters.</div>;
  }

  return (
    <div>
      {dates.map((d) => (
        <div key={d} className="agenda-day">
          <div className="agenda-date">{pretty(d)}</div>
          <div className="flex flex-col gap-1.5">
            {byDate
              .get(d)!
              .map((m) => (
                <MomentCard key={m.id} m={m} dim={isDimmed(m, channels)} teamFilter={teamFilter} onClick={() => onOpen(m)} />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
