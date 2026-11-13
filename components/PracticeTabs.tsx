"use client";
import Link from "next/link";
import { usePack } from "@/lib/store";

// Practice has two sections: topics (MCQ, MSQ, NAT) and programming questions (you write code).
export default function PracticeTabs({ active }: { active: "topics" | "programming" | "mocks" }) {
  const { pack, custom } = usePack();
  if (!custom) return null;
  const n = pack.questions.filter((q) => q.type === "code").length;
  return (
    <nav className="pt-tabs" aria-label="Practice sections">
      <Link href="/practice" className={active === "topics" ? "on" : ""} aria-current={active === "topics" ? "page" : undefined}>Topics</Link>
      <Link href="/practice/programming" className={active === "programming" ? "on" : ""} aria-current={active === "programming" ? "page" : undefined}>Programming{n > 0 ? ` (${n})` : ""}</Link>
      <Link href="/practice/mocks" className={active === "mocks" ? "on" : ""} aria-current={active === "mocks" ? "page" : undefined}>Mocks</Link>
    </nav>
  );
}
