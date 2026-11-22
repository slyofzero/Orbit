"use client";
// The launch sequence after a plan is imported. It lives above the pages (in the app layout) because the
// import happens on /onboarding and the dashboard is where the user lands: the overlay keeps playing while
// the route changes underneath it. `landed` stays true afterwards so the dashboard's sections rise in.

import { createContext, useContext, useState, type ReactNode } from "react";
import { LaunchWarp } from "@/components/background/LaunchWarp";

type Launch = { landed: boolean; start: (planName: string) => void };

const Ctx = createContext<Launch>({ landed: false, start: () => {} });

export const useLaunch = () => useContext(Ctx);

export function LaunchProvider({ children }: { children: ReactNode }) {
  const [launching, setLaunching] = useState<string | null>(null); // the plan being launched
  const [landed, setLanded] = useState(false);
  return (
    <Ctx.Provider
      value={{
        landed,
        start: (name) => {
          setLaunching(name);
          setLanded(true);
        },
      }}
    >
      {children}
      {launching && <LaunchWarp title={launching} onDone={() => setLaunching(null)} />}
    </Ctx.Provider>
  );
}
