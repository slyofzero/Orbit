"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import gsap from "gsap";
import { useQuery } from "@/lib/db/client";
import { Button, Heading, Link, Text, ThemeToggle } from "@/components/ui";
import { IconArrowRight, IconStar } from "@/components/icons";
import { CosmicCanvas } from "@/components/background/cosmos/CosmicCanvas";

// Client-only dynamic import of the 3D Three.js Sun element
const HomeSunR3F = dynamic(() => import("@/components/home/HomeSunR3F").then((m) => m.HomeSunR3F), {
  ssr: false,
});

export function HomePage() {
  const { data } = useQuery("setup.status");
  const hasPlan = data?.hasPlan === true;

  const textRef = useRef<HTMLDivElement>(null);
  const solarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const textEl = textRef.current;
    const solarEl = solarRef.current;
    if (!textEl || !solarEl) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      gsap.set([textEl, solarEl], { opacity: 1, x: 0, scale: 1 });
      return;
    }

    const ctx = gsap.context(() => {
      // Initial states
      gsap.set(textEl, { opacity: 0, x: -36 });
      gsap.set(solarEl, { opacity: 0, scale: 0.94 });

      // Choreographed entrance timeline:
      // 1. Text appears first as it fades in from the left
      // 2. A few moments later, the solar system becomes visible
      const tl = gsap.timeline();

      tl.to(textEl, {
        opacity: 1,
        x: 0,
        duration: 0.85,
        ease: "power3.out",
      }).to(
        solarEl,
        {
          opacity: 1,
          scale: 1,
          duration: 1.1,
          ease: "power2.out",
        },
        "+=0.25",
      );
    });

    return () => ctx.revert();
  }, []);

  return (
    <main className="relative min-h-screen w-full bg-pad text-ink flex items-center overflow-hidden antialiased transition-colors">
      {/* Full-screen CosmicCanvas: animation to the right, canvas spans entire viewport */}
      <div
        ref={solarRef}
        className="pointer-events-none fixed inset-0 z-0 size-full overflow-hidden opacity-0"
        aria-hidden="true"
      >
        <CosmicCanvas sunX={0.68} sunY={0.5} />
        <div className="absolute top-[62%] lg:top-1/2 left-1/2 lg:left-[68%] -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <HomeSunR3F size={220} />
        </div>
      </div>

      {/* Foreground: Sparse Hero Text & In-Place Navigation Links over the canvas */}
      <div
        ref={textRef}
        className="relative z-10 flex flex-col justify-center px-6 sm:px-14 lg:px-20 py-12 max-w-xl lg:max-w-2xl opacity-0"
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
              <Button href="/onboarding" variant="special" size="lg" icon={<IconArrowRight className="h-4 w-4" />}>
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
    </main>
  );
}
