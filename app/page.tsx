import { Suspense } from "react";
import Link from "next/link";
import LeagueForm from "@/app/components/LeagueForm";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-white p-6">
      <div className="max-w-xl w-full space-y-8 text-center">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-[#14213D]">
            Fantasy League History
          </h1>
          <p className="mt-3 text-[#14213D]/70">
            Your Yahoo Fantasy Basketball league&apos;s full history — visualized.
            Paste your league URL and we do the rest.
          </p>
        </div>

        <Suspense>
          <LeagueForm />
        </Suspense>

        <div className="text-sm text-[#14213D]/70">
          <p>Want to see what the dashboard looks like?</p>
          <Link
            href="/league/428.l.12345"
            className="text-[#FCA311] hover:underline font-medium"
          >
            View the demo league →
          </Link>
        </div>
      </div>
    </main>
  );
}
