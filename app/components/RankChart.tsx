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

type Props = { history: LeagueHistory };

export default function RankChart({ history }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  const data = history.seasons.map((season) => {
    const row: Record<string, number | string> = { year: season.year };
    for (const team of season.standings) {
      row[team.manager_guid] = team.final_rank;
    }
    return row;
  });

  // For right-side labels: get each manager's rank in the last season
  const lastSeason = history.seasons[history.seasons.length - 1];
  const endLabels = useMemo(() => {
    if (!lastSeason) return [];
    return history.managers.map((manager, idx) => {
      const team = lastSeason.standings.find(
        (t) => t.manager_guid === manager.manager_guid,
      );
      return {
        guid: manager.manager_guid,
        name: manager.display_name,
        rank: team?.final_rank ?? null,
        color: PALETTE[idx % PALETTE.length],
      };
    }).filter((e) => e.rank !== null)
      .sort((a, b) => a.rank! - b.rank!);
  }, [history.managers, lastSeason]);

  return (
    <div className="w-full">
      <div className="flex">
        <div className="flex-1 h-[480px] min-w-0">
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
              {history.managers.map((manager, idx) => {
                const isDimmed = hovered !== null && hovered !== manager.manager_guid;
                return (
                  <Line
                    key={manager.manager_guid}
                    type="monotone"
                    dataKey={manager.manager_guid}
                    stroke={PALETTE[idx % PALETTE.length]}
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
        {/* Right-side labels aligned to last data point */}
        <div
          className="flex flex-col justify-between shrink-0 pl-2 text-xs"
          style={{ height: 480, paddingTop: 20, paddingBottom: 20 }}
        >
          {endLabels.map((label) => (
            <span
              key={label.guid}
              className="truncate max-w-[120px] cursor-pointer leading-tight"
              style={{ color: label.color, fontWeight: hovered === label.guid ? 700 : 400 }}
              onMouseEnter={() => setHovered(label.guid)}
              onMouseLeave={() => setHovered(null)}
            >
              {label.name}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-6 flex flex-wrap gap-2 text-sm">
        {history.managers.map((manager, idx) => (
          <Link
            key={manager.manager_guid}
            href={`/league/${history.league_key}/manager/${manager.manager_guid}`}
            className="px-3 py-1 rounded-full border border-[#E5E5E5] text-[#14213D] hover:border-[#FCA311] hover:text-[#FCA311] transition-colors"
            style={{
              borderLeftColor: PALETTE[idx % PALETTE.length],
              borderLeftWidth: 4,
            }}
          >
            {manager.display_name}
          </Link>
        ))}
      </div>
    </div>
  );
}
