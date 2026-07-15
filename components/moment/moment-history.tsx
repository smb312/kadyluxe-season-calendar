"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/app-context";
import { pretty } from "@/lib/dates";
import type { MomentHistory } from "@/lib/types";

// Per-moment "last changed by" line + an expandable recent-change log.
export function MomentHistoryPanel({ momentId, updatedBy, updatedAt }: { momentId: string; updatedBy: string | null; updatedAt: string }) {
  const { memberName } = useApp();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<MomentHistory[] | null>(null);

  useEffect(() => {
    if (!open || rows) return;
    const supabase = createClient();
    supabase
      .from("moment_history")
      .select("*")
      .eq("moment_id", momentId)
      .order("at", { ascending: false })
      .limit(8)
      .then(({ data }) => setRows((data as MomentHistory[]) ?? []));
  }, [open, rows, momentId]);

  return (
    <div className="mt-4 pt-3 border-t border-rule">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-ink-38">
          Last changed by {memberName(updatedBy)} · {pretty(updatedAt.slice(0, 10))}
        </span>
        <button onClick={() => setOpen((o) => !o)} className="font-mono text-[10px] uppercase text-ink-60 underline underline-offset-2 hover:text-ink">
          {open ? "Hide" : "History"}
        </button>
      </div>

      {open && (
        <div className="mt-2 flex flex-col gap-1.5">
          {rows === null ? (
            <span className="text-[11px] text-ink-60">Loading…</span>
          ) : rows.length === 0 ? (
            <span className="text-[11px] text-ink-60">No recorded changes.</span>
          ) : (
            rows.map((h) => (
              <div key={h.id} className="text-[11px] text-ink-60 leading-snug">
                <span className="font-mono uppercase text-ink-38">{h.action}</span> by{" "}
                <span className="text-ink">{memberName(h.actor_id)}</span> ·{" "}
                {new Date(h.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                {h.action === "updated" && h.diff && (
                  <span className="text-ink-38"> · {Object.keys(h.diff).join(", ")}</span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
