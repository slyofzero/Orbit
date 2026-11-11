"use client";
import Link from "next/link";
import BackToPlanner from "@/components/BackToPlanner";
import PageLoading from "@/components/PageLoading";
import PlanEdit from "@/components/PlanEdit";
import { usePlan } from "@/lib/store";

// /planner/edit: change days one by one, or update only some dates from a JSON file.
export default function EditPlanPage() {
  const { days, ready } = usePlan();
  if (!ready) return <PageLoading />;
  return (
    <>
      <div className="row" style={{ alignItems: "center", marginBottom: 18 }}>
        <h1>Edit plan</h1>
        <div className="right"><BackToPlanner /></div>
      </div>
      {days.length ? <PlanEdit /> : (
        <div className="panel">
          <p style={{ marginTop: 0 }}>There is no plan to edit yet.</p>
          <Link className="btn primary" href="/planner/upload">Upload a plan</Link>
        </div>
      )}
    </>
  );
}
