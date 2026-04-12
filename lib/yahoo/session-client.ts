import { YahooClient } from "./client";
import { getDevYahooClient } from "./dev-client";
import { getSession, setSession } from "../session";

/**
 * Returns a YahooClient using the user's OAuth session tokens,
 * falling back to the dev client if no session exists.
 * After each request the refreshed tokens are persisted back to the cookie.
 */
export async function getYahooClient(): Promise<YahooClient | null> {
  // Prefer the dev client (server-side refresh token) for local development
  const dev = getDevYahooClient();
  if (dev) return dev;

  const tokens = await getSession();
  if (!tokens) return null;

  const clientId = process.env.YAHOO_CLIENT_ID;
  const clientSecret = process.env.YAHOO_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const client = new YahooClient({ clientId, clientSecret, tokens });
  // After construction the client may refresh the token on first request.
  // We persist the potentially-updated tokens after returning so the cookie stays fresh.
  // Wrap the client's get() to persist tokens after each call.
  const originalGet = client.get.bind(client);
  client.get = async function <T = unknown>(path: string, retries?: number): Promise<T> {
    const result = await originalGet<T>(path, retries);
    // Persist potentially refreshed tokens
    const current = client.getTokens();
    if (current.access_token && current.access_token !== tokens.access_token) {
      await setSession(current).catch(() => {});
    }
    return result;
  };

  return client;
}