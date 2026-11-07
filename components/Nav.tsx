"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { isAdminProfile } from "@/lib/profiles";
import ThemeToggle from "./ThemeToggle";
import ProfileSwitcher from "./ProfileSwitcher";
import Companion from "./Companion";

const I = (d: string) => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>
);
const LINKS: [string, string, React.ReactNode][] = [
  ["/", "Today", I("M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10")],
  ["/planner", "Planner", I("M4 6h16M4 12h16M4 18h10")],
  ["/practice", "Practice", I("M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z")],
  ["/mocks", "Mocks", I("M12 7v5l3 2M12 3a9 9 0 100 18 9 9 0 000-18z")],
  ["/stats", "Stats", I("M5 20V11M12 20V4M19 20v-6")],
];

export default function Nav() {
  const path = usePathname();
  const [admin, setAdmin] = useState(false);
  useEffect(() => { setAdmin(isAdminProfile()); }, []);
  return (
    <aside className="rail">
      <Link href="/" className="brand">
        Orbit<small>study hub</small>
      </Link>
      <ProfileSwitcher />
      {admin && <Link href="/admin" className="item active">{I("M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z")}Admin</Link>}
      {!admin && LINKS.map(([href, label, icon]) => (
        <Link key={href} href={href} className={`item ${(href === "/" ? path === "/" : path.startsWith(href)) ? "active" : ""}`}>
          {icon}
          {label}
        </Link>
      ))}
      <Companion />
      <ThemeToggle />
    </aside>
  );
}
