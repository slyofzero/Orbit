"use client";
// /planner/manage: Manage plan (components/planner/ManagePlan.tsx). Every task of the plan in a table, and the
// plan's actions (Link questions, Unlink questions, Edit, Export, Upload) that used to sit on the Planner's header.

import { Page } from "@/components/app/Page";
import { ManagePlan } from "@/components/planner/ManagePlan";

export default function ManagePlanPage() {
  return (
    <Page>
      <ManagePlan />
    </Page>
  );
}
