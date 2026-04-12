import { NextResponse } from "next/server";
import { getYahooClient } from "@/lib/yahoo/session-client";
import { buildH2HForLeague } from "@/lib/yahoo/history";
import type { Season } from "@/lib/types";

export const maxDuration = 60;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ league_key: string }> },
) {
  await params; // league_key available if needed later

  const body = await req.json().catch(() => null);
  const seasons: Season[] | undefined = body?.seasons;
  if (!seasons?.length) {
    return NextResponse.json({ error: "seasons_required" }, { status: 400 });
  }

  const client = await getYahooClient();
  if (!client) {
    return NextResponse.json({ error: "yahoo_not_configured" }, { status: 503 });
  }

  try {
    const h2h = await buildH2HForLeague(client, seasons);
    return NextResponse.json(h2h);
  } catch (err) {
    return NextResponse.json(
      { error: "h2h_failed", message: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}