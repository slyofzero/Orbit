"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Mistakes now live inside the Stats page; old links and bookmarks land there.
export default function MistakesMoved() {
  const router = useRouter();
  useEffect(() => { router.replace("/stats?tab=mistakes"); }, [router]);
  return <p className="muted">Opening Stats…</p>;
}
