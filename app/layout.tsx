import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import SiteNav from "@/app/components/SiteNav";
import "./globals.css";

// Apple platforms get SF Pro via the system stack; Inter is the off-Apple substitute.
// Only the 400 / 600 / 700 weights are loaded: the weight ladder bans 500.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "Fantasy League History",
  description: "Visualize your Yahoo Fantasy Basketball league's full history — standings, head-to-head records, and all-time leaderboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <SiteNav />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
