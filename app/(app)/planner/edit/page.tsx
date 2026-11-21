"use client";
// /planner/edit: Edit plan (components/planner/EditPlan.tsx), opened from Manage plan. The plan's name and
// description, Add a day, and every day's editor (tasks, type, hours, note, linked questions).

import { Page } from "@/components/app/Page";
import { EditPlan } from "@/components/planner/EditPlan";

export default function EditPlanPage() {
  return (
    <Page>
      <EditPlan />
    </Page>
  );
}
