import type { LeagueHistory } from "./types";
import { readCached, writeCache, isStale, readDemoFixture } from "./cache";
import { getYahooClient } from "./yahoo/session-client";
import { buildLeagueHistory } from "./yahoo/history";

const DEMO_KEY = "428.l.12345";

export async function loadLeagueHistory(league_key: string): Promise<LeagueHistory | null> {
  if (league_key === DEMO_KEY) {
    return readDemoFixture();
  }

  const cached = await readCached(league_key);
  if (cached && !isStale(cached)) return cached;

  const client = await getYahooClient();
  if (!client) return cached ?? null;

  try {
    const fresh = await buildLeagueHistory(client, league_key);
    await writeCache(fresh);
    return fresh;
  } catch (err) {
    console.error("[data] live fetch failed, falling back to cache:", err);
    return cached ?? null;
  }
}