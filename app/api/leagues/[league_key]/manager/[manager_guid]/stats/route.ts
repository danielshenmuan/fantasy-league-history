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
  GP:     0,   // Games played
  FGM:    6,   // Field goals made
  FGA:    7,   // Field goals attempted
  FTM:    8,   // Free throws made
  FTA:    9,   // Free throws attempted
  THREE:  10,  // 3-pointers made (stat_id 10 in most leagues; may be 11 in some)
  FG_PCT: 11,  // FG% direct (Yahoo stores as decimal 0.469; fallback to FGM/FGA)
  PTS:    12,  // Points
  FT_PCT: 13,  // FT% direct (Yahoo stores as decimal; fallback to FTM/FTA)
  REB:    15,  // Total rebounds
  AST:    16,  // Assists
  STL:    17,  // Steals
  BLK:    18,  // Blocks
  TO:     19,  // Turnovers (negated in score)
};

// Only fetch MVP data for seasons from 2022 onwards — older Yahoo league keys
// often return empty player lists, producing no useful data.
const SEASON_CUTOFF = 2022;

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

function getImageUrl(player: AnyObj): string | null {
  return player?.image_url ?? player?.headshot?.url ?? null;
}

// ── Types ────────────────────────────────────────────────────────────────────

export type PlayerStats = {
  gp: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  three_pm: number;
  to: number;
  fg_pct: number | null;
  ft_pct: number | null;
};

export type SeasonMVP = {
  year: number;
  team_name: string;
  player_name: string;
  player_image_url: string | null;
  z_score: number;
  player_stats: PlayerStats;
  /** true when league-wide player data was unavailable and z-score is vs. roster only */
  intra_team?: boolean;
};

export type MVPResponse = {
  by_year: SeasonMVP[];
  all_time: SeasonMVP | null;
};

// ── Z-score computation ──────────────────────────────────────────────────────
//
// Composite score = sum of 9 components:
//   1–7. Counting stat z-scores: PTS, REB, AST, STL, BLK, 3PM, TO (TO negated)
//        z = (player_season_total − league_mean) / league_std
//   8–9. Volume-weighted percentage z-scores for FG% and FT%:
//        z_fg% × (player_FGA / league_avg_FGA)
//        A player shooting above average on high volume gets more credit.
//
// All stats are season totals — fewer games played = naturally lower totals.
// If leaguePlayers is empty (old seasons where Yahoo doesn't return data),
// falls back to intra-team normalization and marks intra_team = true.

type PlayerData = { name: string; image_url: string | null; stats: Record<number, number> };

