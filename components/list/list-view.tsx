"use client";

import { useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/app-context";
import { useFilters } from "@/lib/use-filters";
import { passesFilters, sortMoments, type SortKey } from "@/lib/filter-moments";
import { updateMomentField, createMoment } from "@/lib/mutations";
import { toCsv, downloadCsv } from "@/lib/csv";
import { MomentDrawer, type EditTarget } from "@/components/moment/moment-drawer";
import { FilterBar } from "@/components/filters/filter-bar";
import { monthKey } from "@/lib/dates";
import {
  CHANNELS,
  MONTHS,
  MOMENT_TYPES,
  LIC_STATUSES,
  TYPE_LABEL,
  SEASON_MIN,
  type Channel,
  type LicStatus,
  type MomentType,
} from "@/lib/constants";
import type { Moment } from "@/lib/types";

const CH_COLOR: Record<Channel, string> = {
  paid: "#1D4ED8",
  email: "#047857",
  sms: "#6D28D9",
  banner: "#B45309",
};

const ROW_ACCENT: Record<MomentType, string> = {
  drop: "#14110F",
  promo: "#9F1239",
  activation: "#B45309",
  game: "rgba(20,17,15,.38)",
  gate: "#9F1239",
};

export function ListView({ initialMoments }: { initialMoments: Moment[] }) {
  const supabase = useMemo(() => createClient(), []);
  const { canWrite, teamsByCode } = useApp();
  const f = useFilters();
  const [moments, setMoments] = useState<Moment[]>(initialMoments);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [target, setTarget] = useState<EditTarget>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const focusValue = useRef<string>("");

  const teamName = (code: string) => teamsByCode[code]?.name ?? code;

  const rows = useMemo(() => {
    const filterState = { types: f.types, channels: f.channels, team: f.team, brandOnly: f.brandOnly };
    let r = moments.filter((m) => passesFilters(m, filterState));
    if (f.scope !== "all") r = r.filter((m) => monthKey(m.date) === f.scope);
    return sortMoments(r, sortKey, sortDir);
  }, [moments, f.types, f.channels, f.team, f.brandOnly, f.scope, sortKey, sortDir]);

  // ---- optimistic local update + persist ----
  function patchLocal(id: string, patch: Partial<Moment>) {
    setMoments((ms) => ms.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }
  async function persist(id: string, patch: Partial<Moment>) {
    patchLocal(id, patch);
    const { error } = await updateMomentField(supabase, id, patch);
    if (error) {
      setFlash(`Save failed: ${error}`);
      setTimeout(() => setFlash(null), 4000);
    }
  }

  function toggleChannel(m: Moment, c: Channel) {
    const channels = m.channels.includes(c) ? m.channels.filter((x) => x !== c) : [...m.channels, c];
    persist(m.id, { channels });
  }

  async function addRow() {
    const date = f.scope === "all" ? SEASON_MIN : `${f.scope}-01`;
    const { id, error } = await createMoment(supabase, {
      date,
      end_date: null,
      title: "",
      type: "activation",
      channels: [],
      teams: [],
      product_note: null,
      owner: null,
      notes: null,
      licensing: "na",
      warehouse_date: null,
      blocked: false,
      blocked_reason: null,
    });
    if (error || !id) {
      setFlash(error ?? "Could not add row");
      return;
    }
    const now = new Date().toISOString();
    const m: Moment = {
      id,
      date,
      end_date: null,
      title: "",
      type: "activation",
      channels: [],
      teams: [],
      product_note: null,
      owner: null,
      notes: null,
      licensing: "na",
      warehouse_date: null,
      blocked: false,
      blocked_reason: null,
      created_by: null,
      created_at: now,
      updated_by: null,
      updated_at: now,
    };
    setMoments((ms) => [...ms, m]);
    setTimeout(() => {
      document.getElementById(`title-${id}`)?.focus();
    }, 30);
  }

  function upsert(m: Moment) {
    setMoments((ms) => (ms.some((x) => x.id === m.id) ? ms.map((x) => (x.id === m.id ? m : x)) : [...ms, m]));
  }
  function removeMoment(id: string) {
    setMoments((ms) => ms.filter((m) => m.id !== id));
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  // ---- stats ----
  const stats = useMemo(() => {
    const drops = rows.filter((r) => r.type === "drop").length;
    const gates = rows.filter((r) => r.type === "gate").length;
    const emails = rows.filter((r) => r.channels.includes("email")).length;
    const noCh = rows.filter((r) => r.channels.length === 0 && r.type !== "gate").length;
    const teams = new Set<string>();
    rows.forEach((r) => r.teams.forEach((t) => teams.add(t)));
    return { count: rows.length, drops, gates, emails, noCh, teamsTouched: teams.size };
  }, [rows]);

  const th = "bg-ink text-paper font-mono text-[9.5px] font-medium tracking-[0.11em] uppercase text-left px-2 py-2.5 whitespace-nowrap";
  const sortArrow = (k: SortKey) => (sortKey === k ? (sortDir === "asc" ? " ↑" : " ↓") : "");
  const cellInput =
    "w-full border border-transparent bg-transparent text-[13px] text-ink px-1 py-1.5 hover:border-rule hover:bg-white focus:border-ink focus:bg-white focus:outline-none";

  return (
    <div>
      {/* stats */}
      <div className="flex gap-0 mb-4 border border-rule w-fit">
        {[
          { b: stats.count, s: "Moments" },
          { b: stats.drops, s: "Drops" },
          { b: stats.emails, s: "Email sends" },
          { b: stats.teamsTouched, s: f.team ? teamName(f.team) : f.brandOnly ? "Brand-wide" : "Teams touched" },
          { b: stats.gates, s: "Gates" },
          { b: stats.noCh, s: "No channel", warn: stats.noCh > 0 },
        ].map((st, i) => (
          <div key={i} className="px-4 py-2 border-r border-rule last:border-r-0 min-w-[92px]" style={st.warn ? { color: "var(--gate)" } : undefined}>
            <b className="block font-mono text-[19px] font-medium leading-tight">{st.b}</b>
            <span className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-38">{st.s}</span>
          </div>
        ))}
      </div>

      <FilterBar />

      {/* toolbar */}
      <div className="flex gap-2.5 items-center mb-3 flex-wrap">
        <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-ink-38">Showing</span>
        <select
          value={f.scope}
          onChange={(e) => f.setScope(e.target.value)}
          className="px-2.5 py-1.5 border border-ink bg-transparent font-mono text-[11px] tracking-[0.05em] uppercase text-ink"
        >
          <option value="all">All months</option>
          {MONTHS.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
        <span className="font-mono text-[11px] tracking-[0.08em] uppercase text-ink-38">
          {stats.count} moments · {stats.drops} drops
          {stats.noCh > 0 ? ` · ${stats.noCh} with no channel` : ""}
        </span>
        {canWrite && (
          <button onClick={addRow} className="ml-auto border border-ink px-3 py-1.5 text-[12px] font-medium hover:bg-ink hover:text-paper">
            + Add row
          </button>
        )}
        <button
          onClick={() => downloadCsv(toCsv(rows, teamName))}
          className={`border border-ink px-3 py-1.5 text-[12px] font-medium hover:bg-ink hover:text-paper ${canWrite ? "" : "ml-auto"}`}
        >
          Export CSV
        </button>
      </div>

      {flash && (
        <div className="border-l-[3px] border-gate bg-[rgba(159,18,57,0.05)] px-3 py-2 text-[12px] text-gate mb-3">{flash}</div>
      )}

      <div className="border border-ink overflow-x-auto bg-[#FBFAF6]">
        <table className="border-collapse w-full min-w-[1120px] text-[13px]">
          <thead>
            <tr>
              <th className={`${th} cursor-pointer`} onClick={() => toggleSort("date")}>
                Date{sortArrow("date")}
              </th>
              <th className={`${th} cursor-pointer`} onClick={() => toggleSort("type")}>
                Type{sortArrow("type")}
              </th>
              <th className={`${th} cursor-pointer`} onClick={() => toggleSort("title")}>
                Moment{sortArrow("title")}
              </th>
              <th className={th}>Teams</th>
              <th className={`${th} text-center w-[52px]`}>Paid</th>
              <th className={`${th} text-center w-[52px]`}>Email</th>
              <th className={`${th} text-center w-[52px]`}>SMS</th>
              <th className={`${th} text-center w-[52px]`}>Bnr</th>
              <th className={`${th} cursor-pointer`} onClick={() => toggleSort("owner")}>
                Owner{sortArrow("owner")}
              </th>
              <th className={th}>Product / units</th>
              <th className={th}>Licensing</th>
              <th className={th}>Notes</th>
              <th className={th}></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={13} className="p-9 text-center text-ink-60 text-[13px]">
                  Nothing matches these filters. Clear a filter, or add a row.
                </td>
              </tr>
            ) : (
              rows.map((m) => (
                <tr key={m.id} className="border-b border-rule hover:bg-[#F2EFE6]" style={{ boxShadow: `inset 3px 0 0 ${ROW_ACCENT[m.type]}` }}>
                  {/* Date */}
                  <td className="px-1.5 py-0.5 border-r border-[rgba(219,213,199,0.5)]">
                    <input
                      type="date"
                      value={m.date}
                      min={SEASON_MIN}
                      disabled={!canWrite}
                      onChange={(e) => persist(m.id, { date: e.target.value })}
                      className={`${cellInput} font-mono text-[11.5px] min-w-[118px]`}
                    />
                  </td>
                  {/* Type */}
                  <td className="px-1.5 py-0.5 border-r border-[rgba(219,213,199,0.5)]">
                    <select
                      value={m.type}
                      disabled={!canWrite}
                      onChange={(e) => persist(m.id, { type: e.target.value as MomentType })}
                      className={`${cellInput} font-mono text-[10px] uppercase min-w-[96px]`}
                    >
                      {MOMENT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {TYPE_LABEL[t]}
                        </option>
                      ))}
                    </select>
                  </td>
                  {/* Title */}
                  <td className="px-1.5 py-0.5 border-r border-[rgba(219,213,199,0.5)]">
                    <input
                      id={`title-${m.id}`}
                      type="text"
                      value={m.title}
                      placeholder="Name this moment"
                      disabled={!canWrite}
                      onChange={(e) => patchLocal(m.id, { title: e.target.value })}
                      onFocus={(e) => (focusValue.current = e.target.value)}
                      onBlur={(e) => e.target.value !== focusValue.current && persist(m.id, { title: e.target.value })}
                      className={`${cellInput} font-semibold min-w-[230px]`}
                    />
                  </td>
                  {/* Teams — click opens the drawer */}
                  <td className="px-1.5 py-0.5 border-r border-[rgba(219,213,199,0.5)]">
                    <button
                      onClick={() => setTarget({ mode: "edit", moment: m })}
                      className="flex gap-1 flex-wrap items-center border border-transparent p-1 min-w-[130px] hover:border-rule hover:bg-white text-left w-full"
                    >
                      {m.teams.length === 0 ? (
                        <span className="font-mono text-[9.5px] tracking-[0.07em] uppercase text-ink-38">Brand-wide</span>
                      ) : (
                        <>
                          {m.teams.slice(0, 4).map((code) => (
                            <span key={code} title={teamName(code)} className="inline-flex items-center gap-1 font-mono text-[9px] font-bold tracking-[0.05em]">
                              <i className="w-[9px] h-[9px] border border-[rgba(20,17,15,0.18)]" style={{ background: teamsByCode[code]?.color ?? "#999" }} />
                              {code}
                            </span>
                          ))}
                          {m.teams.length > 4 && <span className="font-mono text-[9.5px] text-ink-60">+{m.teams.length - 4}</span>}
                        </>
                      )}
                    </button>
                  </td>
                  {/* Channels */}
                  {CHANNELS.map((c) => {
                    const on = m.channels.includes(c);
                    return (
                      <td key={c} className="px-1.5 py-0.5 border-r border-[rgba(219,213,199,0.5)] text-center">
                        <button
                          aria-label={`${c} on ${m.title}`}
                          disabled={!canWrite}
                          onClick={() => toggleChannel(m, c)}
                          className="w-5 h-5 block mx-auto border"
                          style={on ? { background: CH_COLOR[c], borderColor: "transparent" } : { background: "#fff", borderColor: "var(--rule)" }}
                        />
                      </td>
                    );
                  })}
                  {/* Owner */}
                  <td className="px-1.5 py-0.5 border-r border-[rgba(219,213,199,0.5)]">
                    <input
                      type="text"
                      value={m.owner ?? ""}
                      placeholder="—"
                      disabled={!canWrite}
                      onChange={(e) => patchLocal(m.id, { owner: e.target.value })}
                      onFocus={(e) => (focusValue.current = e.target.value)}
                      onBlur={(e) => e.target.value !== focusValue.current && persist(m.id, { owner: e.target.value || null })}
                      className={`${cellInput} min-w-[110px] text-[12px]`}
                    />
                  </td>
                  {/* Product note */}
                  <td className="px-1.5 py-0.5 border-r border-[rgba(219,213,199,0.5)]">
                    <input
                      type="text"
                      value={m.product_note ?? ""}
                      placeholder="—"
                      disabled={!canWrite}
                      onChange={(e) => patchLocal(m.id, { product_note: e.target.value })}
                      onFocus={(e) => (focusValue.current = e.target.value)}
                      onBlur={(e) => e.target.value !== focusValue.current && persist(m.id, { product_note: e.target.value || null })}
                      className={`${cellInput} min-w-[170px] text-[12px]`}
                    />
                  </td>
                  {/* Licensing */}
                  <td className="px-1.5 py-0.5 border-r border-[rgba(219,213,199,0.5)]">
                    <select
                      value={m.licensing}
                      disabled={!canWrite}
                      onChange={(e) => persist(m.id, { licensing: e.target.value as LicStatus })}
                      className={`${cellInput} font-mono text-[10px] uppercase min-w-[92px]`}
                    >
                      {LIC_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  {/* Notes */}
                  <td className="px-1.5 py-0.5 border-r border-[rgba(219,213,199,0.5)]">
                    <textarea
                      value={m.notes ?? ""}
                      placeholder="—"
                      disabled={!canWrite}
                      onChange={(e) => patchLocal(m.id, { notes: e.target.value })}
                      onFocus={(e) => (focusValue.current = e.target.value)}
                      onBlur={(e) => e.target.value !== focusValue.current && persist(m.id, { notes: e.target.value || null })}
                      className={`${cellInput} min-w-[250px] h-[30px] resize-y text-[12px] leading-snug`}
                    />
                  </td>
                  {/* row edit / delete affordance */}
                  <td className="px-1.5 py-0.5 text-center">
                    <button
                      onClick={() => setTarget({ mode: "edit", moment: m })}
                      title="Open full editor"
                      className="text-ink-38 hover:text-ink text-[15px] leading-none px-1.5 py-1"
                    >
                      ⋯
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="font-mono text-[10px] tracking-[0.06em] uppercase text-ink-38 mt-2.5">
        Edits save as you leave a field. Click the teams cell or ⋯ for the full editor.
      </div>

      <MomentDrawer target={target} onClose={() => setTarget(null)} onUpsert={upsert} onRemove={removeMoment} />
    </div>
  );
}
