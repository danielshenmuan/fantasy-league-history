import { notFound } from "next/navigation";
import Link from "next/link";
import { loadLeagueHistory } from "@/lib/data";
import RankChart from "@/app/components/RankChart";
import TrophyCase from "@/app/components/TrophyCase";
import LeaderboardTable from "@/app/components/LeaderboardTable";
import H2HMatrix from "@/app/components/H2HMatrix";

type Params = { league_key: string };

export default async function LeaguePage({ params }: { params: Promise<Params> }) {
  const { league_key } = await params;
  const history = await loadLeagueHistory(league_key);
  if (!history) notFound();

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
          <H2HMatrix history={history} />
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-semibold mb-4 text-[#14213D]">Trophy case</h2>
          <TrophyCase history={history} />
        </section>
      </div>
    </main>
  );
}
