// /dev: a workbench for viewing every UI element. Only exists in dev mode (`bun run dev`);
// in a production build every /dev page is a 404.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Link, Pill, ThemeToggle, ToastProvider } from "@/components/ui";

export const metadata: Metadata = { title: "Orbit · dev", robots: { index: false, follow: false } };

export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <ToastProvider>
      <div className="min-h-screen">
        <header className="sticky top-0 z-20 flex flex-wrap items-center gap-4 border-b border-line bg-pad/88 px-[clamp(16px,3vw,32px)] py-3 glass-blur">
          <Link href="/dev" variant="subtle" className="font-display text-[1.15rem] font-extrabold text-ink!">
            Orbit
          </Link>
          <Pill tone="amber">DEV ONLY</Pill>
          <nav aria-label="Dev pages" className="mr-auto flex flex-wrap gap-1">
            <Link href="/dev/components" variant="nav">
              Components
            </Link>
            <Link href="/dev/db" variant="nav">
              Database
            </Link>
            <Link href="/" variant="nav">
              App
            </Link>
          </nav>
          <ThemeToggle />
        </header>
        <main className="mx-auto grid max-w-[1200px] gap-[22px] px-[clamp(16px,3vw,32px)] pt-7 pb-20">{children}</main>
      </div>
    </ToastProvider>
  );
}
