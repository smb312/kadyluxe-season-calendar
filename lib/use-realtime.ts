"use client";

import { useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Moment, MomentRow } from "@/lib/types";

const SCALAR_KEYS: (keyof MomentRow)[] = [
  "date",
  "end_date",
  "title",
  "type",
  "channels",
  "product_note",
  "owner",
  "notes",
  "licensing",
  "warehouse_date",
  "blocked",
  "blocked_reason",
  "updated_by",
  "updated_at",
];

function scalarPatch(row: Record<string, unknown>): Partial<Moment> {
  const patch: Record<string, unknown> = {};
  for (const k of SCALAR_KEYS) if (k in row) patch[k] = row[k];
  return patch as Partial<Moment>;
}

/**
 * Subscribes the given moments state to Realtime on `moments` + `moment_teams`.
 *
 * Self-echo handling: we apply the authoritative row from the payload, so your
 * own change simply re-lands as itself (no loss). The "someone else updated
 * this" signal only fires when updated_by !== the current user — that's what
 * gets surfaced, per the spec.
 *
 * In-progress edits: if `focusedRef` names the field the user is currently
 * editing, we skip overwriting exactly that field so a remote update can't yank
 * text out from under them mid-type. Everything else on the row still updates.
 *
 * Returns `otherEditor`: the display-id of whoever last changed something
 * elsewhere (cleared after a few seconds) so a view can show an indicator.
 */
export function useRealtimeMoments(
  setMoments: Dispatch<SetStateAction<Moment[]>>,
  opts: {
    currentUserId: string;
    focusedRef?: RefObject<{ id: string; key: string } | null>;
  },
): { otherEditorId: string | null } {
  const [otherEditorId, setOtherEditorId] = useState<string | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function flagOther(uid: unknown) {
    if (typeof uid === "string" && uid && uid !== opts.currentUserId) {
      setOtherEditorId(uid);
      if (clearTimer.current) clearTimeout(clearTimer.current);
      clearTimer.current = setTimeout(() => setOtherEditorId(null), 5000);
    }
  }

  useEffect(() => {
    const supabase = createClient();

    async function fetchTeams(id: string): Promise<string[]> {
      const { data } = await supabase.from("moment_teams").select("team_code").eq("moment_id", id);
      return (data ?? []).map((r) => r.team_code as string);
    }
    async function fetchMoment(id: string): Promise<Moment | null> {
      const { data } = await supabase.from("moments").select("*, moment_teams(team_code)").eq("id", id).maybeSingle();
      if (!data) return null;
      const { moment_teams, ...m } = data as MomentRow & { moment_teams: { team_code: string }[] };
      return { ...m, teams: moment_teams.map((t) => t.team_code) };
    }

    const channel = supabase
      .channel("rt-moments")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "moments" }, async (p) => {
        const id = (p.new as { id: string }).id;
        const full = await fetchMoment(id);
        if (full) setMoments((ms) => (ms.some((x) => x.id === full.id) ? ms : [...ms, full]));
        flagOther((p.new as { updated_by?: string }).updated_by);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "moments" }, (p) => {
        const row = p.new as Record<string, unknown> & { id: string };
        setMoments((ms) =>
          ms.map((m) => {
            if (m.id !== row.id) return m;
            const patch = scalarPatch(row);
            const f = opts.focusedRef?.current;
            if (f && f.id === row.id && f.key in patch) delete (patch as Record<string, unknown>)[f.key];
            return { ...m, ...patch };
          }),
        );
        flagOther(row.updated_by);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "moments" }, (p) => {
        const id = (p.old as { id?: string }).id;
        if (id) setMoments((ms) => ms.filter((m) => m.id !== id));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "moment_teams" }, async (p) => {
        const id =
          (p.new as { moment_id?: string } | null)?.moment_id ?? (p.old as { moment_id?: string } | null)?.moment_id;
        if (!id) return;
        const teams = await fetchTeams(id);
        setMoments((ms) => ms.map((m) => (m.id === id ? { ...m, teams } : m)));
      })
      .subscribe();

    return () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.currentUserId]);

  return { otherEditorId };
}
