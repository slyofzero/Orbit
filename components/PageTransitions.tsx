"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

const EXIT_MS = 170;

// Gives every in-app link click an exit animation before the next page enters.
// The current page fades up and out, then the route changes, then the new page plays its entrance (see .page-enter).
export default function PageTransitions() {
  const router = useRouter();
  const path = usePathname();

  // the new page is in: let the shell settle back
  useEffect(() => { delete document.documentElement.dataset.leaving; }, [path]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      document.documentElement.dataset.leaving = "1";
      clearTimeout(timer);
      timer = setTimeout(() => {
        router.push(url.pathname + url.search + url.hash);
        // safety net: never leave the page faded out if the route doesn't change
        timer = setTimeout(() => { delete document.documentElement.dataset.leaving; }, 2500);
      }, EXIT_MS);
    };
    document.addEventListener("click", onClick, true);
    return () => { document.removeEventListener("click", onClick, true); clearTimeout(timer); };
  }, [router]);

  return null;
}
