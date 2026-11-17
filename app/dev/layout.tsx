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
      <div className="dv-shell">
        <header className="dv-top">
          <Link href="/dev" variant="subtle" className="dv-brand">Orbit</Link>
          <Pill tone="amber">DEV ONLY</Pill>
          <nav aria-label="Dev pages" className="dv-nav">
            <Link href="/dev/components" variant="nav">Components</Link>
            <Link href="/" variant="nav">App</Link>
          </nav>
          <ThemeToggle />
        </header>
        <main className="dv-main">{children}</main>
      </div>
    </ToastProvider>
  );
}
