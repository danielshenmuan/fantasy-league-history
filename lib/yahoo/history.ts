import type {
  H2HRecord,
  LeagueHistory,
  Manager,
  ManagerStats,
  PlayoffResult,
  Season,
  StatCategory,
  TeamSeason,
} from "../types";
import { YahooClient } from "./client";

type AnyObj = Record<string, any>;

function arr<T = AnyObj>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : fallback;
}

function extractLeagueNode(parsed: AnyObj): AnyObj {
  return parsed?.fantasy_content?.league ?? parsed?.league ?? {};
}

async function fetchLeagueMeta(
  client: YahooClient,
  league_key: string,
): Promise<{
  league_name: string;
  season: number;
  num_teams: number;
  renew: string | null;
}> {
  const parsed = await client.get<AnyObj>(`/league/${league_key};out=metadata`);
  const league = extractLeagueNode(parsed);
  // Yahoo exposes `renew` = previous season's league (format "gamekey_leagueid"),
  // and `renewed` = next season's league. We walk backwards via `renew`.
  const renewRaw = league.renew;
  const renew = renewRaw && String(renewRaw).trim() !== "" ? String(renewRaw) : null;
  return {
    league_name: String(league.name ?? ""),
    season: num(league.season),
    num_teams: num(league.num_teams),
    renew,
  };
}

async function fetchLeagueStandings(
  client: YahooClient,
  league_key: string,
): Promise<AnyObj[]> {
  const parsed = await client.get<AnyObj>(`/league/${league_key}/standings`);
  const league = extractLeagueNode(parsed);
  const teamsNode = league?.standings?.teams?.team ?? league?.teams?.team ?? [];
  return arr(teamsNode);
}

function extractPointsScored(team: AnyObj): number {
  const stats = arr(team?.team_stats?.stats?.stat);
  const scored = stats.find((s) => num(s.stat_id) === 12);
  if (scored) return num(scored.value);
  return num(team?.team_standings?.points_for);
}

function inferPlayoffResult(rank: number, seed: number | null): PlayoffResult {
  if (!rank) return "none";
  if (rank === 1) return "champion";
  if (rank === 2) return "runner_up";
  if (rank <= 4) return "semifinal";
  if (rank <= 6) return "quarterfinal";
  if (seed && seed <= 6) return "quarterfinal";
  return "none";
}

function parseTeam(team: AnyObj): TeamSeason {
  const managersNode = arr(team.managers?.manager);
  const primaryManager = managersNode[0] ?? {};
  const standings = team.team_standings ?? {};
  const outcome = standings.outcome_totals ?? {};
  const rank = num(standings.rank);
  const seed = standings.playoff_seed != null ? num(standings.playoff_seed) : null;
  return {
    manager_guid: String(primaryManager.guid ?? ""),
    team_key: String(team.team_key ?? ""),
    team_name: String(team.name ?? ""),
    final_rank: rank,
    wins: num(outcome.wins),
    losses: num(outcome.losses),
    ties: num(outcome.ties),
    points_for: extractPointsScored(team),
    points_against: num(standings.points_against),
    playoff_seed: seed,
    playoff_result: inferPlayoffResult(rank, seed),
  };
}

async function fetchSeason(
  client: YahooClient,
  league_key: string,
  year: number,
): Promise<Season> {
  try {
    const rawTeams = await fetchLeagueStandings(client, league_key);
    const standings = rawTeams
      .map(parseTeam)
      .sort((a, b) => a.final_rank - b.final_rank);
    const champion = standings.find((t) => t.playoff_result === "champion") ?? null;
    const last = standings[standings.length - 1] ?? null;
    const regularSeasonWinner =
      standings.find((t) => t.playoff_seed === 1) ??
      [...standings].sort((a, b) => b.wins - a.wins)[0] ??
      null;
    return {
      year,
      league_key,
      standings,
      champion_guid: champion?.manager_guid ?? null,
      regular_season_winner_guid: regularSeasonWinner?.manager_guid ?? null,
      last_place_guid: last?.manager_guid ?? null,
    };
  } catch (err) {
    console.warn(`[history] season ${year} (${league_key}) failed:`, err);
    return {
      year,
      league_key,
      standings: [],
      champion_guid: null,
      regular_season_winner_guid: null,
      last_place_guid: null,
      partial: true,
    };
  }
}

