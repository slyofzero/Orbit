"use client";
// The launch sequence after a plan is imported. It lives above the pages (in the app layout) because the
// import happens on /onboarding and the dashboard is where the user lands: the overlay keeps playing while
// the route changes underneath it. `landed` stays true afterwards so the dashboard's sections rise in.

import type { ReactNode } from "react";
import { useLaunch } from "@/lib/global";
import { LaunchWarp } from "@/components/background/LaunchWarp";

export { useLaunch } from "@/lib/global";

export function LaunchProvider({ children }: { children: ReactNode }) {
  const { launching, finish } = useLaunch();
  return (
    <>
      {children}
      {launching && <LaunchWarp title={launching} onDone={finish} />}
    </>
  );
}
