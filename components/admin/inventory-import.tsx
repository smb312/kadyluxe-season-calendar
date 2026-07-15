"use client";

import { useRef, useState } from "react";

interface ImportResult {
  imported: number;
  unmatched_teams: number;
  mapped_columns: string[];
  unmapped_headers: string[];
}

// Admin-only uploader for the tracking_fall_*.xlsx export. Replaces the
// snapshot on each upload. Never mutates moments.
export function InventoryImport() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose an .xlsx file first");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/admin/inventory/import", { method: "POST", body });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Import failed");
      return;
    }
    setResult(json);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="max-w-3xl mt-10">
      <h2 className="font-serif text-[22px] font-medium mb-1">Inventory snapshot</h2>
      <p className="text-[12px] text-ink-60 mb-4 leading-relaxed">
        Upload the <code>tracking_fall_*.xlsx</code> export. It <b>replaces</b> the current snapshot
        (it doesn&apos;t accumulate) and never changes a moment — it just sits alongside so the
        licensing/warehouse fields can be checked against the source, shown on each moment&apos;s editor.
      </p>

      {error && (
        <div className="border-l-[3px] border-gate bg-[rgba(159,18,57,0.05)] px-3 py-2 text-[12px] text-gate mb-3">{error}</div>
      )}

      <div className="border border-rule bg-[#FBFAF6] p-4 flex items-center gap-3 flex-wrap">
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="text-[12px]"
        />
        <button
          onClick={upload}
          disabled={busy}
          className="bg-ink text-paper px-4 py-2 text-[12px] font-medium hover:bg-black disabled:opacity-50"
        >
          {busy ? "Importing…" : "Import snapshot"}
        </button>
      </div>

      {result && (
        <div className="border border-ink bg-paper-2 p-4 mt-3 text-[12px] leading-relaxed">
          <div className="font-mono text-[10px] tracking-[0.1em] uppercase text-ink-60 mb-1.5">Imported</div>
          <div>
            {result.imported} rows · {result.unmatched_teams} with an unmatched team
          </div>
          <div className="text-ink-60 mt-1">Mapped columns: {result.mapped_columns.join(", ") || "none"}</div>
          {result.unmapped_headers.length > 0 && (
            <div className="text-ink-60 mt-1">Ignored columns: {result.unmapped_headers.join(", ")}</div>
          )}
        </div>
      )}
    </div>
  );
}
