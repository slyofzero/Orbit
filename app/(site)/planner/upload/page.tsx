"use client";
import { useRouter } from "next/navigation";
import BackToPlanner from "@/components/BackToPlanner";
import PageLoading from "@/components/PageLoading";
import PlanImport from "@/components/PlanImport";
import { usePlan } from "@/lib/store";

// /planner/upload: replace the whole plan with a JSON file.
export default function UploadPlanPage() {
  const router = useRouter();
  const { ready } = usePlan();
  if (!ready) return <PageLoading />;
  return (
    <>
      <div className="row" style={{ alignItems: "center", marginBottom: 18 }}>
        <h1>Upload plan</h1>
        <div className="right"><BackToPlanner /></div>
      </div>
      <PlanImport onDone={() => router.push("/planner")} />
    </>
  );
}
