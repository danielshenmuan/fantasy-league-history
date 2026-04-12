"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { LeagueHistory } from "@/lib/types";
import RankChart from "@/app/components/RankChart";
import TrophyCase from "@/app/components/TrophyCase";
import LeaderboardTable from "@/app/components/LeaderboardTable";
import H2HMatrix from "@/app/components/H2HMatrix";

type Status = "loading" | "loaded" | "error";

export default function LeaguePage() {
  const { league_key } = useParams<{ league_key: string }>();
  const [history, setHistory] = useState<LeagueHistory | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [h2hLoading, setH2hLoading] = useState(true);

  useEffect(() => {
    if (!league_key) return;
    let cancelled = false;

    async function load() {
      setStatus("loading");
      try {
        const res = await fetch(`/api/leagues/${encodeURIComponent(league_key)}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (res.status === 503 && !cancelled) {
            // No Yahoo client — need sign in
            setError("sign_in_required");
            setStatus("error");
            return;
          }
          throw new Error(data.message ?? `HTTP ${res.status}`);
        }
        const data: LeagueHistory = await res.json();
        if (!cancelled) {
          setHistory(data);
          setStatus("loaded");
          // Kick off H2H fetch in background — POST seasons so the route
          // doesn't need to read from cache (no shared /tmp between invocations)
          setH2hLoading(true);
          fetch(`/api/leagues/${encodeURIComponent(league_key)}/h2h`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ seasons: data.seasons }),
          })
            .then((r) => r.ok ? r.json() : Promise.reject(r.status))
            .then((h2h) => {
              if (!cancelled) {
                setHistory((prev) => prev ? { ...prev, h2h } : prev);
                setH2hLoading(false);
              }
            })
            .catch(() => { if (!cancelled) setH2hLoading(false); });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load league");
          setStatus("error");
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [league_key]);

  if (status === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-4 border-[#FCA311] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-[#14213D]/60 text-sm">Fetching league history from Yahoo…</p>
          <p className="text-[#14213D]/40 text-xs">First load takes ~30s while we walk your full history</p>
        </div>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white p-6">
        <div className="text-center space-y-4 max-w-sm">
          {error === "sign_in_required" ? (
            <>
              <p className="text-[#14213D] font-semibold">Yahoo sign-in required</p>
              <p className="text-[#14213D]/60 text-sm">Sign in with your Yahoo account to load your league.</p>
              <a
                href={`/api/auth/yahoo?league=${encodeURIComponent(league_key)}`}
                className="inline-block px-5 py-2.5 rounded-lg bg-[#FCA311] text-[#14213D] font-semibold hover:bg-[#FCA311]/90 transition-colors"
              >
                Sign in with Yahoo
              </a>
            </>
          ) : (
            <>
              <p className="text-[#14213D] font-semibold">Something went wrong</p>
              <p className="text-[#14213D]/60 text-sm font-mono">{error}</p>
              <Link href="/" className="text-[#FCA311] hover:underline text-sm">← Back home</Link>
            </>
          )}
        </div>
      </main>
    );
  }

  if (!history) return null;

  const years = history.seasons_covered;
  const yearRange = years.length ? `${years[0]}–${years[years.length - 1]}` : "—";
  const fetchedAt = new Date(history.fetched_at).toLocaleString();

  return (
    <main className="min-h-screen bg-white text-[#000000]">
      <div className="max-w-5xl mx-auto p-6 space-y-10">
        <div>
          <Link href="/" className="text-sm text-[#FCA311] hover:underline">
            ← Home
          </Link>
        </div>

        <header className="space-y-1">
          <h1 className="text-3xl font-bold text-[#14213D]">{history.league_name}</h1>
          <p className="text-[#14213D]/70">
            {yearRange} · {history.num_teams} managers · last updated {fetchedAt}
          </p>
          <p className="font-mono text-xs text-[#14213D]/40">{history.league_key}</p>
        </header>

        <section>
          <h2 className="text-xl font-semibold mb-4 text-[#14213D]">
            Finishing position by year
          </h2>
          <RankChart history={history} />
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4 text-[#14213D]">All-time leaderboard</h2>
          <LeaderboardTable history={history} />
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4 text-[#14213D]">Head-to-head records</h2>
          <H2HMatrix history={history} loading={h2hLoading} />
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-semibold mb-4 text-[#14213D]">Trophy case</h2>
          <TrophyCase history={history} />
        </section>
      </div>
    </main>
  );
}