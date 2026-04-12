"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "needs_oauth"; league_id: string }
  | { kind: "error"; message: string };

export default function LeagueForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const autoSubmitted = useRef(false);

  // Auto-submit when returning from OAuth with ?league= param
  useEffect(() => {
    const league = searchParams.get("league");
    if (league && !autoSubmitted.current) {
      autoSubmitted.current = true;
      setValue(league);
      // Trigger resolve after a tick so state is set
      setTimeout(() => {
        const form = document.querySelector("form");
        form?.requestSubmit();
      }, 0);
    }
    const authError = searchParams.get("auth_error");
    if (authError) {
      setStatus({ kind: "error", message: "Yahoo sign-in failed. Please try again." });
    }
  }, [searchParams]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    setStatus({ kind: "loading" });
    try {
      const res = await fetch(`/api/leagues/resolve?url=${encodeURIComponent(value)}`);
      const data = await res.json();
      if (res.ok && data.league_key) {
        router.push(`/league/${data.league_key}`);
        return;
      }
      if (res.status === 202 && data.needs_oauth) {
        setStatus({ kind: "needs_oauth", league_id: data.league_id });
        return;
      }
      setStatus({
        kind: "error",
        message: data.hint ?? data.error ?? "Could not parse that URL.",
      });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  }

  return (
    <div className="space-y-3">
      <form className="flex flex-col gap-3" onSubmit={onSubmit}>
        <input
          name="url"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://basketball.fantasysports.yahoo.com/nba/12345"
          className="w-full px-4 py-3 rounded-lg border border-[#E5E5E5] text-[#000000] placeholder-[#14213D]/40 focus:outline-none focus:ring-2 focus:ring-[#FCA311] focus:border-[#FCA311]"
        />
        <button
          type="submit"
          disabled={status.kind === "loading"}
          className="px-4 py-3 rounded-lg bg-[#FCA311] text-[#14213D] font-semibold hover:bg-[#FCA311]/90 disabled:opacity-50"
        >
          {status.kind === "loading" ? "Loading…" : "Load my league"}
        </button>
      </form>

      {status.kind === "needs_oauth" && (
        <div className="text-left p-4 rounded-lg bg-[#FCA311]/10 border border-[#FCA311]/40 text-sm text-[#14213D]">
          <p className="font-semibold">Yahoo sign-in required</p>
          <p className="mt-1">
            Found league ID <span className="font-mono">{status.league_id}</span>. Sign in
            with your Yahoo account so we can fetch your league history.
          </p>
          <a
            href={`/api/auth/yahoo?league=${encodeURIComponent(value)}`}
            className="mt-3 inline-block px-4 py-2 rounded-lg bg-[#FCA311] text-[#14213D] font-semibold hover:bg-[#FCA311]/90 transition-colors"
          >
            Sign in with Yahoo
          </a>
        </div>
      )}

      {status.kind === "error" && (
        <div className="text-left p-4 rounded-lg bg-[#E5E5E5] border border-[#14213D]/20 text-sm text-[#14213D]">
          {status.message}
        </div>
      )}
    </div>
  );
}
