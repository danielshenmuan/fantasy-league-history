import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { LeagueHistory } from "./types";

// /tmp is the only writable directory on Vercel; fall back to local .cache for dev
const CACHE_DIR = process.env.VERCEL
  ? path.join("/tmp", ".cache", "leagues")
  : path.join(process.cwd(), ".cache", "leagues");
const FIXTURE_DIR = path.join(process.cwd(), "fixtures");
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function safeKey(league_key: string): string {
  return league_key.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function readCached(league_key: string): Promise<LeagueHistory | null> {
  const safe = safeKey(league_key);
  const candidates = [
    path.join(CACHE_DIR, `${safe}.json`),
    path.join(FIXTURE_DIR, `league-${safe}.json`),
  ];
  for (const file of candidates) {
    try {
      const raw = await readFile(file, "utf-8");
      return JSON.parse(raw) as LeagueHistory;
    } catch {
      // try next
    }
  }
  return null;
}

export function isStale(history: LeagueHistory): boolean {
  const fetched = Date.parse(history.fetched_at);
  if (!Number.isFinite(fetched)) return true;
  return Date.now() - fetched > CACHE_TTL_MS;
}

export async function writeCache(history: LeagueHistory): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, `${safeKey(history.league_key)}.json`);
  await writeFile(file, JSON.stringify(history, null, 2));
}

export async function readDemoFixture(): Promise<LeagueHistory | null> {
  try {
    const raw = await readFile(path.join(FIXTURE_DIR, "sample-league.json"), "utf-8");
    return JSON.parse(raw) as LeagueHistory;
  } catch {
    return null;
  }
}