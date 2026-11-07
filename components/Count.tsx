"use client";
import { useEffect, useState } from "react";

// Counts up to n once on mount. Honours reduced motion.
export default function Count({ n }: { n: number }) {
  const [v, setV] = useState(n);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || n <= 0) return setV(n);
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 900);
      setV(Math.round(n * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    setV(0);
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [n]);
  return <span className="num">{v}</span>;
}
