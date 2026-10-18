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
    <div className="space-y-4">
      <form className="flex flex-col gap-3" onSubmit={onSubmit}>
        <input
          name="url"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://basketball.fantasysports.yahoo.com/nba/12345"
          aria-label="Yahoo league URL"
          className="field"
        />
        <button type="submit" disabled={status.kind === "loading"} className="btn btn-primary">
          {status.kind === "loading" ? "Loading…" : "Load my league"}
        </button>
      </form>

      {status.kind === "needs_oauth" && (
        <div className="rounded-[14px] bg-parchment p-5 text-left">
          <p className="font-semibold">Yahoo sign-in required</p>
          <p className="callout mt-1 text-ink-80">
            Found league ID <span className="font-mono">{status.league_id}</span>. Sign in
            with your Yahoo account so we can fetch your league history.
          </p>
          <a
            href={`/api/auth/yahoo?league=${encodeURIComponent(value)}`}
            className="btn btn-primary mt-4"
          >
            Sign in with Yahoo
          </a>
        </div>
      )}

      {status.kind === "error" && (
        <div role="alert" className="callout rounded-[14px] bg-parchment p-4 text-left text-danger">
          {status.message}
        </div>
      )}
    </div>
  );
}
