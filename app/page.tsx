import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import LeagueForm from "@/app/components/LeagueForm";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-white p-6">
      <div className="max-w-xl w-full space-y-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <Image
            src="/logo.png"
            alt="Fantasy Survivors"
            width={96}
            height={96}
            className="rounded-2xl"
            priority
          />
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-[#14213D]">
              Fantasy League History
            </h1>
            <p className="mt-3 text-[#14213D]/70">
              Your Yahoo Fantasy Basketball league&apos;s full history — visualized.
              Paste your league URL and we do the rest.
            </p>
          </div>
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

        <div className="space-y-3">
          <p className="text-sm text-[#14213D]/50">Follow Fantasy Survivors for more</p>
          <div className="flex items-center justify-center gap-4">
            <a
              href="https://www.facebook.com/profile.php?id=100086952001076"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#14213D]/40 hover:text-[#FCA311] transition-colors"
              aria-label="Facebook"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
              </svg>
            </a>
            <a
              href="https://www.threads.com/@fantasysurvivors"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#14213D]/40 hover:text-[#FCA311] transition-colors"
              aria-label="Threads"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 192 192" fill="currentColor">
                <path d="M141.537 88.988a66 66 0 0 0-2.518-1.143c-1.482-27.307-16.403-42.94-41.457-43.1h-.34c-14.986 0-27.449 6.396-35.12 18.036l13.779 9.452c5.73-8.695 14.724-10.548 21.348-10.548h.229c8.249.053 14.474 2.452 18.503 7.129 2.932 3.405 4.893 8.111 5.864 14.05-7.314-1.243-15.224-1.626-23.68-1.14-23.82 1.371-39.134 15.264-38.105 34.568.522 9.792 5.4 18.216 13.735 23.719 7.047 4.652 16.124 6.927 25.557 6.412 12.458-.683 22.231-5.436 29.049-14.127 5.178-6.6 8.453-15.153 9.899-25.93 5.937 3.583 10.337 8.298 12.767 13.966 4.132 9.635 4.373 25.468-8.546 38.318-11.319 11.258-24.925 16.135-45.488 16.285-22.809-.169-40.06-7.484-51.275-21.742C35.236 139.966 29.808 120.682 29.605 96c.203-24.682 5.63-43.966 16.133-57.317C56.954 24.425 74.206 17.11 97.014 16.94c22.975.17 40.526 7.52 52.171 21.847 5.71 7.026 10.015 15.86 12.853 26.162l16.147-4.308c-3.44-12.68-8.853-23.606-16.219-32.668C147.036 9.607 125.202.195 97.15 0h-.3C68.822.194 47.239 9.643 32.934 28.069 20.006 44.479 13.314 67.575 13.01 96.04L13 96l.01.04c.304 28.464 7.006 51.559 19.934 67.969C48.239 182.358 69.822 191.806 96.85 192h.3c24.01-.172 43.08-6.606 57.807-20.174 18.943-17.78 18.91-41.437 12.476-55.568-4.686-10.919-13.64-19.64-25.896-25.27Zm-45.234 44.04c-10.426.583-21.24-4.097-21.82-14.135-.427-8.014 5.702-16.951 24.167-18.004 2.114-.122 4.19-.181 6.231-.181 6.032 0 11.676.586 16.836 1.693-1.913 23.84-14.771 30.027-25.414 30.627Z"/>
              </svg>
            </a>
            <a
              href="https://www.instagram.com/fantasysurvivors"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#14213D]/40 hover:text-[#FCA311] transition-colors"
              aria-label="Instagram"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
              </svg>
            </a>
          </div>
        </div>

        <p className="text-xs text-[#14213D]/30">
          <Link href="/privacy" className="hover:text-[#FCA311] transition-colors">
            Privacy Policy
          </Link>
        </p>
      </div>
    </main>
  );
}
