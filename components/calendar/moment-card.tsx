"use client";

import { useApp } from "@/components/app-context";
import { CHANNELS, TYPE_LABEL } from "@/lib/constants";
import type { Moment } from "@/lib/types";

// Single-day event card, ported from the prototype's `.ev` markup.
// When the calendar is filtered to one team, only that team's spine/pip shows.
export function MomentCard({
  m,
  dim,
  teamFilter,
  onClick,
}: {
  m: Moment;
  dim: boolean;
  teamFilter: string;
  onClick: () => void;
}) {
  const { teamsByCode } = useApp();
  const color = (code: string) => teamsByCode[code]?.color ?? "#999";
  const show = teamFilter ? m.teams.filter((k) => k === teamFilter) : m.teams;

  return (
    <button className={`ev${dim ? " dim" : ""}`} data-type={m.type} onClick={onClick}>
      {show.length > 0 && (
        <div className="ev-spine">
          {show.slice(0, 8).map((k, i) => (
            <span key={`${k}-${i}`} style={{ background: color(k) }} />
          ))}
        </div>
      )}
      <div className="ev-t">{m.title || "Untitled"}</div>
      <div className="ev-m">{m.product_note || TYPE_LABEL[m.type]}</div>
      {show.length > 0 && (
        <div className="ev-teams">
          {show.slice(0, 3).map((k) => (
            <span key={k} className="pip">
              <i className="sq" style={{ background: color(k) }} />
              {k}
            </span>
          ))}
          {show.length > 3 && <span className="pip">+{show.length - 3}</span>}
        </div>
      )}
      <div className="ev-ch">
        {CHANNELS.map((c) => (
          <i key={c} data-ch={c} className={m.channels.includes(c) ? "on" : ""} />
        ))}
      </div>
    </button>
  );
}
