"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { LeagueHistory } from "@/lib/types";
import type { MVPResponse, PlayerStats } from "@/app/api/leagues/[league_key]/manager/[manager_guid]/stats/route";
import { getCachedHistory, setCachedHistory } from "@/lib/league-cache";
import ManagerCharts from "@/app/components/ManagerCharts";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[14px] bg-parchment p-4">
      <div className="text-xs text-ink-80">{label}</div>
      <div className="title-2 mt-1 text-ink">{value}</div>
    </div>
  );
}

function StatLine({ s, inline }: { s: PlayerStats; inline?: boolean }) {
  const pct = (v: number | null) => v != null ? `${v}%` : null;
  const items: string[] = [
    s.gp > 0 ? `${s.gp} GP` : "",
    `${s.pts} PTS`,
    `${s.reb} REB`,
    `${s.ast} AST`,
    `${s.stl} STL`,
    `${s.blk} BLK`,
    `${s.three_pm} 3PM`,
    `${s.to} TO`,
    pct(s.fg_pct) ? `${pct(s.fg_pct)} FG` : "",
    pct(s.ft_pct) ? `${pct(s.ft_pct)} FT` : "",
  ].filter(Boolean);
  return (
    <>
      <div className="hidden sm:block text-[10px] text-ink-48 mt-0.5 leading-tight">
        {items.join(" · ")}
      </div>
      {!inline && (
        <div className="sm:hidden flex flex-col text-[10px] text-ink-48 mt-1 leading-relaxed">
          {items.map((item, i) => <span key={i}>{item}</span>)}
        </div>
      )}
    </>
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
      <main className="flex-1 flex items-center justify-center bg-white">
        <div className="text-center space-y-3">
          <p className="text-ink font-semibold">Manager not found</p>
          <Link href={`/league/${league_key}`} className="text-primary hover:underline text-sm">&lsaquo; Back to league</Link>
        </div>
      </main>
    );
  }

  if (loading || !history) {
    return (
      <main className="flex-1 flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  const manager = history.managers.find((m) => m.manager_guid === manager_guid);
  if (!manager) {
    return (
      <main className="flex-1 flex items-center justify-center bg-white">
        <div className="text-center space-y-3">
          <p className="text-ink font-semibold">Manager not found</p>
          <Link href={`/league/${league_key}`} className="text-primary hover:underline text-sm">&lsaquo; Back to league</Link>
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
    <main className="flex-1 text-ink">
      <div className="max-w-5xl mx-auto space-y-16 px-6 pb-24 pt-8">
        <div>
          <Link href={`/league/${league_key}`} className="callout text-primary">
            &lsaquo; Back to league
          </Link>
        </div>
        <header className="space-y-1">
          <h1 className="title-1 text-ink">{manager.display_name}</h1>
          <p className="text-ink-80">
            {manager.first_season}–{manager.last_season} · {history.league_name}
          </p>
          {manager.historical_names.length > 1 && (
            <p className="text-xs text-ink-48">
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
          <h2 className="title-2 text-ink">Season MVP</h2>
          {mvpLoading ? (
            <div className="flex items-center gap-2 text-sm text-ink-48">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Loading player stats…
            </div>
          ) : !mvp || mvp.by_year.length === 0 ? (
            <p className="text-sm text-ink-48 italic">No player data available.</p>
          ) : (
            <div className="space-y-4">
              {mvp.all_time && (
                <div className="rounded-[20px] bg-parchment p-5">
                  <div className="text-xs text-ink-80 mb-1">All-time best season</div>
                  <div className="flex items-center gap-3">
                    {mvp.all_time.player_image_url && (
                      <img
                        src={mvp.all_time.player_image_url}
                        alt={mvp.all_time.player_name}
                        className="w-12 h-12 rounded-full object-cover object-top border border-hairline shrink-0"
                      />
                    )}
                    <div>
                      <div className="headline text-ink">{mvp.all_time.player_name}</div>
                      <div className="text-sm text-ink-80">
                        Fantasy Rating {mvp.all_time.z_score > 0 ? "+" : ""}{mvp.all_time.z_score} · {mvp.all_time.year} · {mvp.all_time.team_name}
                      </div>
                      <StatLine s={mvp.all_time.player_stats} inline />
                    </div>
                  </div>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left text-xs text-ink-48 border-b border-hairline">
                      <th className="pb-2 pr-4">Season</th>
                      <th className="pb-2 pr-4">Team</th>
                      <th className="pb-2 pr-4">MVP Player</th>
                      <th className="pb-2 text-right">Fantasy Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...mvp.by_year].reverse().map((row) => (
                      <tr key={row.year} className="border-b border-divider-soft">
                        <td className="py-2 pr-4 text-ink font-semibold">{row.year}</td>
                        <td className="py-2 pr-4 text-ink-80">{row.team_name}</td>
                        <td className="py-2 pr-4">
                          <div className="flex items-center gap-2">
                            {row.player_image_url && (
                              <img
                                src={row.player_image_url}
                                alt={row.player_name}
                                className="w-8 h-8 rounded-full object-cover object-top border border-hairline shrink-0"
                              />
                            )}
                            <div>
                              <div className="text-ink">{row.player_name}</div>
                              <StatLine s={row.player_stats} />
                            </div>
                          </div>
                        </td>
                        <td className="py-2 text-right tabular-nums text-ink-80 align-top">
                          <div>{row.z_score > 0 ? "+" : ""}{row.z_score}</div>
                          {row.intra_team && (
                            <div className="text-[10px] text-ink-48">vs. roster</div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-ink-48 pt-1">
                Showing seasons from 2022 onwards · Stats shown as per-game averages ·
                Fantasy Rating = sum of z-scores across PTS, REB, AST, STL, BLK, 3PM, TO (negated),
                plus volume-weighted FG% and FT% vs. all leaguemates that season.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}