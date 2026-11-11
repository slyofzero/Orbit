import Link from "next/link";

// White in dark mode, black in light mode (the .invert button), with a return arrow before the text.
export default function BackToPlanner() {
  return (
    <Link href="/planner" className="btn invert back-btn">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>
      Back to planner
    </Link>
  );
}
