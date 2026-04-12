#!/usr/bin/env bun
// Phase 0 spike: fetch a league's history using the dev refresh token.
// Usage: bun run scripts/fetch-league.ts <league_id_or_url_or_key>

import { getDevYahooClient } from "@/lib/yahoo/dev-client";
import { resolveLeagueKey } from "@/lib/yahoo/resolve";
import { buildLeagueHistory } from "@/lib/yahoo/history";
import { writeFile } from "node:fs/promises";
import path from "node:path";

async function main() {
  const input = process.argv[2];
  if (!input) {
    console.error("Usage: bun run scripts/fetch-league.ts <league_id_or_url_or_key>");
    process.exit(1);
  }
  const client = getDevYahooClient();
  if (!client) {
    console.error("Missing YAHOO_CLIENT_ID / YAHOO_CLIENT_SECRET / YAHOO_DEV_REFRESH_TOKEN in .env.local");
    process.exit(1);
  }
  console.log(`Resolving ${input}...`);
  const leagueKey = await resolveLeagueKey(client, input);
  console.log(`League key: ${leagueKey}`);
  console.log("Fetching history (this walks the renewal chain, can take a while)...");
  const history = await buildLeagueHistory(client, leagueKey);
  console.log(`Fetched ${history.seasons.length} seasons for ${history.league_name}`);
  for (const season of history.seasons) {
    const mark = season.partial ? " [partial]" : "";
    console.log(
      `  ${season.year} (${season.league_key}) ${season.standings.length} teams${mark}`,
    );
  }
  const outPath = path.join(process.cwd(), "fixtures", `league-${leagueKey}.json`);
  await writeFile(outPath, JSON.stringify(history, null, 2));
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});