import { NextResponse } from "next/server";
import { exchangeCode } from "@/lib/yahoo/client";
import { setSession } from "@/lib/session";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state") ?? "";
  const error = url.searchParams.get("error");

  if (error || !code) {
    const base = new URL("/", req.url);
    base.searchParams.set("auth_error", error ?? "no_code");
    return NextResponse.redirect(base);
  }

  const clientId = process.env.YAHOO_CLIENT_ID!;
  const clientSecret = process.env.YAHOO_CLIENT_SECRET!;
  const redirectUri = process.env.YAHOO_REDIRECT_URI!;

  try {
    const tokens = await exchangeCode({
      clientId,
      clientSecret,
      redirectUri,
      code,
    });

    await setSession(tokens);

    // Decode state to redirect back to the league the user wanted
    let league = "";
    try {
      const decoded = JSON.parse(
        Buffer.from(stateRaw, "base64url").toString(),
      );
      league = decoded.league ?? "";
    } catch {
      // no state, just go home
    }

    const dest = new URL("/", req.url);
    if (league) {
      dest.searchParams.set("league", league);
    }
    return NextResponse.redirect(dest);
  } catch (err) {
    console.error("[auth/callback] token exchange failed:", err);
    const base = new URL("/", req.url);
    base.searchParams.set("auth_error", "exchange_failed");
    return NextResponse.redirect(base);
  }
}