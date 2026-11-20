"use client";
// The frame around every app page (v1's shell): the rail on the left (a bottom bar on phones) and the page.
// Until a plan is loaded the only thing to do is load one, so the rail is left out and the theme switch
// floats in the top-right corner instead. The rail only appears once we know a plan exists, so it never
// flashes in and out while the database opens.

import type { ReactNode } from "react";
import { IconBars, IconHome, IconLines, IconStar } from "@/components/icons";
import { NavRail, ThemeToggle } from "@/components/ui";
import { useQuery } from "@/lib/db/client";

const NAV = [
  { href: "/dashboard", label: "Today", icon: <IconHome /> },
  { href: "/planner", label: "Planner", icon: <IconLines /> },
  { href: "/practice", label: "Practice", icon: <IconStar /> },
  { href: "/stats", label: "Stats", icon: <IconBars /> },
];

export function AppFrame({ children }: { children: ReactNode }) {
  const { data } = useQuery("setup.status");
  const hasPlan = data?.hasPlan === true;

  if (!hasPlan)
    return (
      <>
        <main className="w-full">{children}</main>
        {data && (
          <div className="fixed top-4 right-4 z-40">
            <ThemeToggle compact />
          </div>
        )}
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
