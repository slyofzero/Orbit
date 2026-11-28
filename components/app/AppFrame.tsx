"use client";
// The frame around every app page (v1's shell): the rail on the left (a bottom bar on phones) and the page.
// It also guards the routes: until a plan is loaded, or the user pressed "Skip for now" on /onboarding
// (setup.status `skipped`), every page redirects to /onboarding, and /onboarding redirects to /dashboard once
// there is a plan. Without a plan the dashboard shows the setup guide instead. On /onboarding the rail is
// left out and the theme switch floats in the top-right corner instead. Nothing is shown until we know
// whether a plan exists, so neither the rail nor a page flashes while the database opens.

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { IconBars, IconHome, IconLines, IconStar } from "@/components/icons";
import { NavRail, ThemeToggle } from "@/components/ui";
import { Companion } from "@/components/companion";
import { dbCall, useQuery } from "@/lib/db/client";
import { todayIST } from "@/lib/dates";

const ONBOARDING = "/onboarding";
const EXAM = "/exam";

const NAV = [
  { href: "/dashboard", label: "Today", icon: <IconHome /> },
  { href: "/planner", label: "Planner", icon: <IconLines /> },
  { href: "/practice", label: "Practice", icon: <IconStar /> },
  { href: "/stats", label: "Stats", icon: <IconBars /> },
];

export function AppFrame({ children }: { children: ReactNode }) {
  const { data } = useQuery("setup.status");
  const router = useRouter();
  const path = usePathname();
  const hasPlan = data?.hasPlan === true;
  const ready = hasPlan || data?.skipped === true; // the app opens: with a plan, or set up skipped
  const onboarding = path === ONBOARDING;
  const goTo = data && (hasPlan && onboarding ? "/dashboard" : !ready && !onboarding ? ONBOARDING : null);

  useEffect(() => {
    if (goTo) router.replace(goTo);
  }, [goTo, router]);

  // Carry-over (docs/PLANS.md §5): once a day is over, its unfinished work becomes bonus work on the next planned
  // days. Written when the app opens and again when the date changes (checked every minute and on coming back to
  // the tab); a second run the same day does nothing.
  useEffect(() => {
    if (!hasPlan) return;
    let last = "";
    const carry = () => {
      const today = todayIST();
      if (today === last) return;
      last = today;
      dbCall("plan.carry", { today }).catch(() => {
        last = ""; // try again next time
      });
    };
    carry();
    const timer = setInterval(carry, 60_000);
    document.addEventListener("visibilitychange", carry);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", carry);
    };
  }, [hasPlan]);

  if (!data || goTo) return null;

  // A mock test fills the screen: no rail, no theme switch (components/exam/).
  if (ready && (path === EXAM || path.startsWith(`${EXAM}/`))) return <main className="w-full">{children}</main>;

  if (!ready)
    return (
      <>
        <main className="w-full">{children}</main>
        <div className="fixed top-4 right-4 z-40">
          <ThemeToggle compact />
        </div>
      </>
    );

  return (
    <div className="grid min-h-screen grid-cols-[96px_minmax(0,1fr)] max-[760px]:grid-cols-1">
      <NavRail
        items={NAV}
        brand={{ title: "Orbit", subtitle: "study hub", href: "/dashboard" }}
        stage={<Companion />}
        footer={<ThemeToggle compact />}
      />
      <main className="w-full max-w-[1760px]">{children}</main>
    </div>
  );
}
