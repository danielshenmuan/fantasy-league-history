import { NextResponse } from "next/server";
import { buildAuthorizeUrl } from "@/lib/yahoo/client";

export async function GET(req: Request) {
  const clientId = process.env.YAHOO_CLIENT_ID;
  const redirectUri = process.env.YAHOO_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "Yahoo OAuth not configured on this server" },
      { status: 503 },
    );
  }

  // Preserve the league URL the user was trying to load
  const url = new URL(req.url);
  const leagueInput = url.searchParams.get("league") ?? "";

  const state = Buffer.from(JSON.stringify({ league: leagueInput })).toString("base64url");

  const authUrl = buildAuthorizeUrl({
    clientId,
    redirectUri,
    state,
  });

  return NextResponse.redirect(authUrl);
}