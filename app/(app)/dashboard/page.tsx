// /dashboard: v1's home screen, rebuilt step by step.
import { SetupCard } from "@/components/dashboard/SetupCard";
import { TopRow } from "@/components/dashboard/TopRow";

export default function DashboardPage() {
  return (
    <>
      <TopRow />
      <SetupCard />
    </>
  );
}
