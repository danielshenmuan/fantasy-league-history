import { YahooClient } from "./client";

type AnyObj = Record<string, any>;

export function parseLeagueInput(input: string): { game_key?: string; league_id?: string; league_key?: string } {
  const trimmed = input.trim();
  if (!trimmed) return {};

  const keyMatch = trimmed.match(/^(\d+)\.l\.(\d+)$/);
  if (keyMatch) {
    return { game_key: keyMatch[1], league_id: keyMatch[2], league_key: trimmed };
  }

  const urlMatch = trimmed.match(
    /basketball\.fantasysports\.yahoo\.com\/nba\/(\d+)(?:\/\d+)?/i,
  );
  if (urlMatch) {
    return { league_id: urlMatch[1] };
  }

  const numericOnly = trimmed.match(/^(\d+)$/);
  if (numericOnly) return { league_id: numericOnly[1] };

  return {};
}

export async function resolveCurrentNbaGameKey(client: YahooClient): Promise<string> {
  const parsed = await client.get<AnyObj>(
    "/game/nba",
  );
  const gameKey =
    parsed?.fantasy_content?.game?.game_key ?? parsed?.game?.game_key;
  if (!gameKey) throw new Error("Could not resolve current NBA game_key from Yahoo");
  return String(gameKey);
}

export async function resolveLeagueKey(
  client: YahooClient,
  input: string,
): Promise<string> {
  const parsed = parseLeagueInput(input);
  if (parsed.league_key) return parsed.league_key;
  if (!parsed.league_id) {
    throw new Error(
      "Could not parse league. Expected a Yahoo URL or league_key like 428.l.12345.",
    );
  }
  const gameKey = parsed.game_key ?? (await resolveCurrentNbaGameKey(client));
  return `${gameKey}.l.${parsed.league_id}`;
}
