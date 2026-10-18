import type { Metadata } from "next";
import Link from "next/link";
import { SAMPLE, type Band, type Confidence } from "@/lib/sample-health";

export const metadata: Metadata = {
  title: "Team Health Check — Fantasy League History",
  description: "See which categories your fantasy basketball roster wins, and where it is thin.",
};

const BAND: Record<Band, { label: string; badge: string; fill: string }> = {
  elite:   { label: "Elite",   badge: "bg-primary text-white",        fill: "bg-primary" },
  strong:  { label: "Strong",  badge: "bg-parchment text-primary",    fill: "bg-primary" },
  neutral: { label: "Neutral", badge: "bg-parchment text-ink-80",     fill: "bg-chip" },
  weak:    { label: "Weak",    badge: "bg-parchment text-danger",     fill: "bg-chip" },
};

const CONFIDENCE: Record<Confidence, { label: string; cls: string }> = {
  high:   { label: "Solid data",   cls: "bg-parchment text-ink-80" },
  medium: { label: "Some data",    cls: "bg-parchment text-ink-80" },
  low:    { label: "Small sample", cls: "bg-parchment text-warning" },
  none:   { label: "No data",      cls: "bg-parchment text-ink-48" },
};

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

export default function HealthCheckPage() {
  const best = SAMPLE.categories[0]!;
  const worst = SAMPLE.categories[SAMPLE.categories.length - 1]!;
  const weakCount = SAMPLE.categories.filter((c) => c.band === "weak").length;

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-3xl space-y-16 px-6 pb-24 pt-8">
        <header className="space-y-3">
          <Link href="/" className="callout text-primary">&lsaquo; Home</Link>
          <p className="caption pt-2 text-ink-48">Team Health Check · design preview with a sample team</p>
          <h1 className="title-hero">Where your team stands.</h1>
          <p className="max-w-xl text-[1.3125rem] leading-snug text-ink-48">
            Every category, compared with 500 simulated drafts in a league like yours.
          </p>
        </header>

        {/* Summary tile */}
        <section className="grid gap-4 sm:grid-cols-3" aria-label="Summary">
          <div className="rounded-[20px] bg-parchment p-6">
            <p className="caption text-ink-48">Strongest</p>
            <p className="title-2 mt-1">{best.label}</p>
            <p className="callout mt-1 text-ink-48">{ordinal(best.percentile)} percentile</p>
          </div>
          <div className="rounded-[20px] bg-parchment p-6">
            <p className="caption text-ink-48">Biggest hole</p>
            <p className="title-2 mt-1">{worst.label}</p>
            <p className="callout mt-1 text-ink-48">{ordinal(worst.percentile)} percentile</p>
          </div>
          <div className="rounded-[20px] bg-parchment p-6">
            <p className="caption text-ink-48">Weak categories</p>
            <p className="title-2 mt-1">{weakCount} of {SAMPLE.categories.length}</p>
            <p className="callout mt-1 text-ink-48">{SAMPLE.league}</p>
          </div>
        </section>

        {/* Categories */}
        <section aria-labelledby="cats">
          <h2 id="cats" className="title-2">Category by category</h2>
          <p className="callout mt-2 text-ink-48">Strongest first. The bar shows how many simulated teams you would beat.</p>
          <ul className="mt-6 overflow-hidden rounded-[14px] border border-hairline bg-pearl">
            {SAMPLE.categories.map((c, i) => {
              const b = BAND[c.band];
              return (
                <li key={c.key} className={`px-5 py-4 ${i > 0 ? "border-t border-divider-soft" : ""}`}>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <span className="font-semibold">{c.label}</span>
                      {c.hint && <span className="caption ml-2 text-ink-48">{c.hint}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="callout tabular-nums text-ink-48">{ordinal(c.percentile)}</span>
                      <span className={`caption rounded-full px-2.5 py-0.5 ${b.badge}`}>{b.label}</span>
                    </div>
                  </div>
                  <div
                    className="mt-3 h-1.5 overflow-hidden rounded-[3px] bg-hairline"
                    role="meter"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={c.percentile}
                    aria-label={`${c.label} percentile`}
                  >
                    <div className={`h-full rounded-[3px] ${b.fill}`} style={{ width: `${c.percentile}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Roster */}
        <section aria-labelledby="roster">
          <h2 id="roster" className="title-2">The roster</h2>
          <p className="callout mt-2 text-ink-48">How much each player&apos;s estimate can be trusted.</p>
          <ul className="mt-6 overflow-hidden rounded-[14px] border border-hairline">
            {SAMPLE.roster.map((p, i) => (
              <li key={p.name} className={`flex items-start justify-between gap-4 px-5 py-3 ${i > 0 ? "border-t border-divider-soft" : ""} ${p.il ? "bg-pearl" : ""}`}>
                <div className="min-w-0">
                  <p className={p.il ? "text-ink-48" : ""}>{p.name}{p.il && <span className="chip ml-2">IL</span>}</p>
                  {p.note && <p className="caption mt-0.5 text-ink-48">{p.note}</p>}
                </div>
                {!p.il && <span className={`caption shrink-0 rounded-full px-2.5 py-0.5 ${CONFIDENCE[p.confidence].cls}`}>{CONFIDENCE[p.confidence].label}</span>}
              </li>
            ))}
          </ul>
        </section>

        {/* How it works: disclosure */}
        <section>
          <details className="group rounded-[14px] bg-parchment p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
              How we scored this
              <span aria-hidden className="text-primary transition-transform group-open:rotate-90">&rsaquo;</span>
            </summary>
            <ul className="callout mt-4 list-disc space-y-2 pl-5 text-ink-80">
              {SAMPLE.assumptions.map((a) => <li key={a}>{a}</li>)}
            </ul>
          </details>
        </section>

        {/* Honest status */}
        <section className="rounded-[20px] bg-tile p-8 text-white">
          <h2 className="headline">This is a design preview.</h2>
          <p className="callout mt-2 text-white/70">
            The numbers above are real output for one sample roster. Pasting in your own team comes next.
          </p>
        </section>
      </div>
    </main>
  );
}
