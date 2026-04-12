import type { LeagueHistory } from "@/lib/types";

type Props = { history: LeagueHistory };

function nameFor(history: LeagueHistory, guid: string | null, year: number): string {
  if (!guid) return "—";
  const season = history.seasons.find((s) => s.year === year);
  const team = season?.standings.find((t) => t.manager_guid === guid);
  const manager = history.managers.find((m) => m.manager_guid === guid);
  if (!team && !manager) return "—";
  const name = manager?.display_name ?? "Unknown";
  return team ? `${name} (${team.team_name})` : name;
}

export default function TrophyCase({ history }: Props) {
  const ordered = [...history.seasons].sort((a, b) => b.year - a.year);
  return (
    <div className="overflow-x-auto rounded-lg border border-[#E5E5E5]">
      <table className="min-w-full text-sm">
        <thead className="bg-[#14213D] text-white">
          <tr className="text-left">
            <th className="py-3 px-4">Year</th>
            <th className="py-3 px-4">🏆 Champion</th>
            <th className="py-3 px-4">👑 Regular season #1</th>
            <th className="py-3 px-4">🚽 Last place</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((season, idx) => (
            <tr
              key={season.year}
              className={`border-t border-[#E5E5E5] ${idx % 2 === 1 ? "bg-[#E5E5E5]/30" : "bg-white"}`}
            >
              <td className="py-3 px-4 font-mono text-[#14213D]">{season.year}</td>
              <td className="py-3 px-4 text-[#000000]">
                {nameFor(history, season.champion_guid, season.year)}
              </td>
              <td className="py-3 px-4 text-[#000000]">
                {nameFor(history, season.regular_season_winner_guid, season.year)}
              </td>
              <td className="py-3 px-4 text-[#000000]">
                {nameFor(history, season.last_place_guid, season.year)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
