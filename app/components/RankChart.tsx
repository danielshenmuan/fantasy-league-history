"use client";

import { useState, useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Link from "next/link";
import type { LeagueHistory } from "@/lib/types";
import { PALETTE } from "@/lib/palette";

type Props = { history: LeagueHistory; allTime: boolean };

export default function RankChart({ history, allTime }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  const lastSeason = history.seasons[history.seasons.length - 1];

  const currentGuids = useMemo(
    () => new Set(lastSeason?.standings.map((t) => t.manager_guid) ?? []),
    [lastSeason],
  );

  const visibleManagers = useMemo(
    () => allTime ? history.managers : history.managers.filter((m) => currentGuids.has(m.manager_guid)),
    [allTime, history.managers, currentGuids],
  );

  const data = history.seasons.map((season) => {
    const row: Record<string, number | string> = { year: season.year };
    for (const team of season.standings) {
      row[team.manager_guid] = team.final_rank;
    }
    return row;
  });


  return (
    <div className="w-full">
      <div className="h-[480px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 20, right: 10, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
            <XAxis dataKey="year" stroke="#14213D" />
            <YAxis
              reversed
              domain={[1, history.num_teams]}
              ticks={Array.from({ length: history.num_teams }, (_, i) => i + 1)}
              label={{ value: "Final rank", angle: -90, position: "insideLeft", fill: "#14213D" }}
              stroke="#14213D"
            />
            <Tooltip
              contentStyle={{ borderColor: "#E5E5E5", borderRadius: 8 }}
              formatter={(value, name) => {
                const manager = history.managers.find((m) => m.manager_guid === name);
                return [`Rank ${value}`, manager?.display_name ?? name];
              }}
            />
            {visibleManagers.map((manager) => {
              const globalIdx = history.managers.findIndex((m) => m.manager_guid === manager.manager_guid);
              const isDimmed = hovered !== null && hovered !== manager.manager_guid;
              return (
                <Line
                  key={manager.manager_guid}
                  type="monotone"
                  dataKey={manager.manager_guid}
                  stroke={PALETTE[globalIdx % PALETTE.length]}
                  strokeWidth={hovered === manager.manager_guid ? 4 : 2}
                  strokeOpacity={isDimmed ? 0.15 : 1}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  connectNulls
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 text-sm">
        {visibleManagers.map((manager) => {
          const globalIdx = history.managers.findIndex((m) => m.manager_guid === manager.manager_guid);
          const color = PALETTE[globalIdx % PALETTE.length];
          return (
            <Link
              key={manager.manager_guid}
              href={`/league/${history.league_key}/manager/${manager.manager_guid}`}
              className="px-3 py-1 rounded-full border border-[#E5E5E5] text-[#14213D] hover:border-[#FCA311] hover:text-[#FCA311] transition-colors"
              style={{
                borderLeftColor: color,
                borderLeftWidth: 4,
                fontWeight: hovered === manager.manager_guid ? 700 : 400,
              }}
              onMouseEnter={() => setHovered(manager.manager_guid)}
              onMouseLeave={() => setHovered(null)}
            >
              {manager.display_name}
            </Link>
          );
        })}
      </div>
    </div>
  );
}