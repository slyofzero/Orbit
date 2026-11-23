"use client";

import { useEffect, useRef } from "react";
import { cx } from "@/components/utils";

/**
 * Top background canvas: sits above the ambient canvas, dedicated exclusively for Cosmic Events animations.
 */
export function CosmicCanvas({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  return (
    <canvas
      ref={ref}
      data-layer="cosmos"
      aria-hidden="true"
      className={cx("pointer-events-none fixed inset-0 z-0 size-full block", className)}
    />
  );
}
