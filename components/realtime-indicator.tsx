"use client";

import { useApp } from "@/components/app-context";

// Small transient pill: "Savannah updated this — refreshed". Only shows for
// changes made by someone other than the current user (self-echo is silent).
export function RealtimeIndicator({ otherEditorId }: { otherEditorId: string | null }) {
  const { memberName } = useApp();
  if (!otherEditorId) return null;
  return (
    <div className="fixed left-1/2 bottom-6 -translate-x-1/2 z-[60] bg-ink text-paper px-4 py-2 text-[12.5px] flex items-center gap-2 shadow-none">
      <span className="w-1.5 h-1.5 rounded-full bg-ch-email inline-block" />
      {memberName(otherEditorId)} updated this — refreshed
    </div>
  );
}
