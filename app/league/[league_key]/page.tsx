"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { LeagueHistory } from "@/lib/types";
import { getCachedHistory, setCachedHistory } from "@/lib/league-cache";
import RankChart from "@/app/components/RankChart";
import TrophyCase from "@/app/components/TrophyCase";
import LeaderboardTable from "@/app/components/LeaderboardTable";
import H2HMatrix from "@/app/components/H2HMatrix";

type Step = "league" | "done";

function LoadingScreen({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "league", label: "Fetching league history & head-to-head records" },
    { key: "done",   label: "Building your dashboard" },
  ];

  const currentIdx = steps.findIndex((s) => s.key === step);

  return (
    <main className="min-h-screen flex items-center justify-center bg-white p-6">
      <div className="max-w-sm w-full space-y-6">
        <div className="text-center space-y-1">
          <h2 className="text-xl font-bold text-[#14213D]">Loading your league…</h2>
          <p className="text-sm text-[#14213D]/50">This takes ~30–60s on first load</p>
        </div>
        <div className="space-y-3">
          {steps.map((s, idx) => {
            const isDone = idx < currentIdx;
            const isActive = idx === currentIdx;
            return (
              <div key={s.key} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center border-2"
                  style={{
                    borderColor: isDone ? "#FCA311" : isActive ? "#FCA311" : "#E5E5E5",
                    backgroundColor: isDone ? "#FCA311" : "transparent",
                  }}
                >
                  {isDone ? (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isActive ? (
                    <div className="w-2.5 h-2.5 rounded-full bg-[#FCA311] animate-pulse" />
                  ) : null}
                </div>
                <span className={`text-sm ${isDone ? "text-[#14213D]" : isActive ? "text-[#14213D] font-medium" : "text-[#14213D]/30"}`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}

export default function LeaguePage() {
  const { league_key } = useParams<{ league_key: string }>();
  const [history, setHistory] = useState<LeagueHistory | null>(null);
  const [step, setStep] = useState<Step>("league");
  const [error, setError] = useState<string | null>(null);
  const [allTime, setAllTime] = useState(false);

  useEffect(() => {
    if (!league_key) return;
    let cancelled = false;

    async function load() {
      // Check sessionStorage first — instant if we visited before this session
      const cached = getCachedHistory(league_key);
      if (cached) {
        setHistory(cached);
        return;
      }

      // Step 1: fetch main league data
      setStep("league");
      let data: LeagueHistory;
      try {
        const res = await fetch(`/api/leagues/${encodeURIComponent(league_key)}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (res.status === 503) {
            setError("sign_in_required");
            return;
          }
          throw new Error(body.message ?? `HTTP ${res.status}`);
        }
        data = await res.json();
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load league");
        return;
      }
      if (cancelled) return;

      // Reveal
      setStep("done");
      setCachedHistory(data);
      // Brief pause on "Building your dashboard" so it doesn't feel instant-jarring
      await new Promise((r) => setTimeout(r, 600));
      if (!cancelled) setHistory(data);
    }

    load();
    return () => { cancelled = true; };
  }, [league_key]);

  if (error) {
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

  if (!history) {
    return <LoadingScreen step={step} />;
  }

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

        {/* Shared toggle */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-[#14213D]/60">Show:</span>
          <button
            onClick={() => setAllTime(false)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              !allTime ? "bg-[#FCA311] text-[#14213D]" : "bg-[#E5E5E5] text-[#14213D]/60 hover:text-[#14213D]"
            }`}
          >
            Current season
          </button>
          <button
            onClick={() => setAllTime(true)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              allTime ? "bg-[#FCA311] text-[#14213D]" : "bg-[#E5E5E5] text-[#14213D]/60 hover:text-[#14213D]"
            }`}
          >
            All time
          </button>
        </div>

        <section>
          <h2 className="text-xl font-semibold mb-4 text-[#14213D]">Finishing position by year</h2>
          <RankChart history={history} allTime={allTime} />
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4 text-[#14213D]">All-time leaderboard</h2>
          <LeaderboardTable history={history} />
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4 text-[#14213D]">Head-to-head records</h2>
          <H2HMatrix history={history} allTime={allTime} />
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4 text-[#14213D]">Trophy case</h2>
          <TrophyCase history={history} />
        </section>
      </div>
    </main>
  );
}