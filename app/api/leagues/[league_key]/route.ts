import { NextResponse } from "next/server";
import { readCached, writeCache, isStale } from "@/lib/cache";
import { getYahooClient } from "@/lib/yahoo/session-client";
import { buildLeagueHistory } from "@/lib/yahoo/history";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ league_key: string }> },
) {
  const { league_key } = await params;
  const url = new URL(req.url);
  const force = url.searchParams.get("refresh") === "1";

  if (!force) {
    const cached = await readCached(league_key);
    if (cached && !isStale(cached)) {
      return NextResponse.json(cached, {
        headers: { "X-Cache": "HIT" },
      });
    }
  }

  const client = await getYahooClient();
  if (!client) {
    const stale = await readCached(league_key);
    if (stale) {
      return NextResponse.json(stale, { headers: { "X-Cache": "STALE-NO-CLIENT" } });
    }
    return NextResponse.json(
      { error: "yahoo_not_configured" },
      { status: 503 },
    );
  }

  try {
    const history = await buildLeagueHistory(client, league_key);
    await writeCache(history);
    return NextResponse.json(history, { headers: { "X-Cache": "MISS" } });
  } catch (err) {
    console.error("[api] fetch failed:", err);
    const stale = await readCached(league_key);
    if (stale) {
      return NextResponse.json(stale, { headers: { "X-Cache": "STALE-ERROR" } });
    }
    return NextResponse.json(
      { error: "fetch_failed", message: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}