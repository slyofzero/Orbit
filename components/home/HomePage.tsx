"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { useQuery } from "@/lib/db/client";
import { Button, Heading, Text } from "@/components/ui";
import { IconArrowRight, IconStar } from "@/components/icons";

export function HomePage() {
  const { data } = useQuery("setup.status");
  const hasPlan = data?.hasPlan === true;
  const heroRef = useRef<HTMLDivElement>(null);

  // Entrance animation on mount
  useEffect(() => {
    const heroEl = heroRef.current;
    if (!heroEl) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      gsap.set(heroEl, { opacity: 1, x: 0 });
      return;
    }

    gsap.fromTo(heroEl, { opacity: 0, x: -36 }, { opacity: 1, x: 0, duration: 0.75, ease: "power3.out" });
  }, []);

  return (
    <div
      ref={heroRef}
      className="flex min-h-screen flex-col justify-center px-6 sm:px-14 lg:px-20 py-12 max-w-xl lg:max-w-2xl"
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

        {/* Feature Areas Text */}
        <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray font-medium">
          <span>Planner</span>
          <span className="text-line select-none">•</span>
          <span>Practice</span>
          <span className="text-line select-none">•</span>
          <span>Mock tests</span>
          <span className="text-line select-none">•</span>
          <span>Stats</span>
        </div>

        {/* Local Storage Pill */}
        <div className="mt-12 flex items-center gap-4 pt-4 border-t border-line/60">
          <span className="text-xs text-gray/80 font-mono">100% in-browser • SQLite WASM</span>
        </div>
      </div>
    </div>
  );
}
