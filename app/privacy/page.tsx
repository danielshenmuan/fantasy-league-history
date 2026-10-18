import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Fantasy League History",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="headline text-ink">{title}</h2>
      <div className="text-ink-80 space-y-2 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="flex-1 bg-white">
      <div className="max-w-2xl mx-auto p-6 py-12 space-y-8">
        <div>
          <Link href="/" className="callout text-primary">
            &lsaquo; Home
          </Link>
        </div>

        <header>
          <h1 className="title-1 text-ink">Privacy Policy</h1>
          <p className="mt-2 text-sm text-ink-48">Last updated: April 2026</p>
        </header>

        <Section title="What this app does">
          <p>
            Fantasy League History lets you visualize your Yahoo Fantasy Basketball
            league&apos;s history — standings, head-to-head records, and all-time stats.
            To load your league, you sign in with your Yahoo account so we can read your
            league data on your behalf.
          </p>
        </Section>

        <Section title="What data we access">
          <p>We request read-only access to your Yahoo Fantasy Sports data, specifically:</p>
          <ul className="list-disc list-inside space-y-1 mt-1">
            <li>League standings and matchup results</li>
            <li>Team names and manager identifiers</li>
            <li>Historical season data for leagues you&apos;ve participated in</li>
          </ul>
          <p className="mt-2">
            We do <strong>not</strong> access your Yahoo email, personal profile, contacts,
            or any data outside of Fantasy Sports.
          </p>
        </Section>

        <Section title="How data is stored">
          <p>
            <strong>Session tokens</strong> — When you sign in with Yahoo, your OAuth
            access token is encrypted using AES-256 and stored in a secure,
            HTTP-only browser cookie. It is never written to a database or logged.
          </p>
          <p>
            <strong>League data</strong> — Your league history is temporarily cached on
            the server to avoid re-fetching it on every visit. This cache is stored in
            ephemeral server memory and resets automatically every few hours. It is never
            stored in a permanent database.
          </p>
          <p>
            <strong>No account is created.</strong> We do not store your name, email
            address, or any personally identifiable information.
          </p>
        </Section>

        <Section title="Third parties">
          <p>
            <strong>Yahoo</strong> — League data is fetched from the Yahoo Fantasy Sports
            API under your authorization. Yahoo&apos;s own privacy policy applies to your
            Yahoo account.
          </p>
          <p>
            <strong>Vercel</strong> — This app is hosted on Vercel. Vercel collects
            standard server access logs and anonymized page view analytics. See{" "}
            <a
              href="https://vercel.com/legal/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Vercel&apos;s privacy policy
            </a>
            .
          </p>
        </Section>

        <Section title="Cookies">
          <p>
            We use a single HTTP-only cookie to store your encrypted Yahoo session token.
            This cookie is required for the app to function when you sign in. It expires
            after 30 days or when you clear your browser cookies.
          </p>
          <p>
            We do not use advertising cookies or third-party tracking cookies.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            You can revoke this app&apos;s access to your Yahoo account at any time from
            your{" "}
            <a
              href="https://login.yahoo.com/account/security"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Yahoo account security settings
            </a>
            . Clearing your browser cookies will also remove your local session.
          </p>
        </Section>

      </div>
    </main>
  );
}