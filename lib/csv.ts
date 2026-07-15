import type { Moment } from "@/lib/types";
import { TYPE_LABEL } from "@/lib/constants";

// CSV export. Takes already-filtered rows so the export always matches what's
// on screen. teamName resolves a code to its display name.
export function toCsv(rows: Moment[], teamName: (code: string) => string): string {
  const head = [
    "Date",
    "End date",
    "Type",
    "Moment",
    "Teams",
    "Paid",
    "Email",
    "SMS",
    "Banner",
    "Owner",
    "Product / units",
    "Licensing",
    "Notes",
  ];
  const q = (s: unknown) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const lines = [head.map(q).join(",")];
  for (const e of rows) {
    lines.push(
      [
        e.date,
        e.end_date ?? "",
        TYPE_LABEL[e.type],
        e.title,
        e.teams.map(teamName).join("; "),
        e.channels.includes("paid") ? "X" : "",
        e.channels.includes("email") ? "X" : "",
        e.channels.includes("sms") ? "X" : "",
        e.channels.includes("banner") ? "X" : "",
        e.owner ?? "",
        e.product_note ?? "",
        e.licensing,
        e.notes ?? "",
      ]
        .map(q)
        .join(","),
    );
  }
  return lines.join("\n");
}

export function downloadCsv(csv: string, filename = "kadyluxe_season_calendar.csv") {
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
