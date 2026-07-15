import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireAdmin } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/admin/inventory/import — admin-only. Accepts the tracking_fall_*.xlsx
// export as multipart form-data (field "file"). REPLACES the snapshot
// (delete-all + insert), fuzzy-matching team names/codes to the registry.
// It does not touch moments; a human reconciles.

export const runtime = "nodejs";

// Header aliases — matched case-insensitively against the sheet's columns.
const FIELD_ALIASES: Record<string, string[]> = {
  po: ["po", "po#", "po number", "purchase order"],
  status: ["status", "wh status", "warehouse status"],
  licensing: ["licensing", "license", "licensed", "licensing status"],
  team_raw: ["team", "team name", "ip", "league team", "school"],
  style: ["style", "style name", "product", "sku", "item"],
  color: ["color", "colour", "colorway"],
  units: ["units", "qty", "quantity", "unit count"],
  target_launch: ["target launch", "launch", "launch date", "target"],
  received_3pl: ["received 3pl", "3pl", "received", "3pl date", "wh date", "warehouse date"],
};

function buildHeaderMap(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const h of headers) {
    const norm = h.trim().toLowerCase();
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (aliases.includes(norm) && !map[field]) map[field] = h;
    }
  }
  return map;
}

function toIso(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function toInt(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = parseInt(String(v).replace(/[^0-9-]/g, ""), 10);
  return isNaN(n) ? null : n;
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  let sheetRows: Record<string, unknown>[];
  let headers: string[];
  try {
    const buf = new Uint8Array(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    sheetRows = XLSX.utils.sheet_to_json(sheet, { defval: null });
    headers = (XLSX.utils.sheet_to_json(sheet, { header: 1 })[0] as string[]) ?? [];
  } catch (e) {
    return NextResponse.json({ error: `Could not parse spreadsheet: ${(e as Error).message}` }, { status: 400 });
  }
  if (sheetRows.length === 0) return NextResponse.json({ error: "The sheet has no rows" }, { status: 400 });

  const headerMap = buildHeaderMap(headers.map(String));
  const admin = createAdminClient();

  // Team lookup for fuzzy matching (by code and by name).
  const { data: teams } = await admin.from("teams").select("code, name");
  const byCode = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const t of teams ?? []) {
    byCode.set(t.code.toLowerCase(), t.code);
    byName.set(t.name.toLowerCase(), t.code);
  }
  function matchTeam(raw: string | null): string | null {
    if (!raw) return null;
    const v = raw.trim().toLowerCase();
    if (byCode.has(v)) return byCode.get(v)!;
    if (byName.has(v)) return byName.get(v)!;
    for (const [name, code] of byName) if (name.includes(v) || v.includes(name)) return code;
    return null;
  }

  const get = (row: Record<string, unknown>, field: string) =>
    headerMap[field] ? row[headerMap[field]] : null;

  let unmatched = 0;
  const rows = sheetRows.map((r) => {
    const team_raw = get(r, "team_raw") != null ? String(get(r, "team_raw")) : null;
    const team_code = matchTeam(team_raw);
    if (team_raw && !team_code) unmatched++;
    return {
      imported_by: guard.profile.id,
      po: get(r, "po") != null ? String(get(r, "po")) : null,
      status: get(r, "status") != null ? String(get(r, "status")) : null,
      licensing: get(r, "licensing") != null ? String(get(r, "licensing")) : null,
      team_raw,
      team_code,
      style: get(r, "style") != null ? String(get(r, "style")) : null,
      color: get(r, "color") != null ? String(get(r, "color")) : null,
      units: toInt(get(r, "units")),
      target_launch: toIso(get(r, "target_launch")),
      received_3pl: toIso(get(r, "received_3pl")),
    };
  });

  // Replace, don't accumulate.
  const { error: delErr } = await admin.from("inventory_snapshot").delete().neq("id", -1);
  if (delErr) return NextResponse.json({ error: `Clear failed: ${delErr.message}` }, { status: 500 });

  const { error: insErr } = await admin.from("inventory_snapshot").insert(rows);
  if (insErr) return NextResponse.json({ error: `Insert failed: ${insErr.message}` }, { status: 500 });

  return NextResponse.json({
    imported: rows.length,
    unmatched_teams: unmatched,
    mapped_columns: Object.keys(headerMap),
    unmapped_headers: headers.filter((h) => !Object.values(headerMap).includes(String(h))),
  });
}
