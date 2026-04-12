import { NextResponse } from "next/server";
import { parseLeagueInput, resolveLeagueKey } from "@/lib/yahoo/resolve";
import { getYahooClient } from "@/lib/yahoo/session-client";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const input = url.searchParams.get("url") ?? "";
  const parsed = parseLeagueInput(input);
  if (!parsed.league_id && !parsed.league_key) {
    return NextResponse.json(
      { error: "could_not_parse", hint: "Expected Yahoo URL or league_key like 428.l.12345" },
      { status: 400 },
    );
  }
  if (parsed.league_key) {
    return NextResponse.json({ league_key: parsed.league_key });
  }
  const client = await getYahooClient();
  if (!client) {
    return NextResponse.json(
      {
        league_id: parsed.league_id,
        needs_oauth: true,
        hint: "Sign in with Yahoo to resolve the current NBA game_key.",
      },
      { status: 202 },
    );
  }
  try {
    const league_key = await resolveLeagueKey(client, input);
    return NextResponse.json({ league_key });
  } catch (err) {
    return NextResponse.json(
      {
        error: "resolve_failed",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
}