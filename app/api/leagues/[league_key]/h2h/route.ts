import { NextResponse } from "next/server";
import { readCached, writeCache } from "@/lib/cache";
import { getYahooClient } from "@/lib/yahoo/session-client";
import { buildH2HForLeague } from "@/lib/yahoo/history";

export const maxDuration = 60;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ league_key: string }> },
) {
  const { league_key } = await params;

  // Load existing history to get seasons (needed for H2H computation)
  const history = await readCached(league_key);
  if (!history) {
    return NextResponse.json({ error: "league_not_cached" }, { status: 404 });
  }

  // If we already have H2H data, return it
  const hasH2H = Object.values(history.h2h ?? {}).some((rec) =>
    Object.values(rec).some((r) => r.wins + r.losses + r.ties > 0),
  );
  if (hasH2H) {
    return NextResponse.json(history.h2h, { headers: { "X-Cache": "HIT" } });
  }

  const client = await getYahooClient();
  if (!client) {
    return NextResponse.json({ error: "yahoo_not_configured" }, { status: 503 });
  }

  try {
    const h2h = await buildH2HForLeague(client, league_key, history.seasons);
    // Persist back into cache
    await writeCache({ ...history, h2h });
    return NextResponse.json(h2h, { headers: { "X-Cache": "MISS" } });
  } catch (err) {
    return NextResponse.json(
      { error: "h2h_failed", message: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}