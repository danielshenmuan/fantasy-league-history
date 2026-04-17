import { NextResponse } from "next/server";
import { readCached } from "@/lib/cache";
import { getYahooClient } from "@/lib/yahoo/session-client";
import type { StatCategory } from "@/lib/types";

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

// ── Scoring category with weight ─────────────────────────────────────────────

type ScoringCat = StatCategory & {
  weight: number;
  /** true when the value from Yahoo is already a percentage decimal (FG%, FT%) */
  is_pct: boolean;
  /** true when a higher value hurts (TO) — derived from sort_order === 0 */
  negate: boolean;
};

/** Default hardcoded categories for when stat_categories is missing from cache */
const DEFAULT_CATS: ScoringCat[] = [
  { stat_id: 12, display_name: "PTS",   sort_order: 1, weight: 1.5, is_pct: false, negate: false },
  { stat_id: 15, display_name: "REB",   sort_order: 1, weight: 1.0, is_pct: false, negate: false },
  { stat_id: 16, display_name: "AST",   sort_order: 1, weight: 1.0, is_pct: false, negate: false },
  { stat_id: 17, display_name: "STL",   sort_order: 1, weight: 1.0, is_pct: false, negate: false },
  { stat_id: 18, display_name: "BLK",   sort_order: 1, weight: 1.0, is_pct: false, negate: false },
  { stat_id: 10, display_name: "3PM",   sort_order: 1, weight: 1.0, is_pct: false, negate: false },
  { stat_id: 19, display_name: "TO",    sort_order: 0, weight: 1.0, is_pct: false, negate: true  },
  { stat_id: 11, display_name: "FG%",   sort_order: 1, weight: 0.5, is_pct: true,  negate: false },
  { stat_id: 13, display_name: "FT%",   sort_order: 1, weight: 0.5, is_pct: true,  negate: false },
];

// Hardcoded "helper" stat IDs needed for percentage computation
// regardless of whether they appear as scoring cats.
const FGM_ID = 6;
const FGA_ID = 7;
const FTM_ID = 8;
const FTA_ID = 9;

function isPct(displayName: string): boolean {
  return displayName.includes("%");
}

function toCats(raw: StatCategory[]): ScoringCat[] {
  if (!raw || raw.length === 0) return DEFAULT_CATS;
  return raw.map((s) => ({
    ...s,
    negate: s.sort_order === 0,
    is_pct: isPct(s.display_name),
    weight: (() => {
      const n = s.display_name.toUpperCase();
      if (n === "PTS" || n === "POINTS") return 1.5;
      if (isPct(s.display_name)) return 0.5;
      return 1.0;
    })(),
  }));
}

// Only fetch MVP data for seasons from 2022 onwards
const SEASON_CUTOFF = 2022;

// ── Player list extraction ───────────────────────────────────────────────────

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
  const node = player?.player_stats;
  for (const s of arr(node?.stats?.stat)) {
    result[num(s.stat_id)] = num(s.value);
  }
  return result;
}

