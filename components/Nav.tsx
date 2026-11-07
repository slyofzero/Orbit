"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";
import Companion from "./Companion";

const I = (d: string) => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>
);
const LINKS: [string, string, React.ReactNode][] = [
  ["/", "Today", I("M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10")],
  ["/planner", "Planner", I("M4 6h16M4 12h16M4 18h10")],
  ["/practice", "Practice", I("M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z")],
  ["/mocks", "Mocks", I("M12 7v5l3 2M12 3a9 9 0 100 18 9 9 0 000-18z")],
  ["/mistakes", "Mistakes", I("M12 8v5m0 3.5v.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z")],
];

export default function Nav() {
  const path = usePathname();
  return (
    <aside className="rail">
      <Link href="/" className="brand">
        Orbit<small>study hub</small>
      </Link>
      {LINKS.map(([href, label, icon]) => (
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
