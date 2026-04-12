import type { LeagueHistory } from "./types";

const PREFIX = "lh_";

export function getCachedHistory(league_key: string): LeagueHistory | null {
  try {
    const raw = sessionStorage.getItem(PREFIX + league_key);
    if (!raw) return null;
    return JSON.parse(raw) as LeagueHistory;
  } catch {
    return null;
  }
}

export function setCachedHistory(history: LeagueHistory): void {
  try {
    sessionStorage.setItem(PREFIX + history.league_key, JSON.stringify(history));
  } catch {
    // sessionStorage full or unavailable — fine, just skip
  }
}