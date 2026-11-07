// Remounts on every visit, so the exam screen eases in.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="arena-enter">{children}</div>;
}
