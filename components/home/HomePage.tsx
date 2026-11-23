"use client";

import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import gsap from "gsap";
import { useQuery } from "@/lib/db/client";
import { Button, Heading, Link, Text, ThemeToggle, ToastProvider } from "@/components/ui";
import { IconArrowRight, IconStar } from "@/components/icons";
import { CosmicCanvas } from "@/components/background/cosmos/CosmicCanvas";
import { LaunchProvider, useLaunch } from "@/components/app/Launch";
import { PlanOnboarding } from "@/components/dashboard/PlanOnboarding";

// Client-only dynamic import of the 3D Three.js Sun element
const HomeSunR3F = dynamic(() => import("@/components/home/HomeSunR3F").then((m) => m.HomeSunR3F), {
  ssr: false,
});

export interface HomePageProps {
  initialView?: "home" | "onboarding";
}

function HomePageContent({ initialView }: HomePageProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data } = useQuery("setup.status");
  const { start } = useLaunch();
  const hasPlan = data?.hasPlan === true;

  const isStartParam = searchParams?.get("start") === "1" || searchParams?.get("onboarding") === "1";
  const [view, setView] = useState<"home" | "onboarding">(initialView ?? (isStartParam ? "onboarding" : "home"));

  const heroRef = useRef<HTMLDivElement>(null);
  const onboardingRef = useRef<HTMLDivElement>(null);
  const solarRef = useRef<HTMLDivElement>(null);
  const isTransitioning = useRef(false);
  const isInitialMount = useRef(true);

  // 1. Initial entrance animation: runs ONCE on page mount and NEVER touches solar system again
  useEffect(() => {
    const solarEl = solarRef.current;
    const heroEl = heroRef.current;
    const onbEl = onboardingRef.current;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      if (solarEl) gsap.set(solarEl, { opacity: 1, scale: 1 });
      if (heroEl) gsap.set(heroEl, { opacity: 1, x: 0 });
      if (onbEl) gsap.set(onbEl, { opacity: 1, x: 0 });
      return;
    }

    // Solar system entrance: scales and fades in once, then stays permanently
    if (solarEl) {
      gsap.fromTo(
        solarEl,
        { opacity: 0, scale: 0.95 },
        { opacity: 1, scale: 1, duration: 1.1, ease: "power2.out", delay: 0.25 },
      );
    }

    // Initial view entrance (text fades in from left)
    const initialEl = view === "home" ? heroEl : onbEl;
    if (initialEl) {
      gsap.fromTo(initialEl, { opacity: 0, x: -36 }, { opacity: 1, x: 0, duration: 0.85, ease: "power3.out" });
    }
  }, []); // Empty dependency array: runs strictly once on mount

  // 2. Handle browser back / forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const isStart = new URLSearchParams(window.location.search).get("start") === "1";
      if (isStart && view !== "onboarding") {
        setView("onboarding");
      } else if (!isStart && view !== "home") {
        setView("home");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [view]);

  // 3. Transition from Home -> Onboarding (hero text glides left, solar system stays untouched)
  const handleGoToOnboarding = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (isTransitioning.current) return;
    isTransitioning.current = true;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || !heroRef.current) {
      setView("onboarding");
      window.history.pushState({ view: "onboarding" }, "", "/?start=1");
      isTransitioning.current = false;
      return;
    }

    gsap.to(heroRef.current, {
      x: -44,
      opacity: 0,
      duration: 0.35,
      ease: "power2.in",
      onComplete: () => {
        setView("onboarding");
        window.history.pushState({ view: "onboarding" }, "", "/?start=1");
        isTransitioning.current = false;
      },
    });
  }, []);

  // 4. Transition from Onboarding -> Home (onboarding text glides left, solar system stays untouched)
  const handleBackToHero = useCallback((e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (isTransitioning.current) return;
    isTransitioning.current = true;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || !onboardingRef.current) {
      setView("home");
      window.history.pushState({ view: "home" }, "", "/");
      isTransitioning.current = false;
      return;
    }

    gsap.to(onboardingRef.current, {
      x: -44,
      opacity: 0,
      duration: 0.35,
      ease: "power2.in",
      onComplete: () => {
        setView("home");
        window.history.pushState({ view: "home" }, "", "/");
        isTransitioning.current = false;
      },
    });
  }, []);

  // 5. When view changes after mount, smoothly glide the incoming content in from the left
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    if (view === "onboarding" && onboardingRef.current) {
      gsap.fromTo(
        onboardingRef.current,
        { x: -44, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.45, ease: "power2.out" },
      );
    } else if (view === "home" && heroRef.current) {
      gsap.fromTo(heroRef.current, { x: -44, opacity: 0 }, { x: 0, opacity: 1, duration: 0.45, ease: "power2.out" });
    }
  }, [view]);

  const handleLaunched = (name: string) => {
    start(name);
    router.push("/dashboard");
  };

  return (
    <main className="relative min-h-screen w-full bg-pad text-ink overflow-x-hidden antialiased transition-colors">
      {/* Full-screen Solar System: stays continuously alive and visible at all times */}
      <div
        ref={solarRef}
        className="pointer-events-none fixed inset-0 z-0 size-full overflow-hidden"
        aria-hidden="true"
      >
        <CosmicCanvas sunX={0.68} sunY={0.5} />
        <div className="absolute top-[62%] lg:top-1/2 left-1/2 lg:left-[68%] -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <HomeSunR3F size={220} />
        </div>
      </div>

      {/* View 1: Sparse Hero Text & In-Place Navigation Links over the canvas */}
      {view === "home" && (
        <div
          ref={heroRef}
          className="relative z-10 flex min-h-screen flex-col justify-center px-6 sm:px-14 lg:px-20 py-12 max-w-xl lg:max-w-2xl"
        >
          <div className="max-w-md">
            {/* Title */}
            <Heading
              level={1}
              className="text-5xl sm:text-6xl lg:text-7xl font-display font-extrabold tracking-tight text-ink leading-none"
            >
              Orbit
            </Heading>

            {/* Extremely Sparse Text */}
            <div className="mt-4">
              <Text variant="body" className="text-base sm:text-lg text-gray leading-relaxed font-medium">
                A personal, exam-agnostic study hub. Day-by-day planner, targeted practice, mock tests, and stats.
              </Text>
            </div>

            {/* Primary Action Button */}
            <div className="mt-8">
              {hasPlan ? (
                <Button href="/dashboard" variant="special" size="lg" icon={<IconStar className="h-4 w-4" />}>
                  Resume Study Space
                </Button>
              ) : (
                <Button
                  onClick={handleGoToOnboarding}
                  variant="special"
                  size="lg"
                  icon={<IconArrowRight className="h-4 w-4" />}
                >
                  Launch Orbit
                </Button>
              )}
            </div>

            {/* In-Place Links present with the text */}
            <nav
              className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-gray"
              aria-label="Quick links"
            >
              <Link href="/planner" variant="subtle" className="hover:text-ink transition-colors">
                Planner
              </Link>
              <span className="text-line select-none">•</span>
              <Link href="/practice" variant="subtle" className="hover:text-ink transition-colors">
                Practice
              </Link>
              <span className="text-line select-none">•</span>
              <Link href="/practice?tab=mocks" variant="subtle" className="hover:text-ink transition-colors">
                Mock tests
              </Link>
              <span className="text-line select-none">•</span>
              <Link href="/stats" variant="subtle" className="hover:text-ink transition-colors">
                Stats
              </Link>
            </nav>

            {/* Theme Toggle & Local Storage Pill */}
            <div className="mt-12 flex items-center gap-4 pt-4 border-t border-line/60">
              <ThemeToggle compact />
              <span className="text-xs text-gray/80 font-mono">100% in-browser • SQLite WASM</span>
            </div>
          </div>
        </div>
      )}

      {/* View 2: Onboarding Steps (Smoothly glides in from the left while solar system stays visible) */}
      {view === "onboarding" && (
        <div
          ref={onboardingRef}
          className="relative z-10 w-full min-h-screen max-w-[840px] px-2 sm:px-6 lg:px-12 py-8 sm:py-12"
        >
          <PlanOnboarding onLaunched={handleLaunched} onBack={handleBackToHero} />
        </div>
      )}
    </main>
  );
}

export function HomePage(props: HomePageProps) {
  return (
    <ToastProvider>
      <LaunchProvider>
        <Suspense fallback={null}>
          <HomePageContent {...props} />
        </Suspense>
      </LaunchProvider>
    </ToastProvider>
  );
}
