"use client";
// A page's tabs live in the address (v1): /planner?tab=full_plan. Clicking a tab pushes the new address,
// so Back goes to the previous tab; an address with no (or an unknown) tab shows the first one.
// The page using this must sit inside a <Suspense> boundary (Next requires it for useSearchParams).

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function useTab<T extends string>(tabs: readonly T[], first: T): [T, (t: T) => void] {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = sp.get("tab");
  const tab = (tabs as readonly string[]).includes(raw ?? "") ? (raw as T) : first;
  const setTab = (t: T) => {
    if (t === tab) return;
    const p = new URLSearchParams(sp.toString());
    p.set("tab", t);
    router.push(`${pathname}?${p.toString()}`, { scroll: false });
  };
  return [tab, setTab];
}
