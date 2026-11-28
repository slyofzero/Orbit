"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { useMutation, useQuery } from "@/lib/db/client";
import { useLaunch } from "@/components/app/Launch";
import { PlanOnboarding } from "@/components/dashboard/PlanOnboarding";

export default function OnboardingPage() {
  const router = useRouter();
  const { data } = useQuery("setup.status");
  const { start } = useLaunch();
  const hasPlan = data?.hasPlan === true;
  const contentRef = useRef<HTMLDivElement>(null);

  // Once a plan exists, users should be on /dashboard, not /onboarding
  useEffect(() => {
    if (hasPlan) {
      router.replace("/dashboard");
    }
  }, [hasPlan, router]);

  // Smooth entrance of onboarding content from left
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      gsap.set(el, { opacity: 1, x: 0 });
      return;
    }
    gsap.fromTo(el, { opacity: 0, x: -36 }, { opacity: 1, x: 0, duration: 0.65, ease: "power2.out" });
  }, []);

  const handleLaunched = (name: string) => {
    start(name);
    router.push("/dashboard");
  };

  // "Skip for now": a plan is optional. Remember it (settings `setup_skipped`), so the app opens without one and
  // the dashboard shows the setup guide instead of sending the user back here.
  const setSetting = useMutation("settings.set");
  const handleSkip = async () => {
    const r = await setSetting.run({ key: "setup_skipped", value: "1" });
    if (r?.ok) router.push("/dashboard");
  };

  const handleBack = () => {
    router.push("/");
  };

  return (
    <div ref={contentRef} className="w-full min-h-screen max-w-[840px] px-2 sm:px-6 lg:px-12 py-8 sm:py-12">
      <PlanOnboarding onLaunched={handleLaunched} onBack={handleBack} onSkip={handleSkip} />
    </div>
  );
}
