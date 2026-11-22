"use client";
// /onboarding: the welcome that launches a plan. Every app page sends the user here until a plan is loaded
// (AppFrame); once one is, this page sends them on to /dashboard while the launch sequence plays.

import { useLaunch } from "@/components/app/Launch";
import { PlanOnboarding } from "@/components/dashboard/PlanOnboarding";

export default function OnboardingPage() {
  const { start } = useLaunch();
  return <PlanOnboarding onLaunched={start} />;
}
