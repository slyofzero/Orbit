"use client";
import { useEffect, type RefObject } from "react";

/** While `open`, calls `onClose` on Esc or on a pointer press outside every element in `inside`. */
export function useDismiss(open: boolean, onClose: () => void, inside: RefObject<HTMLElement | null>[]) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!inside.some((r) => r.current?.contains(e.target as Node))) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, inside]);
}
