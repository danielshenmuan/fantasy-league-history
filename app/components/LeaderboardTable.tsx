"use client";

import { useState } from "react";
import Link from "next/link";
import type { LeagueHistory, ManagerStats } from "@/lib/types";
import { PALETTE } from "@/lib/palette";

type SortKey = keyof Pick<
  ManagerStats,
  | "seasons_played"
  | "total_wins"
  | "win_rate"
  | "championships"
  | "last_places"
  | "avg_finish"
  | "total_points_for"
>;

const COLS: { key: SortKey; label: string; title: string; format: (v: ManagerStats) => string }[] = [
  { key: "championships",    label: "🏆",  title: "Championships",      format: (m) => String(m.championships) },
  { key: "seasons_played",   label: "Seasons", title: "Seasons played", format: (m) => String(m.seasons_played) },
  { key: "total_wins",       label: "W",   title: "All-time wins",      format: (m) => String(m.total_wins) },
  { key: "win_rate",         label: "Win%", title: "Win rate",          format: (m) => `${(m.win_rate * 100).toFixed(1)}%` },
  { key: "avg_finish",       label: "Avg Finish", title: "Avg finishing position (lower = better)", format: (m) => m.avg_finish > 0 ? m.avg_finish.toFixed(1) : "–" },
  { key: "last_places",      label: "🚽",  title: "Last-place finishes", format: (m) => String(m.last_places) },
  { key: "total_points_for", label: "Pts For", title: "Total points scored", format: (m) => m.total_points_for > 0 ? m.total_points_for.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "–" },
];

type Props = { history: LeagueHistory };

export default function LeaderboardTable({ history }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("championships");
  const [sortAsc, setSortAsc] = useState(false);

  const colorByGuid = Object.fromEntries(
    history.managers.map((m, i) => [m.manager_guid, PALETTE[i % PALETTE.length]]),
  );

  const sorted = [...history.leaderboard].sort((a, b) => {
    let diff = 0;
    if (sortKey === "avg_finish") {
      // lower avg finish = better, so invert
      diff = a.avg_finish - b.avg_finish;
    } else {
      diff = (b[sortKey] as number) - (a[sortKey] as number);
    }
    return sortAsc ? -diff : diff;
  });

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-[#E5E5E5]">
            <th className="text-left py-2 px-3 font-semibold text-[#14213D]/60 w-6">#</th>
            <th className="text-left py-2 px-3 font-semibold text-[#14213D]">Manager</th>
            {COLS.map((col) => (
              <th
                key={col.key}
                title={col.title}
                onClick={() => handleSort(col.key)}
                className="py-2 px-3 text-right font-semibold text-[#14213D] cursor-pointer select-none hover:text-[#FCA311] whitespace-nowrap transition-colors"
              >
                {col.label}
                {sortKey === col.key && (
                  <span className="ml-1 text-[#FCA311]">{sortAsc ? "↑" : "↓"}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, idx) => {
            const manager = history.managers.find((m) => m.manager_guid === row.manager_guid);
            if (!manager) return null;
            const color = colorByGuid[row.manager_guid];
            return (
              <tr
                key={row.manager_guid}
                className="border-b border-[#E5E5E5]/60 hover:bg-[#FCA311]/5 transition-colors"
              >
                <td className="py-2 px-3 text-[#14213D]/40 tabular-nums">{idx + 1}</td>
                <td className="py-2 px-3">
                  <Link
                    href={`/league/${history.league_key}/manager/${row.manager_guid}`}
                    className="font-semibold hover:underline"
                    style={{ color }}
                  >
                    {manager.display_name}
                  </Link>
                  {row.championships > 0 && (
                    <span className="ml-1 text-xs">{"🏆".repeat(Math.min(row.championships, 4))}</span>
                  )}
                </td>
                {COLS.map((col) => (
                  <td
                    key={col.key}
                    className="py-2 px-3 text-right tabular-nums text-[#14213D]"
                    style={{ fontWeight: sortKey === col.key ? 600 : 400 }}
                  >
                    {col.format(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-[#14213D]/40">Click a column header to sort.</p>
    </div>
  );
}