function getGP(player: AnyObj): number {
  for (const s of arr(player?.player_stats?.stats?.stat)) {
    if (num(s.stat_id) === 0) {
      const v = num(s.value);
      if (v > 0) return v;
    }
  }
  return 0;
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

function getPlayerKey(player: AnyObj): string {
  return String(player?.player_key ?? "");
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

type PlayerData = { name: string; player_key: string; image_url: string | null; stats: Record<number, number> };

type ZScoreResult = {
  player_name: string;
  player_key: string;
  player_image_url: string | null;
  z_score: number;
  raw_stats: Record<number, number>;
};

function computeZScore(
  teamPlayers: PlayerData[],
  leaguePlayers: PlayerData[],
  cats: ScoringCat[],
): ZScoreResult | null {
  const baseline = leaguePlayers.length > 0 ? leaguePlayers : teamPlayers;

  function distOf(values: number[]) {
    if (values.length === 0) return { mean: 0, std: 1 };
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
    return { mean, std: Math.sqrt(variance) || 1 };
  }

  // Pre-compute distributions per category
  type CatDist = { cat: ScoringCat; mean: number; std: number; meanAttempts: number };
  const catDists: CatDist[] = cats.map((cat) => {
    if (cat.is_pct) {
      // For percentage cats: compute per-player percentage from made/attempted
      // We need companion stat IDs (FGM/FGA or FTM/FTA).
      // Detect by display_name since stat_id for % may vary across leagues.
      const isFg = cat.display_name.toUpperCase().includes("FG");
      const madeId = isFg ? FGM_ID : FTM_ID;
      const attId  = isFg ? FGA_ID : FTA_ID;
      const pcts = baseline.map((p) =>
        (p.stats[attId] ?? 0) > 0 ? (p.stats[madeId] ?? 0) / (p.stats[attId] ?? 0) : 0,
      );
      const attVals = baseline.map((p) => p.stats[attId] ?? 0);
      const meanAttempts = attVals.length > 0
        ? attVals.reduce((a, b) => a + b, 0) / attVals.length
        : 1;
      const dist = distOf(pcts);
      return { cat, ...dist, meanAttempts };
    } else {
      const vals = baseline.map((p) => p.stats[cat.stat_id] ?? 0);
      return { cat, ...distOf(vals), meanAttempts: 0 };
    }
  });

  let bestName = "";
  let bestPlayerKey = "";
  let bestImageUrl: string | null = null;
  let bestScore = -Infinity;
  let bestRawStats: Record<number, number> = {};

  for (const { name, player_key, image_url, stats } of teamPlayers) {
    if (!name) continue;

    let score = 0;
    for (const { cat, mean, std, meanAttempts } of catDists) {
      let z: number;
      if (cat.is_pct) {
        const isFg = cat.display_name.toUpperCase().includes("FG");
        const madeId = isFg ? FGM_ID : FTM_ID;
        const attId  = isFg ? FGA_ID : FTA_ID;
        const att = stats[attId] ?? 0;
        const playerPct = att > 0 ? (stats[madeId] ?? 0) / att : 0;
        z = std > 0 && meanAttempts > 0
          ? ((playerPct - mean) / std) * (att / meanAttempts)
          : 0;
      } else {
        z = ((stats[cat.stat_id] ?? 0) - mean) / std;
        if (cat.negate) z = -z;
      }
      score += z * cat.weight;
    }

    if (score > bestScore) {
      bestScore = score;
      bestName = name;
      bestPlayerKey = player_key;
      bestImageUrl = image_url;
      bestRawStats = stats;
    }
  }

  if (!bestName) return null;

  return {
    player_name: bestName,
    player_key: bestPlayerKey,
    player_image_url: bestImageUrl,
    z_score: Math.round(bestScore * 10) / 10,
    raw_stats: bestRawStats,
  };
}

// ── GP lookup ────────────────────────────────────────────────────────────────

async function fetchPlayerGP(
  client: Awaited<ReturnType<typeof getYahooClient>>,
  player_key: string,
): Promise<number> {
  if (!player_key || !client) return 0;
  try {
    const parsed = await client.get<AnyObj>(`/player/${player_key}/stats;type=season`);
    const raw = parsed?.fantasy_content?.player;
    const playerObj = normalisedPlayer(Array.isArray(raw) ? raw : arr(raw));
    return getGP(playerObj);
  } catch {
    return 0;
  }
}

// ── Display stats builder ────────────────────────────────────────────────────
//
// Maps dynamic category stat_ids onto the fixed PlayerStats display fields.
// We match by display_name (case-insensitive) rather than hardcoded stat_id.

function findStatId(cats: ScoringCat[], ...names: string[]): number | null {
  for (const name of names) {
    const n = name.toUpperCase();
    const cat = cats.find((c) => c.display_name.toUpperCase() === n);
    if (cat) return cat.stat_id;
  }
  return null;
}

function buildPlayerStats(
  raw: Record<number, number>,
  gp: number,
  cats: ScoringCat[],
): PlayerStats {
  const gpDiv = gp > 1 ? gp : 1;
  const pg = (id: number | null) =>
    id != null ? Math.round((raw[id] ?? 0) / gpDiv * 10) / 10 : 0;

  // FG%/FT%: always compute from made/attempted counts (more reliable than direct % stat_ids)
  const fgPct = (() => {
    const m = raw[FGM_ID] ?? 0, a = raw[FGA_ID] ?? 0;
    return m > 0 && a >= m ? Math.round(m / a * 1000) / 10 : null;
  })();
  const ftPct = (() => {
    const m = raw[FTM_ID] ?? 0, a = raw[FTA_ID] ?? 0;
    return m > 0 && a >= m ? Math.round(m / a * 1000) / 10 : null;
  })();

  return {
    gp,
    pts:      pg(findStatId(cats, "PTS", "Points")),
    reb:      pg(findStatId(cats, "REB", "Rebounds", "TREB", "Total Rebounds")),
    ast:      pg(findStatId(cats, "AST", "Assists")),
    stl:      pg(findStatId(cats, "ST",  "STL", "Steals")),
    blk:      pg(findStatId(cats, "BLK", "Blocks")),
    three_pm: pg(findStatId(cats, "3PM", "3PTM", "3-pointers Made", "3-PT Made")),
    to:       pg(findStatId(cats, "TO",  "TOV", "Turnovers")),
    fg_pct:   fgPct,
    ft_pct:   ftPct,
  };
}

// ── Per-season fetch ─────────────────────────────────────────────────────────

async function fetchSeasonMVP(
  client: Awaited<ReturnType<typeof getYahooClient>>,
  league_key: string,
  team_key: string,
  year: number,
  team_name: string,
  cats: ScoringCat[],
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
      ps.map((p) => ({
        name: getName(p),
        player_key: getPlayerKey(p),
        image_url: getImageUrl(p),
        stats: getStats(p),
      }));

    const teamData = toData(teamPlayers);
    const leagueData = toData(leaguePlayers);
    const intra_team = leagueData.length === 0;

    const result = computeZScore(teamData, leagueData, cats);
    if (!result) return null;

    const gp = await fetchPlayerGP(client, result.player_key);

    return {
      year,
      team_name,
      player_name: result.player_name,
      player_image_url: result.player_image_url,
      z_score: result.z_score,
      player_stats: buildPlayerStats(result.raw_stats, gp, cats),
      ...(intra_team ? { intra_team: true } : {}),
    };
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

  const cats = toCats(history.stat_categories ?? []);

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
      fetchSeasonMVP(client, e.league_key, e.team_key, e.year, e.team_name, cats),
    ),
  );

  const by_year = results.filter((r): r is SeasonMVP => r !== null);
  const all_time = by_year.reduce<SeasonMVP | null>((best, cur) => {
    if (!best || cur.z_score > best.z_score) return cur;
    return best;
  }, null);

  return NextResponse.json<MVPResponse>({ by_year, all_time });
}