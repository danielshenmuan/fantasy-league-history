import { notFound } from "next/navigation";
import Link from "next/link";
import { loadLeagueHistory } from "@/lib/data";
import ManagerCharts from "@/app/components/ManagerCharts";

type Params = { league_key: string; manager_guid: string };

export default async function ManagerPage({ params }: { params: Promise<Params> }) {
  const { league_key, manager_guid } = await params;
  const history = await loadLeagueHistory(league_key);
  if (!history) notFound();
  const manager = history.managers.find((m) => m.manager_guid === manager_guid);
  if (!manager) notFound();

  const seasons = history.seasons
    .map((s) => {
      const team = s.standings.find((t) => t.manager_guid === manager_guid);
      if (!team) return null;
      const leagueAvg =
        s.standings.reduce((acc, t) => acc + t.points_for, 0) /
        (s.standings.length || 1);
      return {
        year: s.year,
        rank: team.final_rank,
        wins: team.wins,
        losses: team.losses,
        points_for: team.points_for,
        league_avg: Math.round(leagueAvg),
        team_name: team.team_name,
        playoff_result: team.playoff_result,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const bestFinish = seasons.length ? Math.min(...seasons.map((s) => s.rank)) : null;
  const worstFinish = seasons.length ? Math.max(...seasons.map((s) => s.rank)) : null;
  const championships = seasons.filter((s) => s.playoff_result === "champion").length;
  const playoffAppearances = seasons.filter((s) => s.playoff_result !== "none").length;
  const totalWins = seasons.reduce((acc, s) => acc + s.wins, 0);
  const totalLosses = seasons.reduce((acc, s) => acc + s.losses, 0);

  return (
    <main className="min-h-screen bg-white text-[#000000]">
      <div className="max-w-5xl mx-auto p-6 space-y-10">
        <div>
          <Link
            href={`/league/${league_key}`}
            className="text-sm text-[#FCA311] hover:underline"
          >
            ← Back to league
          </Link>
        </div>
        <header className="space-y-1">
          <h1 className="text-3xl font-bold text-[#14213D]">{manager.display_name}</h1>
          <p className="text-[#14213D]/70">
            {manager.first_season}–{manager.last_season} · {history.league_name}
          </p>
          {manager.historical_names.length > 1 && (
            <p className="text-xs text-[#14213D]/50">
              Also known as: {manager.historical_names.join(", ")}
            </p>
          )}
        </header>

        <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Stat label="Best finish" value={bestFinish ?? "—"} />
          <Stat label="Worst finish" value={worstFinish ?? "—"} />
          <Stat label="Championships" value={championships} />
          <Stat label="Playoff apps" value={playoffAppearances} />
          <Stat label="All-time W–L" value={`${totalWins}–${totalLosses}`} />
        </section>

        <ManagerCharts seasons={seasons} />
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-4 rounded-lg border border-[#E5E5E5] bg-white">
      <div className="text-xs uppercase tracking-wide text-[#14213D]/60">{label}</div>
      <div className="text-2xl font-semibold mt-1 text-[#14213D]">{value}</div>
    </div>
  );
}
