"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { shortDate } from "@/lib/dates";
import type { InventorySnapshot } from "@/lib/types";
import type { LicStatus } from "@/lib/constants";

// Compares a moment's manually-typed licensing/warehouse against the latest
// imported inventory snapshot (matched by team). It NEVER writes back — a human
// decides. It only surfaces the source so nobody has to remember to go look,
// and flags where the typed value and the import disagree.
export function InventoryCompare({ teams, licensing }: { teams: string[]; licensing: LicStatus }) {
  const [rows, setRows] = useState<InventorySnapshot[] | null>(null);
  const [importedAt, setImportedAt] = useState<string | null>(null);

  useEffect(() => {
    if (teams.length === 0) {
      setRows([]);
      return;
    }
    const supabase = createClient();
    supabase
      .from("inventory_snapshot")
      .select("*")
      .in("team_code", teams)
      .then(({ data }) => {
        const r = (data as InventorySnapshot[]) ?? [];
        setRows(r);
        setImportedAt(r[0]?.imported_at ?? null);
      });
  }, [teams]);

  if (!rows || rows.length === 0) return null; // no snapshot / no match → show nothing

  // Snapshot licensing is free text ('Approved'/'Pending'); map to compare.
  const norm = (s: string | null): LicStatus | null => {
    const v = (s ?? "").toLowerCase();
    if (v.startsWith("appro")) return "approved";
    if (v.startsWith("pend")) return "pending";
    return null;
  };

  return (
    <div className="mt-4 pt-3 border-t border-rule">
      <div className="font-mono text-[10px] tracking-[0.08em] uppercase text-ink-38 mb-2">
        Per last import{importedAt ? ` (${shortDate(importedAt.slice(0, 10))})` : ""}
      </div>
      <div className="flex flex-col gap-1.5">
        {rows.slice(0, 12).map((r) => {
          const snap = norm(r.licensing);
          const disagree = snap !== null && snap !== licensing;
          return (
            <div
              key={r.id}
              className={`text-[11px] leading-snug px-2 py-1 border-l-2 ${disagree ? "border-gate bg-[rgba(159,18,57,0.05)]" : "border-rule"}`}
            >
              <span className="font-mono uppercase text-ink-60">{r.team_code ?? r.team_raw}</span>{" "}
              {r.style ? <span className="text-ink">{r.style}</span> : null}
              {r.color ? <span className="text-ink-60"> · {r.color}</span> : null}
              <div className="text-ink-60">
                licensing: <span className={disagree ? "text-gate font-semibold" : "text-ink"}>{r.licensing ?? "—"}</span>
                {disagree && <span className="text-gate"> (typed: {licensing})</span>}
                {r.received_3pl ? <span> · 3PL {shortDate(r.received_3pl)}</span> : r.status ? <span> · {r.status}</span> : null}
                {r.units != null ? <span> · {r.units.toLocaleString()} units</span> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