function computeZScore(
  teamPlayers: PlayerData[],
  leaguePlayers: PlayerData[],
): { player_name: string; player_image_url: string | null; z_score: number; player_stats: PlayerStats } | null {
  // Fall back to intra-team normalization if no league data available
  const baseline = leaguePlayers.length > 0 ? leaguePlayers : teamPlayers;

  const vals = (id: number) => baseline.map((p) => p.stats[id] ?? 0);

  function distOf(values: number[]) {
    if (values.length === 0) return { mean: 0, std: 1 };
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
    return { mean, std: Math.sqrt(variance) || 1 };
  }

  const countingStats: Array<{ id: number; negate: boolean }> = [
    { id: S.PTS,   negate: false },
    { id: S.REB,   negate: false },
    { id: S.AST,   negate: false },
    { id: S.STL,   negate: false },
    { id: S.BLK,   negate: false },
    { id: S.THREE, negate: false },
    { id: S.TO,    negate: true  },
  ];
  const dists: Record<number, { mean: number; std: number }> = {};
  for (const { id } of countingStats) dists[id] = distOf(vals(id));

  const fgPcts = baseline.map((p) =>
    (p.stats[S.FGA] ?? 0) > 0 ? (p.stats[S.FGM] ?? 0) / (p.stats[S.FGA] ?? 0) : 0,
  );
  const ftPcts = baseline.map((p) =>
    (p.stats[S.FTA] ?? 0) > 0 ? (p.stats[S.FTM] ?? 0) / (p.stats[S.FTA] ?? 0) : 0,
  );
  const fgPctDist = distOf(fgPcts);
  const ftPctDist = distOf(ftPcts);

  const fgaVals = vals(S.FGA);
  const ftaVals = vals(S.FTA);
  const meanFga = fgaVals.length > 0 ? fgaVals.reduce((a, b) => a + b, 0) / fgaVals.length : 1;
  const meanFta = ftaVals.length > 0 ? ftaVals.reduce((a, b) => a + b, 0) / ftaVals.length : 1;

  let bestName = "";
  let bestImageUrl: string | null = null;
  let bestScore = -Infinity;
  let bestRawStats: Record<number, number> = {};

  for (const { name, image_url, stats } of teamPlayers) {
    if (!name) continue;

    let score = 0;
    for (const { id, negate } of countingStats) {
      const d = dists[id];
      const z = ((stats[id] ?? 0) - d.mean) / d.std;
      score += negate ? -z : z;
    }
    if (fgPctDist.std > 0 && meanFga > 0) {
      const playerFgPct = (stats[S.FGA] ?? 0) > 0 ? (stats[S.FGM] ?? 0) / (stats[S.FGA] ?? 0) : 0;
      score += ((playerFgPct - fgPctDist.mean) / fgPctDist.std) * ((stats[S.FGA] ?? 0) / meanFga);
    }
    if (ftPctDist.std > 0 && meanFta > 0) {
      const playerFtPct = (stats[S.FTA] ?? 0) > 0 ? (stats[S.FTM] ?? 0) / (stats[S.FTA] ?? 0) : 0;
      score += ((playerFtPct - ftPctDist.mean) / ftPctDist.std) * ((stats[S.FTA] ?? 0) / meanFta);
    }

    if (score > bestScore) {
      bestScore = score;
      bestName = name;
      bestImageUrl = image_url;
      bestRawStats = stats;
    }
  }

  if (!bestName) return null;

  const gp  = bestRawStats[S.GP]  > 0 ? bestRawStats[S.GP]  : 1;
  const fga = bestRawStats[S.FGA] ?? 0;
  const fta = bestRawStats[S.FTA] ?? 0;

  // Per-game helper — round to 1 decimal
  const pg = (id: number) => Math.round((bestRawStats[id] ?? 0) / gp * 10) / 10;

  // FG%/FT%: try direct stat (stored as decimal 0.0–1.0) first, then compute
  const toPct = (direct: number, made: number, att: number): number | null => {
    if (direct > 0) return Math.round((direct <= 1 ? direct : direct / 100) * 1000) / 10;
    return att > 0 ? Math.round(made / att * 1000) / 10 : null;
  };

  return {
    player_name: bestName,
    player_image_url: bestImageUrl,
    z_score: Math.round(bestScore * 10) / 10,
    player_stats: {
      gp:       bestRawStats[S.GP]    ?? 0,
      pts:      pg(S.PTS),
      reb:      pg(S.REB),
      ast:      pg(S.AST),
      stl:      pg(S.STL),
      blk:      pg(S.BLK),
      three_pm: pg(S.THREE),
      to:       pg(S.TO),
      fg_pct:   toPct(bestRawStats[S.FG_PCT] ?? 0, bestRawStats[S.FGM] ?? 0, fga),
      ft_pct:   toPct(bestRawStats[S.FT_PCT] ?? 0, bestRawStats[S.FTM] ?? 0, fta),
    },
  };
}

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
      ps.map((p) => ({ name: getName(p), image_url: getImageUrl(p), stats: getStats(p) }));

    const teamData = toData(teamPlayers);
    const leagueData = toData(leaguePlayers);
    const intra_team = leagueData.length === 0;

    const mvp = computeZScore(teamData, leagueData);
    if (!mvp) return null;
    return { year, team_name, ...mvp, ...(intra_team ? { intra_team: true } : {}) };
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
    .filter((s) => s.year >= SEASON_CUTOFF)
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