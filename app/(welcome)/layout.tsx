"use client";

import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { ToastProvider, ThemeToggle } from "@/components/ui";
import { LaunchProvider } from "@/components/app/Launch";

// Client-only dynamic import of the 3D Three.js Solar System
const HomeSolarSystemR3F = dynamic(
  () => import("@/components/home/HomeSolarSystemR3F").then((m) => m.HomeSolarSystemR3F),
  { ssr: false },
);

export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isOnboarding = pathname === "/onboarding";

  return (
    <ToastProvider>
      <LaunchProvider>
        <main className="relative min-h-screen w-full bg-pad text-ink overflow-x-hidden antialiased transition-colors">
          {/* Persistent, uncut & uninterrupted 3D Solar System spanning across both / and /onboarding */}
          <div className="pointer-events-none fixed inset-0 z-0 size-full overflow-hidden" aria-hidden="true">
            <HomeSolarSystemR3F view={isOnboarding ? "onboarding" : "home"} />
          </div>

          {/* Page-specific content (transitions smoothly while the 3D solar system rotates uninterrupted) */}
          <div className="relative z-10 w-full min-h-screen">{children}</div>

          {/* Persistent Theme Switcher */}
          <div className="fixed top-6 right-6 z-50">
            <ThemeToggle compact />
          </div>
        </main>
      </LaunchProvider>
    </ToastProvider>
  );
}
