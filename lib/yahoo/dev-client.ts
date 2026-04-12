import { YahooClient } from "./client";

export function getDevYahooClient(): YahooClient | null {
  const clientId = process.env.YAHOO_CLIENT_ID;
  const clientSecret = process.env.YAHOO_CLIENT_SECRET;
  const refreshToken = process.env.YAHOO_DEV_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return null;
  return new YahooClient({
    clientId,
    clientSecret,
    tokens: {
      access_token: "",
      refresh_token: refreshToken,
      expires_at: 0,
    },
  });
}