// /dashboard: v1's home screen, rebuilt step by step.
import { Hero } from "@/components/dashboard/Hero";
import { SetupCard } from "@/components/dashboard/SetupCard";
import { TopRow } from "@/components/dashboard/TopRow";

export default function DashboardPage() {
  return (
    <>
      <TopRow />
      <SetupCard />
      <Hero />
    </>
  );
}
