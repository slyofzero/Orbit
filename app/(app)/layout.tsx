// The frame around every app page (v1's shell): the rail on the left (bottom bar on phones) and the page.
import { NavRail, ThemeToggle, ToastProvider } from "@/components/ui";
import { IconBars, IconHome, IconLines, IconStar } from "@/components/icons";

const NAV = [
  { href: "/dashboard", label: "Today", icon: <IconHome /> },
  { href: "/planner", label: "Planner", icon: <IconLines /> },
  { href: "/practice", label: "Practice", icon: <IconStar /> },
  { href: "/stats", label: "Stats", icon: <IconBars /> },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="grid min-h-screen grid-cols-[96px_minmax(0,1fr)] max-[760px]:grid-cols-1">
        <NavRail
          items={NAV}
          brand={{ title: "Orbit", subtitle: "study hub", href: "/dashboard" }}
          footer={<ThemeToggle compact />}
        />
        <main className="w-full max-w-[1760px] px-[clamp(18px,3.5vw,44px)] pt-[34px] pb-20 max-[760px]:pb-[100px]">
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}
