import { NextResponse } from "next/server";
import { readCached } from "@/lib/cache";
import { getYahooClient } from "@/lib/yahoo/session-client";

export const maxDuration = 60;

type AnyObj = Record<string, any>;

function arr<T = AnyObj>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : fallback;
}

// ── Stat ID constants (standard Yahoo Fantasy Basketball) ────────────────────
// These are the most common IDs for NBA fantasy leagues. If your league uses
// custom stat IDs (some older game_keys differ), FG%/FT% contributions may
// read as 0 — the counting stats (PTS, REB, etc.) will still work correctly.
const S = {
  FGM: 6,   // Field goals made
  FGA: 7,   // Field goals attempted
  FTM: 8,   // Free throws made
  FTA: 9,   // Free throws attempted
  PTS: 12,  // Points
  REB: 15,  // Total rebounds
  AST: 16,  // Assists
  STL: 17,  // Steals
  BLK: 18,  // Blocks
  TO:  19,  // Turnovers (negated in score)
  THREE: 10, // 3-pointers made (stat_id 10 in most leagues; may be 11 in some)
};

// ── Player list extraction ───────────────────────────────────────────────────
// Yahoo returns players in two possible shapes:
//   1. Standard: node.player = [{...}, {...}]
//   2. Numbered keys: { "0": { player: [...] }, "1": { player: [...] }, count: N }
// Within each player, Yahoo sometimes wraps [metadata, {stats}] as an array;
// we merge array parts into a flat object for uniform downstream access.

function normalisedPlayer(raw: AnyObj | AnyObj[]): AnyObj {
  if (!Array.isArray(raw)) return raw;
  const merged: AnyObj = {};
  for (const part of raw) {
    if (part && typeof part === "object" && !Array.isArray(part)) {
      Object.assign(merged, part);
    }
  }
  return merged;
}

function extractPlayers(node: AnyObj): AnyObj[] {
  if (!node) return [];
  if (node.player !== undefined) return arr(node.player).map(normalisedPlayer);
  const count = num(node.count ?? node["@_count"]);
  if (count > 0) {
    const list: AnyObj[] = [];
    for (let i = 0; i < count; i++) {
      const entry = node[String(i)];
      if (entry?.player !== undefined) list.push(normalisedPlayer(entry.player));
    }
    return list;
  }
  return [];
}

function getStats(player: AnyObj): Record<number, number> {
  const result: Record<number, number> = {};
  for (const s of arr(player?.player_stats?.stats?.stat)) {
    result[num(s.stat_id)] = num(s.value);
  }
  return result;
}

function getName(player: AnyObj): string {
  return (
    player?.name?.full ??
    `${player?.name?.first ?? ""} ${player?.name?.last ?? ""}`.trim()
  );
}

// ── Z-score + volume-weighted percentage MVP computation ─────────────────────
//
// Category leagues have no single "fantasy points" total, so we build a
// composite score using two components:
//
// 1. Counting stat z-scores (PTS, REB, AST, STL, BLK, 3PM, TO)
//    z = (player_value - league_mean) / league_std
//    TO is negated (more turnovers = worse).
//
// 2. Volume-weighted FG% and FT% impact
//    FG impact = (player_FGM - player_FGA × league_avg_FG%) / std_of_impact
//    FT impact = (player_FTM - player_FTA × league_avg_FT%) / std_of_impact
//    A player who shoots 50% on 400 FGA in a 45%-FG% league contributes
//    +20 "extra makes" — this outweighs a 60%-shooter on 20 attempts.
//    Dividing by the std of impacts across all players puts it on the same
//    scale as the counting stat z-scores.

type PlayerData = { name: string; stats: Record<number, number> };

