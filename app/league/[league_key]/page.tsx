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
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2 text-center">
          <h2 className="title-2">Loading your league</h2>
          <p className="callout text-ink-48">This takes about 30–60 seconds on first load.</p>
        </div>
        <ol className="space-y-4">
          {steps.map((s, idx) => {
            const isDone = idx < currentIdx;
            const isActive = idx === currentIdx;
            return (
              <li key={s.key} className="flex items-center gap-3">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                    isDone ? "border-primary bg-primary" : isActive ? "border-primary" : "border-hairline"
                  }`}
                >
                  {isDone ? (
                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isActive ? (
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary" />
                  ) : null}
                </span>
                <span className={`callout ${isDone || isActive ? "text-ink" : "text-ink-48"} ${isActive ? "font-semibold" : ""}`}>
                  {s.label}
                </span>
              </li>
            );
          })}
        </ol>
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
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-sm space-y-4 py-16 text-center">
          {error === "sign_in_required" ? (
            <>
              <h2 className="title-2">Yahoo sign-in required</h2>
              <p className="text-ink-48">Sign in with your Yahoo account to load your league.</p>
              <a href={`/api/auth/yahoo?league=${encodeURIComponent(league_key)}`} className="btn btn-primary mt-2">
                Sign in with Yahoo
              </a>
            </>
          ) : (
            <>
              <h2 className="title-2">Something went wrong</h2>
              <p className="callout font-mono text-ink-48">{error}</p>
              <Link href="/" className="inline-block text-primary">&lsaquo; Back home</Link>
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
    <main className="flex-1">
      <div className="mx-auto max-w-5xl space-y-16 px-6 pb-24 pt-8">
        <header className="space-y-2">
          <Link href="/" className="callout text-primary">&lsaquo; Home</Link>
          <h1 className="title-1 pt-2">{history.league_name}</h1>
          <p className="text-ink-48">
            {yearRange} · {history.num_teams} managers · last updated {fetchedAt}
          </p>
          <p className="caption font-mono text-ink-48">{history.league_key}</p>
        </header>

        {/* Shared toggle: filter chips, active = filled primary */}
        <div className="flex items-center gap-2" role="group" aria-label="Time range">
          <button className="chip-filter" aria-pressed={!allTime} onClick={() => setAllTime(false)}>
            Current season
          </button>
          <button className="chip-filter" aria-pressed={allTime} onClick={() => setAllTime(true)}>
            All time
          </button>
        </div>

        <section>
          <h2 className="title-2 mb-6">Finishing position by year</h2>
          <RankChart history={history} allTime={allTime} />
        </section>

        <section>
          <h2 className="title-2 mb-6">All-time leaderboard</h2>
          <LeaderboardTable history={history} />
        </section>

        <section>
          <h2 className="title-2 mb-6">Head-to-head records</h2>
          <H2HMatrix history={history} allTime={allTime} />
        </section>

        <section>
          <h2 className="title-2 mb-6">Trophy case</h2>
          <TrophyCase history={history} />
        </section>
      </div>
    </main>
  );
}
