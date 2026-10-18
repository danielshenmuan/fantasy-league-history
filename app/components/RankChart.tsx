"use client";

import { tokens } from "@/lib/tokens";
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
import type { LeagueHistory } from "@/lib/types";
import { PALETTE } from "@/lib/palette";

type TooltipEntry = { dataKey?: string; value?: number; color?: string };
type RankTooltipProps = {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  managers: LeagueHistory["managers"];
};

function RankTooltip({ active, payload, label, managers }: RankTooltipProps) {
  if (!active || !payload?.length) return null;

  const sorted = [...payload]
    .filter((e) => e.value != null)
    .sort((a, b) => (a.value as number) - (b.value as number));

  return (
    <div className="bg-white border border-hairline rounded-[14px] px-3 py-2 text-xs">
      <p className="font-semibold text-ink mb-1">{label}</p>
      {sorted.map((entry) => {
        const manager = managers.find((m) => m.manager_guid === entry.dataKey);
        return (
          <div key={entry.dataKey} className="flex items-center gap-2">
            <span style={{ color: entry.color }} className="font-semibold w-4 text-right">
              {entry.value}
            </span>
            <span style={{ color: entry.color }}>{manager?.display_name ?? entry.dataKey}</span>
          </div>
        );
      })}
    </div>
  );
}

type Props = { history: LeagueHistory; allTime: boolean };

export default function RankChart({ history, allTime }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);

  const active = pinned ?? hovered;

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
            <CartesianGrid strokeDasharray="3 3" stroke={tokens.hairline} />
            <XAxis dataKey="year" stroke={tokens.ink} />
            <YAxis
              reversed
              domain={[1, history.num_teams]}
              ticks={Array.from({ length: history.num_teams }, (_, i) => i + 1)}
              label={{ value: "Final rank", angle: -90, position: "insideLeft", fill: tokens.ink }}
              stroke={tokens.ink}
            />
            <Tooltip
              content={(props) => (
                <RankTooltip {...(props as unknown as RankTooltipProps)} managers={history.managers} />
              )}
            />
            {visibleManagers.map((manager) => {
              const globalIdx = history.managers.findIndex((m) => m.manager_guid === manager.manager_guid);
              const isDimmed = active !== null && active !== manager.manager_guid;
              return (
                <Line
                  key={manager.manager_guid}
                  type="monotone"
                  dataKey={manager.manager_guid}
                  stroke={PALETTE[globalIdx % PALETTE.length]}
                  strokeWidth={active === manager.manager_guid ? 4 : 2}
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
          const isActive = active === manager.manager_guid;
          const isPinned = pinned === manager.manager_guid;
          return (
            <button
              key={manager.manager_guid}
              className="chip-filter gap-2"
              aria-pressed={isPinned}
              style={{ fontWeight: isActive ? 600 : 400 }}
              onClick={() => setPinned(isPinned ? null : manager.manager_guid)}
              onMouseEnter={() => setHovered(manager.manager_guid)}
              onMouseLeave={() => setHovered(null)}
            >
              <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
              {manager.display_name}
            </button>
          );
        })}
      </div>
    </div>
  );
}