function computeZScore(
  teamPlayers: PlayerData[],
  leaguePlayers: PlayerData[],
): { player_name: string; z_score: number } | null {
  const vals = (id: number) => leaguePlayers.map((p) => p.stats[id] ?? 0);

  function distOf(values: number[]) {
    if (values.length === 0) return { mean: 0, std: 1 };
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
    return { mean, std: Math.sqrt(variance) || 1 };
  }

  // Pre-compute distributions for counting stats
  const countingStats: Array<{ id: number; negate: boolean }> = [
    { id: S.PTS, negate: false },
    { id: S.REB, negate: false },
    { id: S.AST, negate: false },
    { id: S.STL, negate: false },
    { id: S.BLK, negate: false },
    { id: S.THREE, negate: false },
    { id: S.TO,  negate: true  },
  ];
  const dists: Record<number, { mean: number; std: number }> = {};
  for (const { id } of countingStats) dists[id] = distOf(vals(id));

  // FG% and FT% volume-weighted z-scores:
  // z_fg_pct = (player_FG% − league_mean_FG%) / league_std_FG%
  // then multiply by (player_FGA / league_avg_FGA) so high-volume
  // shooters get more credit (and low-game players with few attempts
  // get proportionally less). Same logic for FT%.
  const fgPcts = leaguePlayers.map((p) =>
    (p.stats[S.FGA] ?? 0) > 0 ? (p.stats[S.FGM] ?? 0) / (p.stats[S.FGA] ?? 0) : 0,
  );
  const ftPcts = leaguePlayers.map((p) =>
    (p.stats[S.FTA] ?? 0) > 0 ? (p.stats[S.FTM] ?? 0) / (p.stats[S.FTA] ?? 0) : 0,
  );
  const fgPctDist = distOf(fgPcts);
  const ftPctDist = distOf(ftPcts);

  const fgaVals = vals(S.FGA);
  const ftaVals = vals(S.FTA);
  const meanFga = fgaVals.length > 0 ? fgaVals.reduce((a, b) => a + b, 0) / fgaVals.length : 1;
  const meanFta = ftaVals.length > 0 ? ftaVals.reduce((a, b) => a + b, 0) / ftaVals.length : 1;

  let bestName = "";
  let bestScore = -Infinity;

  for (const { name, stats } of teamPlayers) {
    if (!name) continue;

    // Counting stat z-scores (season totals; TO is negated so more TOs = lower score)
    let score = 0;
    for (const { id, negate } of countingStats) {
      const d = dists[id];
      const z = ((stats[id] ?? 0) - d.mean) / d.std;
      score += negate ? -z : z;
    }

    // Volume-weighted FG% z-score
    if (fgPctDist.std > 0 && meanFga > 0) {
      const playerFgPct = (stats[S.FGA] ?? 0) > 0 ? (stats[S.FGM] ?? 0) / (stats[S.FGA] ?? 0) : 0;
      const zFgPct = (playerFgPct - fgPctDist.mean) / fgPctDist.std;
      score += zFgPct * ((stats[S.FGA] ?? 0) / meanFga);
    }

    // Volume-weighted FT% z-score
    if (ftPctDist.std > 0 && meanFta > 0) {
      const playerFtPct = (stats[S.FTA] ?? 0) > 0 ? (stats[S.FTM] ?? 0) / (stats[S.FTA] ?? 0) : 0;
      const zFtPct = (playerFtPct - ftPctDist.mean) / ftPctDist.std;
      score += zFtPct * ((stats[S.FTA] ?? 0) / meanFta);
    }

    if (score > bestScore) {
      bestScore = score;
      bestName = name;
    }
  }

  if (!bestName) return null;
  return { player_name: bestName, z_score: Math.round(bestScore * 10) / 10 };
}

// ── Types ────────────────────────────────────────────────────────────────────

export type SeasonMVP = {
  year: number;
  team_name: string;
  player_name: string;
  z_score: number;
};

export type MVPResponse = {
  by_year: SeasonMVP[];
  all_time: SeasonMVP | null;
};

// ── Per-season fetch ─────────────────────────────────────────────────────────

async function fetchSeasonMVP(
  client: Awaited<ReturnType<typeof getYahooClient>>,
  league_key: string,
  team_key: string,
  year: number,
  team_name: string,
): Promise<SeasonMVP | null> {
  if (!client || !team_key) return null;
  try {
    // Two parallel calls:
    // 1. This team's players + stats (to score each player)
    // 2. ALL taken players in the league + stats (for normalization baseline)
    const [teamParsed, leagueParsed] = await Promise.all([
      client.get<AnyObj>(`/team/${team_key}/players;out=stats`),
      client.get<AnyObj>(`/league/${league_key}/players;status=T;count=200;out=stats`),
    ]);

    const teamPlayers = extractPlayers(
      (teamParsed?.fantasy_content?.team as AnyObj)?.players ?? {},
    );
    const leaguePlayers = extractPlayers(
      (leagueParsed?.fantasy_content?.league as AnyObj)?.players ?? {},
    );

    const toData = (ps: AnyObj[]): PlayerData[] =>
      ps.map((p) => ({ name: getName(p), stats: getStats(p) }));

    const mvp = computeZScore(toData(teamPlayers), toData(leaguePlayers));
    if (!mvp) return null;
    return { year, team_name, ...mvp };
  } catch {
    return null;
  }
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ league_key: string; manager_guid: string }> },
) {
  const { league_key, manager_guid } = await params;

  const history = await readCached(league_key);
  if (!history) {
    return NextResponse.json({ error: "league_not_cached" }, { status: 404 });
  }

  const client = await getYahooClient();
  if (!client) {
    return NextResponse.json({ error: "no_yahoo_client" }, { status: 503 });
  }

  const teamEntries = history.seasons
    .map((s) => {
      const team = s.standings.find((t) => t.manager_guid === manager_guid);
      if (!team?.team_key) return null;
      return {
        league_key: s.league_key,
        team_key: team.team_key,
        year: s.year,
        team_name: team.team_name,
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .sort((a, b) => a.year - b.year);

  if (teamEntries.length === 0) {
    return NextResponse.json<MVPResponse>({ by_year: [], all_time: null });
  }

  const results = await Promise.all(
    teamEntries.map((e) =>
      fetchSeasonMVP(client, e.league_key, e.team_key, e.year, e.team_name),
    ),
  );

  const by_year = results.filter((r): r is SeasonMVP => r !== null);
  const all_time = by_year.reduce<SeasonMVP | null>((best, cur) => {
    if (!best || cur.z_score > best.z_score) return cur;
    return best;
  }, null);

  return NextResponse.json<MVPResponse>({ by_year, all_time });
}