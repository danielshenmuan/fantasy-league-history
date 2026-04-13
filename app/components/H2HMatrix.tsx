"use client";

import { useState } from "react";
import type { LeagueHistory } from "@/lib/types";
import { PALETTE } from "@/lib/palette";

type Props = { history: LeagueHistory; allTime: boolean };

export default function H2HMatrix({ history, allTime }: Props) {
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const { h2h } = history;

  const lastSeason = history.seasons[history.seasons.length - 1];
  const currentGuids = new Set(lastSeason?.standings.map((t) => t.manager_guid) ?? []);

  // Filter + sort managers
  const managers = allTime
    ? [...history.managers].sort((a, b) => b.last_season - a.last_season || a.first_season - b.first_season)
    : history.managers.filter((m) => currentGuids.has(m.manager_guid))
        .sort((a, b) => {
          const ra = lastSeason?.standings.find((t) => t.manager_guid === a.manager_guid)?.final_rank ?? 99;
          const rb = lastSeason?.standings.find((t) => t.manager_guid === b.manager_guid)?.final_rank ?? 99;
          return ra - rb;
        });

  // Check if we have any H2H data at all
  const hasData = managers.some((m) =>
    managers.some((o) => {
      if (o.manager_guid === m.manager_guid) return false;
      const r = h2h[m.manager_guid]?.[o.manager_guid];
      return r && (r.wins + r.losses + r.ties) > 0;
    }),
  );

  if (!hasData) {
    return (
      <p className="text-sm text-[#14213D]/50 italic">
        No head-to-head matchup data available for this league.
      </p>
    );
  }

  const colorByGuid = Object.fromEntries(
    history.managers.map((m, i) => [m.manager_guid, PALETTE[i % PALETTE.length]]),
  );

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse w-full">
        <thead>
          <tr>
            {/* top-left corner cell */}
            <th className="p-2 text-left text-[#14213D]/40 font-normal min-w-[100px]">
              ↓ vs →
            </th>
            {managers.map((opp) => (
              <th
                key={opp.manager_guid}
                className="p-2 text-center font-semibold cursor-pointer select-none whitespace-nowrap"
                style={{ color: colorByGuid[opp.manager_guid] }}
                onMouseEnter={() => setHighlighted(opp.manager_guid)}
                onMouseLeave={() => setHighlighted(null)}
              >
                {opp.display_name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {managers.map((row) => {
            const isRowHighlighted = highlighted === row.manager_guid;
            return (
              <tr
                key={row.manager_guid}
                className="transition-colors"
                style={{ backgroundColor: isRowHighlighted ? "#FCA31115" : undefined }}
                onMouseEnter={() => setHighlighted(row.manager_guid)}
                onMouseLeave={() => setHighlighted(null)}
              >
                {/* Row label */}
                <td
                  className="p-2 font-semibold whitespace-nowrap"
                  style={{ color: colorByGuid[row.manager_guid] }}
                >
                  {row.display_name}
                </td>
                {managers.map((col) => {
                  const isColHighlighted = highlighted === col.manager_guid;
                  const isSelf = row.manager_guid === col.manager_guid;

                  if (isSelf) {
                    return (
                      <td
                        key={col.manager_guid}
                        className="p-2 text-center"
                        style={{ backgroundColor: "#14213D10" }}
                      >
                        <span className="text-[#14213D]/20">—</span>
                      </td>
                    );
                  }

                  const record = h2h[row.manager_guid]?.[col.manager_guid];
                  const w = record?.wins ?? 0;
                  const l = record?.losses ?? 0;
                  const t = record?.ties ?? 0;
                  const total = w + l + t;
                  const winRate = total > 0 ? w / total : null;

                  // Color intensity: green tint when winning, red tint when losing
                  let cellBg = "transparent";
                  if (winRate !== null) {
                    if (winRate > 0.5) cellBg = `rgba(34,197,94,${(winRate - 0.5) * 0.4})`;
                    else if (winRate < 0.5) cellBg = `rgba(239,68,68,${(0.5 - winRate) * 0.4})`;
                  }

                  const isActive = isRowHighlighted || isColHighlighted;

                  return (
                    <td
                      key={col.manager_guid}
                      className="p-2 text-center tabular-nums transition-colors"
                      style={{
                        backgroundColor: isActive ? cellBg || "#FCA31108" : cellBg,
                        outline: isRowHighlighted && isColHighlighted ? "1px solid #FCA311" : undefined,
                      }}
                    >
                      {total === 0 ? (
                        <span className="text-[#14213D]/20">–</span>
                      ) : (
                        <span className={winRate !== null && winRate > 0.5 ? "font-semibold text-[#14213D]" : "text-[#14213D]/70"}>
                          {w}–{l}{t > 0 ? `–${t}` : ""}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-[#14213D]/40">
        Read across each row: e.g. row "Alice" / col "Bob" = Alice's record against Bob.
        Green = winning record, red = losing record.
      </p>
    </div>
  );
}