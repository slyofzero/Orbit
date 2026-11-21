"use client";
// The frame around every app page (v1's shell): the rail on the left (a bottom bar on phones) and the page.
// It also guards the routes: until a plan is loaded every page redirects to /onboarding (the only thing to
// do is load one), and /onboarding redirects to /dashboard once there is one. On /onboarding the rail is
// left out and the theme switch floats in the top-right corner instead. Nothing is shown until we know
// whether a plan exists, so neither the rail nor a page flashes while the database opens.

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { IconBars, IconHome, IconLines, IconStar } from "@/components/icons";
import { NavRail, ThemeToggle } from "@/components/ui";
import { useQuery } from "@/lib/db/client";

const ONBOARDING = "/onboarding";

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
  const onboarding = path === ONBOARDING;
  const goTo = data && (hasPlan ? (onboarding ? "/dashboard" : null) : onboarding ? null : ONBOARDING);

  useEffect(() => {
    if (goTo) router.replace(goTo);
  }, [goTo, router]);

  if (!data || goTo) return null;

  if (!hasPlan)
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
        footer={<ThemeToggle compact />}
      />
      <main className="w-full max-w-[1760px]">{children}</main>
    </div>
  );
}