async function walkRenewalChain(
  client: YahooClient,
  currentKey: string,
): Promise<Array<{ league_key: string; year: number; league_name: string; num_teams: number }>> {
  const chain: Array<{ league_key: string; year: number; league_name: string; num_teams: number }> = [];
  let key: string | null = currentKey;
  const seen = new Set<string>();
  while (key && !seen.has(key)) {
    seen.add(key);
    try {
      const meta = await fetchLeagueMeta(client, key);
      chain.push({
        league_key: key,
        year: meta.season,
        league_name: meta.league_name,
        num_teams: meta.num_teams,
      });
      if (!meta.renew) break;
      const rf = meta.renew;
      if (rf.includes(".l.")) {
        key = rf;
      } else if (rf.includes("_")) {
        const [gk, lid] = rf.split("_");
        key = `${gk}.l.${lid}`;
      } else {
        break;
      }
    } catch (err) {
      console.warn(`[history] chain walk failed at ${key}:`, err);
      break;
    }
  }
  return chain;
}

// ── Scoreboard / H2H ────────────────────────────────────────────────────────

function parseMatchupsFromLeague(
  league: AnyObj,
  teamKeyToGuid: Record<string, string>,
  h2h: Record<string, Record<string, H2HRecord>>,
) {
  function ensure(a: string, b: string) {
    h2h[a] ??= {};
    h2h[a][b] ??= { wins: 0, losses: 0, ties: 0 };
  }

  // Scoreboard may be a single object or array (one per week in a batched call)
  const scoreboards = arr(league?.scoreboard ?? league?.["scoreboard"]);
  for (const sb of scoreboards) {
    for (const matchup of arr(sb?.matchups?.matchup)) {
      const winnerKey = String(matchup.winner_team_key ?? "");
      const sides = arr(matchup.teams?.team);
      if (sides.length !== 2) continue;
      const [side_a, side_b] = sides;
      const guid_a = teamKeyToGuid[String(side_a.team_key ?? "")];
      const guid_b = teamKeyToGuid[String(side_b.team_key ?? "")];
      if (!guid_a || !guid_b || guid_a === guid_b) continue;

      ensure(guid_a, guid_b);
      ensure(guid_b, guid_a);

      const aWon = String(side_a.team_key) === winnerKey;
      const bWon = String(side_b.team_key) === winnerKey;
      if (aWon) { h2h[guid_a][guid_b].wins++; h2h[guid_b][guid_a].losses++; }
      else if (bWon) { h2h[guid_b][guid_a].wins++; h2h[guid_a][guid_b].losses++; }
      else { h2h[guid_a][guid_b].ties++; h2h[guid_b][guid_a].ties++; }
    }
  }
}

async function fetchH2HForSeason(
  client: YahooClient,
  league_key: string,
): Promise<Record<string, Record<string, H2HRecord>>> {
  const h2h: Record<string, Record<string, H2HRecord>> = {};
  const weeks = Array.from({ length: 22 }, (_, i) => i + 1).join(",");

  let teamKeyToGuid: Record<string, string> = {};
  try {
    const parsed = await client.get<AnyObj>(`/league/${league_key}/teams`);
    const league = extractLeagueNode(parsed);
    for (const team of arr(league?.teams?.team)) {
      const team_key = String(team.team_key ?? "");
      const guid = String(arr(team.managers?.manager)[0]?.guid ?? "");
      if (team_key && guid) teamKeyToGuid[team_key] = guid;
    }
  } catch {
    return h2h;
  }

  try {
    const parsed = await client.get<AnyObj>(
      `/league/${league_key}/scoreboard;week=${weeks}`,
    );
    const league = extractLeagueNode(parsed);
    parseMatchupsFromLeague(league, teamKeyToGuid, h2h);
  } catch {
    // ignore seasons that fail
  }

  return h2h;
}

async function buildH2H(
  client: YahooClient,
  chain: Array<{ league_key: string; num_teams: number }>,
  seasons: Season[],
): Promise<Record<string, Record<string, H2HRecord>>> {
  const h2h: Record<string, Record<string, H2HRecord>> = {};

  const validLinks = chain.filter((link) => {
    const season = seasons.find((s) => s.league_key === link.league_key);
    return season && !season.partial;
  });

  const results = await Promise.all(
    validLinks.map((link) => fetchH2HForSeason(client, link.league_key)),
  );

  for (const result of results) {
    for (const [guid_a, opponents] of Object.entries(result)) {
      h2h[guid_a] ??= {};
      for (const [guid_b, record] of Object.entries(opponents)) {
        h2h[guid_a][guid_b] ??= { wins: 0, losses: 0, ties: 0 };
        h2h[guid_a][guid_b].wins += record.wins;
        h2h[guid_a][guid_b].losses += record.losses;
        h2h[guid_a][guid_b].ties += record.ties;
      }
    }
  }

  return h2h;
}

// ── Leaderboard ──────────────────────────────────────────────────────────────

