"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { LeagueHistory } from "@/lib/types";
import type { MVPResponse } from "@/app/api/leagues/[league_key]/manager/[manager_guid]/stats/route";
import { getCachedHistory, setCachedHistory } from "@/lib/league-cache";
import ManagerCharts from "@/app/components/ManagerCharts";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-4 rounded-lg border border-[#E5E5E5] bg-white">
      <div className="text-xs uppercase tracking-wide text-[#14213D]/60">{label}</div>
      <div className="text-2xl font-semibold mt-1 text-[#14213D]">{value}</div>
    </div>
  );
}

export default function ManagerPage() {
  const { league_key, manager_guid } = useParams<{ league_key: string; manager_guid: string }>();
  const [history, setHistory] = useState<LeagueHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [mvp, setMvp] = useState<MVPResponse | null>(null);
  const [mvpLoading, setMvpLoading] = useState(false);

  useEffect(() => {
    if (!league_key || !manager_guid) return;
    let cancelled = false;

    async function load() {
      // Try sessionStorage first — instant navigation from league page
      let data = getCachedHistory(league_key);
      if (!data) {
        // Fetch if not cached (e.g. direct link)
        const res = await fetch(`/api/leagues/${encodeURIComponent(league_key)}`);
        if (!res.ok) { if (!cancelled) setNotFound(true); return; }
        data = await res.json();
        setCachedHistory(data!);
      }
      if (cancelled) return;
      setHistory(data);
      setLoading(false);
    }

    load().catch(() => { if (!cancelled) setNotFound(true); });
    return () => { cancelled = true; };
  }, [league_key, manager_guid]);

  useEffect(() => {
    if (!league_key || !manager_guid) return;
    let cancelled = false;
    setMvpLoading(true);
    fetch(`/api/leagues/${encodeURIComponent(league_key)}/manager/${encodeURIComponent(manager_guid)}/stats`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (!cancelled) { setMvp(data); setMvpLoading(false); } })
      .catch(() => { if (!cancelled) setMvpLoading(false); });
    return () => { cancelled = true; };
  }, [league_key, manager_guid]);

  if (notFound) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center space-y-3">
          <p className="text-[#14213D] font-semibold">Manager not found</p>
          <Link href={`/league/${league_key}`} className="text-[#FCA311] hover:underline text-sm">← Back to league</Link>
        </div>
      </main>
    );
  }

  if (loading || !history) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-4 border-[#FCA311] border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  const manager = history.managers.find((m) => m.manager_guid === manager_guid);
  if (!manager) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center space-y-3">
          <p className="text-[#14213D] font-semibold">Manager not found</p>
          <Link href={`/league/${league_key}`} className="text-[#FCA311] hover:underline text-sm">← Back to league</Link>
        </div>
      </main>
    );
  }

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
          <Link href={`/league/${league_key}`} className="text-sm text-[#FCA311] hover:underline">
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

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-[#14213D]">Season MVP</h2>
          {mvpLoading ? (
            <div className="flex items-center gap-2 text-sm text-[#14213D]/50">
              <div className="w-4 h-4 border-2 border-[#FCA311] border-t-transparent rounded-full animate-spin" />
              Loading player stats…
            </div>
          ) : !mvp || mvp.by_year.length === 0 ? (
            <p className="text-sm text-[#14213D]/50 italic">No player data available.</p>
          ) : (
            <div className="space-y-4">
              {mvp.all_time && (
                <div className="p-4 rounded-lg border border-[#FCA311]/40 bg-[#FCA311]/5">
                  <div className="text-xs uppercase tracking-wide text-[#14213D]/60 mb-1">All-time best season</div>
                  <div className="text-lg font-semibold text-[#14213D]">{mvp.all_time.player_name}</div>
                  <div className="text-sm text-[#14213D]/60">
                    Fantasy Rating {mvp.all_time.z_score > 0 ? "+" : ""}{mvp.all_time.z_score} · {mvp.all_time.year} · {mvp.all_time.team_name}
                  </div>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-[#14213D]/50 border-b border-[#E5E5E5]">
                      <th className="pb-2 pr-4">Season</th>
                      <th className="pb-2 pr-4">Team</th>
                      <th className="pb-2 pr-4">MVP Player</th>
                      <th className="pb-2 text-right">Fantasy Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...mvp.by_year].reverse().map((row) => (
                      <tr key={row.year} className="border-b border-[#E5E5E5]/60">
                        <td className="py-2 pr-4 text-[#14213D] font-medium">{row.year}</td>
                        <td className="py-2 pr-4 text-[#14213D]/70">{row.team_name}</td>
                        <td className="py-2 pr-4 text-[#14213D]">{row.player_name}</td>
                        <td className="py-2 text-right tabular-nums text-[#14213D]/70">
                          {row.z_score > 0 ? "+" : ""}{row.z_score}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-[#14213D]/40 pt-1">
                Fantasy Rating = sum of z-scores across PTS, REB, AST, STL, BLK, 3PM, TO (negated),
                plus volume-weighted FG% and FT% vs. all leaguemates that season. Based on season totals —
                players with fewer games played score lower. For category leagues, this is not a fantasy
                points total; it measures how much each stat exceeded the league average.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}