"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/app-context";
import { createMoment, saveMoment, deleteMoment } from "@/lib/mutations";
import {
  CHANNELS,
  MOMENT_TYPES,
  LIC_STATUSES,
  CHANNEL_LABEL,
  TYPE_LABEL,
  LEAGUE_ORDER,
  SEASON_MIN,
  SEASON_MAX,
  type Channel,
  type LicStatus,
  type MomentType,
} from "@/lib/constants";
import type { Moment, MomentInput } from "@/lib/types";
import { pretty } from "@/lib/dates";
import { MomentHistoryPanel } from "@/components/moment/moment-history";
import { InventoryCompare } from "@/components/moment/inventory-compare";

const CH_COLOR: Record<Channel, string> = {
  paid: "#1D4ED8",
  email: "#047857",
  sms: "#6D28D9",
  banner: "#B45309",
};

const LIC_LABEL: Record<LicStatus, string> = {
  approved: "Approved",
  pending: "Pending",
  na: "N/A",
};

export type EditTarget =
  | { mode: "new"; date?: string }
  | { mode: "edit"; moment: Moment }
  | null;

interface FormState {
  title: string;
  date: string;
  end_date: string;
  type: MomentType;
  channels: Channel[];
  teams: string[];
  product_note: string;
  owner: string;
  notes: string;
  licensing: LicStatus;
  warehouse_date: string;
  blocked: boolean;
  blocked_reason: string;
}

function emptyForm(date?: string): FormState {
  return {
    title: "",
    date: date ?? SEASON_MIN,
    end_date: "",
    type: "activation",
    channels: [],
    teams: [],
    product_note: "",
    owner: "",
    notes: "",
    licensing: "na",
    warehouse_date: "",
    blocked: false,
    blocked_reason: "",
  };
}

function formFromMoment(m: Moment): FormState {
  return {
    title: m.title,
    date: m.date,
    end_date: m.end_date ?? "",
    type: m.type,
    channels: [...m.channels],
    teams: [...m.teams],
    product_note: m.product_note ?? "",
    owner: m.owner ?? "",
    notes: m.notes ?? "",
    licensing: m.licensing,
    warehouse_date: m.warehouse_date ?? "",
    blocked: m.blocked,
    blocked_reason: m.blocked_reason ?? "",
  };
}

function toInput(f: FormState): MomentInput {
  return {
    title: f.title.trim(),
    date: f.date,
    end_date: f.end_date || null,
    type: f.type,
    channels: f.channels,
    teams: f.teams,
    product_note: f.product_note.trim() || null,
    owner: f.owner.trim() || null,
    notes: f.notes.trim() || null,
    licensing: f.licensing,
    warehouse_date: f.warehouse_date || null,
    blocked: f.blocked,
    blocked_reason: f.blocked ? f.blocked_reason.trim() || null : null,
  };
}