function buildLeaderboard(
  managers: Manager[],
  seasons: Season[],
): ManagerStats[] {
  return managers.map((manager) => {
    const played = seasons.filter((s) =>
      s.standings.some((t) => t.manager_guid === manager.manager_guid),
    );
    const teams = played.flatMap((s) =>
      s.standings.filter((t) => t.manager_guid === manager.manager_guid),
    );

    const total_wins = teams.reduce((n, t) => n + t.wins, 0);
    const total_losses = teams.reduce((n, t) => n + t.losses, 0);
    const total_ties = teams.reduce((n, t) => n + t.ties, 0);
    const total_games = total_wins + total_losses + total_ties;
    const ranks = teams.map((t) => t.final_rank).filter((r) => r > 0);

    return {
      manager_guid: manager.manager_guid,
      seasons_played: played.length,
      total_wins,
      total_losses,
      total_ties,
      win_rate: total_games > 0 ? total_wins / total_games : 0,
      championships: seasons.filter((s) => s.champion_guid === manager.manager_guid).length,
      runner_ups: teams.filter((t) => t.playoff_result === "runner_up").length,
      last_places: seasons.filter((s) => s.last_place_guid === manager.manager_guid).length,
      avg_finish: ranks.length > 0 ? ranks.reduce((a, b) => a + b, 0) / ranks.length : 0,
      best_finish: ranks.length > 0 ? Math.min(...ranks) : 0,
      worst_finish: ranks.length > 0 ? Math.max(...ranks) : 0,
      total_points_for: teams.reduce((n, t) => n + t.points_for, 0),
    };
  });
}

// ── Stat categories ──────────────────────────────────────────────────────────

async function fetchStatCategories(
  client: YahooClient,
  league_key: string,
): Promise<StatCategory[]> {
  try {
    const parsed = await client.get<AnyObj>(`/league/${league_key}/stat_categories`);
    const stats = arr(
      (parsed?.fantasy_content?.league as AnyObj)?.stat_categories?.stats?.stat,
    );
    const result: StatCategory[] = [];
    for (const s of stats) {
      // Only include actual scoring categories, not display-only ones (like GP)
      const posTypes = arr(s.position_types?.position_type);
      const isScoring = posTypes.some((pt: AnyObj) => num(pt.is_only_display_stat) === 0);
      if (!isScoring) continue;
      result.push({
        stat_id: num(s.stat_id),
        display_name: String(s.display_name ?? s.name ?? ""),
        sort_order: num(s.sort_order ?? 1),
      });
    }
    return result;
  } catch {
    return [];
  }
}

// ── Main builder ─────────────────────────────────────────────────────────────

export async function buildLeagueHistory(
  client: YahooClient,
  currentLeagueKey: string,
): Promise<LeagueHistory> {
  const chain = await walkRenewalChain(client, currentLeagueKey);
  if (chain.length === 0) {
    throw new Error(`No league metadata for ${currentLeagueKey}`);
  }

  const seasons = await Promise.all(
    chain.map((link) => fetchSeason(client, link.league_key, link.year)),
  );
  seasons.sort((a, b) => a.year - b.year);

  const managerMap = new Map<string, Manager>();
  for (const season of seasons) {
    for (const team of season.standings) {
      if (!team.manager_guid) continue;
      const existing = managerMap.get(team.manager_guid);
      if (!existing) {
        managerMap.set(team.manager_guid, {
          manager_guid: team.manager_guid,
          display_name: team.team_name,
          historical_names: [team.team_name],
          first_season: season.year,
          last_season: season.year,
        });
      } else {
        if (!existing.historical_names.includes(team.team_name)) {
          existing.historical_names.push(team.team_name);
        }
        existing.first_season = Math.min(existing.first_season, season.year);
        if (season.year >= existing.last_season) {
          existing.last_season = season.year;
          existing.display_name = team.team_name;
        }
      }
    }
  }

  const managers = [...managerMap.values()].sort((a, b) => a.first_season - b.first_season);
  const leaderboard = buildLeaderboard(managers, seasons);

  // H2H: last 3 seasons only (2 API calls per season = ~6 total, well within 60s)
  const recentSeasons = [...seasons].sort((a, b) => b.year - a.year).slice(0, 3);
  const h2hChain = recentSeasons.map((s) => ({
    league_key: s.league_key,
    num_teams: s.standings.length,
  }));
  const [h2h, stat_categories] = await Promise.all([
    buildH2H(client, h2hChain, recentSeasons),
    fetchStatCategories(client, currentLeagueKey),
  ]);

  const current = chain.find((c) => c.league_key === currentLeagueKey) ?? chain[0];
  return {
    league_key: currentLeagueKey,
    league_name: current.league_name,
    num_teams: current.num_teams,
    seasons_covered: seasons.map((s) => s.year),
    fetched_at: new Date().toISOString(),
    managers,
    seasons,
    h2h,
    leaderboard,
    stat_categories,
  };
}
