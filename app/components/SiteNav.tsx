import Image from "next/image";
import Link from "next/link";

/** Translucent top bar: 44px, hairline underneath, no shadow. */
export default function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-canvas/80 backdrop-blur-xl">
      <nav className="mx-auto flex h-11 max-w-5xl items-center justify-between px-6" aria-label="Main">
        <Link href="/" className="flex items-center gap-2 text-ink no-underline">
          <Image src="/logo.png" alt="" width={22} height={22} className="rounded-md" />
          <span className="callout hidden whitespace-nowrap font-semibold sm:inline">Fantasy Survivors</span>
        </Link>
        <div className="callout flex items-center gap-5 whitespace-nowrap sm:gap-6">
          <Link href="/" className="text-ink-80 no-underline hover:text-primary">League History</Link>
          <Link href="/health-check" className="text-ink-80 no-underline hover:text-primary">Team Health</Link>
        </div>
      </nav>
    </header>
  );
}
