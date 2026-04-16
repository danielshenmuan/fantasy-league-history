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

function extractLeagueNode(parsed: AnyObj): AnyObj {
  return parsed?.fantasy_content?.league ?? parsed?.league ?? {};
}

export type SeasonMVP = {
  year: number;
  team_name: string;
  player_name: string;
  points: number;
};

export type MVPResponse = {
  by_year: SeasonMVP[];
  all_time: SeasonMVP | null;
};

async function fetchSeasonMVP(
  client: Awaited<ReturnType<typeof getYahooClient>>,
  team_key: string,
  year: number,
  team_name: string,
): Promise<SeasonMVP | null> {
  if (!client || !team_key) return null;
  try {
    const parsed = await client.get<AnyObj>(`/team/${team_key}/players;out=stats`);
    const content = parsed?.fantasy_content ?? parsed ?? {};
    const teamNode = content?.team ?? {};
    // Players can be nested under team[1].players or directly
    const teamArr = Array.isArray(teamNode) ? teamNode : [];
    const playersSection = teamArr[1]?.players ?? teamNode?.players ?? {};
    const playerList = arr(playersSection?.player);

    let bestName = "";
    let bestPoints = -1;

    for (const player of playerList) {
      const pArr = Array.isArray(player) ? player : [];
      const meta = pArr[0] ?? player;
      const statsSection = pArr[1]?.player_stats ?? player?.player_stats ?? {};
      const stats = arr(statsSection?.stats?.stat);
      // Stat ID 0 is total fantasy points in Yahoo scoring
      const pts = stats.find((s) => num(s.stat_id) === 0);
      const points = pts ? num(pts.value) : 0;
      const name =
        meta?.name?.full ??
        `${meta?.name?.first ?? ""} ${meta?.name?.last ?? ""}`.trim();
      if (points > bestPoints && name) {
        bestPoints = points;
        bestName = name;
      }
    }

    if (!bestName) return null;
    return { year, team_name, player_name: bestName, points: bestPoints };
  } catch {
    return null;
  }
}

export async function GET(
  req: Request,
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

  // Collect all (team_key, year, team_name) pairs for this manager
  const teamEntries = history.seasons
    .map((s) => {
      const team = s.standings.find((t) => t.manager_guid === manager_guid);
      if (!team || !team.team_key) return null;
      return { team_key: team.team_key, year: s.year, team_name: team.team_name };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .sort((a, b) => a.year - b.year);

  if (teamEntries.length === 0) {
    return NextResponse.json<MVPResponse>({ by_year: [], all_time: null });
  }

  // Fetch all seasons in parallel
  const results = await Promise.all(
    teamEntries.map((e) => fetchSeasonMVP(client, e.team_key, e.year, e.team_name)),
  );

  const by_year = results.filter((r): r is SeasonMVP => r !== null);
  const all_time = by_year.reduce<SeasonMVP | null>((best, cur) => {
    if (!best || cur.points > best.points) return cur;
    return best;
  }, null);

  return NextResponse.json<MVPResponse>({ by_year, all_time });
}