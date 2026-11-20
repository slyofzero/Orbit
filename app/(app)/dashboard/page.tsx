"use client";
// /dashboard: v1's home screen. With no plan yet it shows only the welcome that launches one; right after
// a launch, LaunchWarp plays over the dashboard and its sections rise in as the overlay dissolves.
import { useState, type ReactNode } from "react";
import { LAUNCH_MS, LaunchWarp } from "@/components/background/LaunchWarp";
import { Hero } from "@/components/dashboard/Hero";
import { PlanOnboarding } from "@/components/dashboard/PlanOnboarding";
import { SetupCard } from "@/components/dashboard/SetupCard";
import { TopRow } from "@/components/dashboard/TopRow";
import { useQuery } from "@/lib/db/client";

/** After a launch: each section rises in, one after another, as the launch overlay fades (from ~1s). */
function Rise({ on, i, children }: { on: boolean; i: number; children: ReactNode }) {
  if (!on) return <>{children}</>;
  return (
    <div
      className="animate-card-in"
      style={{ animationDelay: `${LAUNCH_MS * 0.63 + i * 120}ms`, animationFillMode: "both" }}
    >
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const { data } = useQuery("setup.status");
  const [launching, setLaunching] = useState<string | null>(null); // the plan being launched
  const [landed, setLanded] = useState(false); // after a launch: sections rise in (once, as they mount)
  if (!data) return null;

  const warp = launching && (
    <LaunchWarp
      title={launching}
      onDone={() => setLaunching(null)} // keep `landed`: unwrapping the sections would rebuild them
    />
  );
  // The overlay stays in the same place in the tree, so it keeps playing when the page switches
  // from the welcome to the dashboard halfway through the launch.
  const page = !data.hasPlan ? (
    <PlanOnboarding
      onLaunched={(name) => {
        setLaunching(name);
        setLanded(true);
      }}
    />
  ) : (
    // v1's page padding (the app frame has none, so the welcome above can run edge to edge)
    <div className="px-[clamp(18px,3.5vw,44px)] pt-[34px] pb-20 max-[760px]:pb-[100px]">
      <Rise on={landed} i={0}>
        <TopRow />
      </Rise>
      <Rise on={landed} i={1}>
        <SetupCard />
      </Rise>
      <Rise on={landed} i={2}>
        <Hero />
      </Rise>
    </div>
  );
  return (
    <>
      {page}
      {warp}
    </>
  );
}
