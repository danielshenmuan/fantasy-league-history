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

  const history = await readCached(league_key);
  if (!history) {
    return NextResponse.json({ error: "league_not_cached" }, { status: 404 });
  }

  const client = await getYahooClient();
  if (!client) {
    return NextResponse.json({ error: "yahoo_not_configured" }, { status: 503 });
  }

  try {
    const h2h = await buildH2HForLeague(client, history.seasons);
    await writeCache({ ...history, h2h });
    return NextResponse.json(h2h);
  } catch (err) {
    return NextResponse.json(
      { error: "h2h_failed", message: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}