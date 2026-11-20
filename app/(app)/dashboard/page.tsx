"use client";
// /dashboard: v1's home screen. With no plan yet it shows only the welcome that launches one.
import { Hero } from "@/components/dashboard/Hero";
import { PlanOnboarding } from "@/components/dashboard/PlanOnboarding";
import { SetupCard } from "@/components/dashboard/SetupCard";
import { TopRow } from "@/components/dashboard/TopRow";
import { useQuery } from "@/lib/db/client";

export default function DashboardPage() {
  const { data } = useQuery("setup.status");
  if (!data) return null;
  if (!data.hasPlan) return <PlanOnboarding />;
  return (
    // v1's page padding (the app frame has none, so the welcome above can run edge to edge)
    <div className="px-[clamp(18px,3.5vw,44px)] pt-[34px] pb-20 max-[760px]:pb-[100px]">
      <TopRow />
      <SetupCard />
      <Hero />
    </div>
  );
}
