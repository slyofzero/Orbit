"use client";
// A template (unlike a layout) is created again on every navigation, so every page change plays the page-in
// animation, sub-routes included. A change of query string on the same page (/stats/question?id=1 to ?id=2)
// doesn't remount a template, so the wrapper is also keyed by the query string.

import { Suspense, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

function Keyed({ children }: { children: ReactNode }) {
  const query = useSearchParams().toString();
  return (
    <div key={query} className="motion-safe:animate-page-in">
      {children}
    </div>
  );
}

export default function AppTemplate({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <Keyed>{children}</Keyed>
    </Suspense>
  );
}