export function MomentDrawer({
  target,
  onClose,
  onUpsert,
  onRemove,
}: {
  target: EditTarget;
  onClose: () => void;
  onUpsert: (m: Moment) => void;
  onRemove: (id: string) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { teams, canWrite, profile } = useApp();
  const [form, setForm] = useState<FormState>(emptyForm());
  const [teamQuery, setTeamQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = target !== null;
  const isEdit = target?.mode === "edit";

  useEffect(() => {
    if (!target) return;
    setError(null);
    setTeamQuery("");
    setForm(target.mode === "edit" ? formFromMoment(target.moment) : emptyForm(target.date));
  }, [target]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const orderedTeams = useMemo(
    () =>
      [...teams].sort(
        (a, b) => (LEAGUE_ORDER[a.league] ?? 9) - (LEAGUE_ORDER[b.league] ?? 9) || a.sort_order - b.sort_order,
      ),
    [teams],
  );
  const visibleTeams = orderedTeams.filter(
    (t) =>
      !teamQuery ||
      t.name.toLowerCase().includes(teamQuery.toLowerCase()) ||
      t.code.toLowerCase().includes(teamQuery.toLowerCase()),
  );

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  function toggleChannel(c: Channel) {
    setForm((f) => ({
      ...f,
      channels: f.channels.includes(c) ? f.channels.filter((x) => x !== c) : [...f.channels, c],
    }));
  }
  function toggleTeam(code: string) {
    setForm((f) => ({
      ...f,
      teams: f.teams.includes(code) ? f.teams.filter((x) => x !== code) : [...f.teams, code],
    }));
  }

  async function save() {
    if (!form.title.trim()) {
      setError("Give it a name first");
      return;
    }
    setBusy(true);
    setError(null);
    const input = toInput(form);

    if (target?.mode === "edit") {
      const { error } = await saveMoment(supabase, target.moment.id, input);
      if (error) {
        setError(error);
        setBusy(false);
        return;
      }
      onUpsert({
        ...target.moment,
        ...input,
        updated_by: profile.id,
        updated_at: new Date().toISOString(),
      });
    } else {
      const { id, error } = await createMoment(supabase, input);
      if (error || !id) {
        setError(error ?? "Could not create");
        setBusy(false);
        return;
      }
      const now = new Date().toISOString();
      onUpsert({
        id,
        ...input,
        created_by: profile.id,
        created_at: now,
        updated_by: profile.id,
        updated_at: now,
      });
    }
    setBusy(false);
    onClose();
  }

  async function remove() {
    if (target?.mode !== "edit") return;
    if (!confirm("Delete this moment?")) return;
    setBusy(true);
    const { error } = await deleteMoment(supabase, target.moment.id);
    setBusy(false);
    if (error) {
      setError(error);
      return;
    }
    onRemove(target.moment.id);
    onClose();
  }

  const fieldLabel = "block font-mono text-[10px] tracking-[0.1em] uppercase text-ink-38 mb-1.5";
  const fieldInput =
    "w-full px-2.5 py-2 border border-rule bg-[#FBFAF6] text-ink text-[13.5px] focus:border-ink focus:outline-none";

  return (
    <>
      <div
        className={`fixed inset-0 bg-[rgba(20,17,15,0.34)] z-40 transition-opacity ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />
      <aside
        aria-hidden={!open}
        className={`fixed top-0 right-0 h-full w-[min(430px,100%)] bg-paper border-l-2 border-ink z-50 flex flex-col transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {open && (
          <>
            <div className="px-5 pt-5 pb-3.5 border-b border-rule flex justify-between items-start gap-3">
              <div>
                <h2 className="font-serif text-[22px] font-medium m-0 leading-tight">
                  {isEdit ? "Edit moment" : "New moment"}
                </h2>
                <div className="font-mono text-[10px] tracking-[0.1em] uppercase text-ink-60 mt-1.5">
                  {form.date ? pretty(form.date) : ""}
                </div>
              </div>
              <button onClick={onClose} aria-label="Close" className="text-[22px] leading-none text-ink-60 hover:text-ink">
                ×
              </button>
            </div>

            <div className="px-5 py-5 overflow-y-auto flex-1">
              {form.type === "gate" && (
                <div className="border-l-[3px] border-gate bg-[rgba(159,18,57,0.05)] px-2.5 py-2 text-[12px] text-gate mb-4">
                  This is a gate, not a send. If it slips, everything downstream of it slips.
                </div>
              )}
              {error && (
                <div className="border-l-[3px] border-gate bg-[rgba(159,18,57,0.05)] px-2.5 py-2 text-[12px] text-gate mb-4">
                  {error}
                </div>
              )}

              <div className="mb-4">
                <label className={fieldLabel}>Name</label>
                <input
                  className={fieldInput}
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="e.g. Mini Icon Sweater drop"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className={fieldLabel}>Date</label>
                  <input
                    type="date"
                    className={fieldInput}
                    value={form.date}
                    min={SEASON_MIN}
                    max={SEASON_MAX}
                    onChange={(e) => set("date", e.target.value)}
                  />
                </div>
                <div>
                  <label className={fieldLabel}>End date (optional)</label>
                  <input
                    type="date"
                    className={fieldInput}
                    value={form.end_date}
                    min={form.date || SEASON_MIN}
                    max={SEASON_MAX}
                    onChange={(e) => set("end_date", e.target.value)}
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className={fieldLabel}>Type</label>
                <select className={fieldInput} value={form.type} onChange={(e) => set("type", e.target.value as MomentType)}>
                  {MOMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className={fieldLabel}>Channels</label>
                <div className="grid grid-cols-2 gap-2">
                  {CHANNELS.map((c) => {
                    const on = form.channels.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => toggleChannel(c)}
                        className="flex items-center gap-2 px-2.5 py-2.5 border text-[12.5px] font-semibold text-left"
                        style={
                          on
                            ? { background: CH_COLOR[c], color: "#F4F1EA", borderColor: "transparent" }
                            : { background: "#FBFAF6", color: "var(--ink-60)", borderColor: "var(--rule)" }
                        }
                      >
                        <span
                          className="w-2.5 h-2.5 flex-none border"
                          style={{ borderColor: on ? "#F4F1EA" : "currentColor", background: on ? "#F4F1EA" : "transparent" }}
                        />
                        {CHANNEL_LABEL[c]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mb-4">
                <label className={fieldLabel}>Teams</label>
                <input
                  className={`${fieldInput} mb-1.5`}
                  placeholder="Filter this list…"
                  value={teamQuery}
                  onChange={(e) => setTeamQuery(e.target.value)}
                />
                <div className="border border-rule bg-[#FBFAF6] p-2 max-h-[190px] overflow-y-auto flex flex-wrap gap-1.5">
                  {visibleTeams.map((t) => {
                    const on = form.teams.includes(t.code);
                    return (
                      <button
                        key={t.code}
                        type="button"
                        onClick={() => toggleTeam(t.code)}
                        title={t.name}
                        className="inline-flex items-center gap-1.5 px-1.5 py-1 border font-mono text-[10px] font-semibold tracking-[0.04em] uppercase"
                        style={
                          on
                            ? { background: "var(--ink)", color: "#F4F1EA", borderColor: "var(--ink)" }
                            : { color: "var(--ink-60)", borderColor: "var(--rule)" }
                        }
                      >
                        <span className="w-2 h-2 flex-none border border-[rgba(20,17,15,0.2)]" style={{ background: t.color }} />
                        {t.name}
                      </button>
                    );
                  })}
                </div>
                <div className="text-[12px] text-ink-60 mt-1.5">Leave empty for brand-wide moments.</div>
              </div>

              <div className="mb-4">
                <label className={fieldLabel}>Product / units</label>
                <input
                  className={fieldInput}
                  value={form.product_note}
                  onChange={(e) => set("product_note", e.target.value)}
                  placeholder="e.g. Mini Icon · 7,847 units"
                />
              </div>

              <div className="mb-4">
                <label className={fieldLabel}>Owner</label>
                <input
                  className={fieldInput}
                  value={form.owner}
                  onChange={(e) => set("owner", e.target.value)}
                  placeholder="e.g. Savannah, Homestead, Eric"
                />
              </div>

              {/* Manual status fields (originate in the tracker; typed by hand here) */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className={fieldLabel}>Licensing</label>
                  <select className={fieldInput} value={form.licensing} onChange={(e) => set("licensing", e.target.value as LicStatus)}>
                    {LIC_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {LIC_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={fieldLabel}>Warehouse date</label>
                  <input
                    type="date"
                    className={fieldInput}
                    value={form.warehouse_date}
                    onChange={(e) => set("warehouse_date", e.target.value)}
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="flex items-center gap-2 text-[13px] cursor-pointer">
                  <input type="checkbox" checked={form.blocked} onChange={(e) => set("blocked", e.target.checked)} />
                  <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-ink-38">Blocked</span>
                </label>
                {form.blocked && (
                  <input
                    className={`${fieldInput} mt-2`}
                    value={form.blocked_reason}
                    onChange={(e) => set("blocked_reason", e.target.value)}
                    placeholder="Why is this blocked?"
                  />
                )}
              </div>

              <div className="mb-2">
                <label className={fieldLabel}>Notes</label>
                <textarea
                  className={`${fieldInput} min-h-[78px] resize-y leading-relaxed`}
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="Dependencies, licensing status, creative deadlines"
                />
              </div>

              {target?.mode === "edit" && (
                <>
                  <InventoryCompare teams={form.teams} licensing={form.licensing} />
                  <MomentHistoryPanel
                    momentId={target.moment.id}
                    updatedBy={target.moment.updated_by}
                    updatedAt={target.moment.updated_at}
                  />
                </>
              )}
            </div>

            <div className="px-5 py-3.5 border-t border-rule flex gap-2 justify-between">
              <button
                onClick={remove}
                disabled={!isEdit || busy}
                className="border border-gate text-gate px-3 py-1.5 text-[12px] hover:bg-gate hover:text-paper disabled:invisible"
              >
                Delete
              </button>
              <button
                onClick={save}
                disabled={busy || !canWrite}
                className="bg-ink text-paper px-4 py-1.5 text-[12px] font-medium hover:bg-black disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
