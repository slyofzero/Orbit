"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * A page's tabs live in the address: /planner?tab=full_plan. The first tab has no query at all (/planner).
 * Clicking a tab pushes the new address, so Back goes to the previous tab, and any link to /planner shows the first tab.
 * The page using this must sit inside a <Suspense> boundary (Next requires it for useSearchParams).
 */
export function useTab<T extends string>(tabs: readonly T[], first: T): [T, (t: T) => void] {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = sp.get("tab");
  const tab = (tabs.includes(raw as T) ? raw : first) as T;
  const setTab = (t: T) => {
    const p = new URLSearchParams(sp.toString());
    if (t === first) p.delete("tab"); else p.set("tab", t);
    const qs = p.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  return [tab, setTab];
}
