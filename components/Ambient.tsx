// Faint maths and code symbols drifting up behind the pages. Fixed values, so server and browser render the same thing.
const BITS: [string, number, number, number, number][] = [
  // symbol, left %, size px, seconds, delay
  ["∑", 6, 54, 46, 0], ["λ", 17, 38, 38, -12], ["∫", 29, 64, 54, -30], ["π", 41, 40, 42, -6], ["σ", 53, 46, 50, -22],
  ["∇", 63, 52, 44, -34], ["θ", 74, 36, 36, -18], ["∞", 84, 58, 52, -8], ["O(n)", 92, 30, 40, -26], ["{ }", 12, 34, 48, -40],
  ["≈", 47, 44, 56, -16], ["P(A|B)", 70, 26, 60, -44], ["SELECT", 33, 22, 58, -2], ["x²", 58, 42, 40, -28], ["μ", 22, 40, 45, -36],
];

// Sidebar lane: left is in px (the rail is 96px wide), so these float up through the translucent sidebar
const RAIL: [string, number, number, number, number][] = [
  ["∑", 8, 26, 30, -4], ["λ", 56, 22, 26, -15], ["π", 30, 24, 34, -22], ["∇", 62, 20, 28, -9], ["θ", 14, 22, 32, -27], ["∞", 40, 24, 36, -31], ["x²", 66, 20, 30, -19],
];

export default function Ambient() {
  return (
    <div className="ambient" aria-hidden="true">
      {BITS.map(([t, l, s, d, delay]) => (
        <span key={t + l} style={{ left: `${l}%`, fontSize: s, animationDuration: `${d}s`, animationDelay: `${delay}s` }}>{t}</span>
      ))}
      {RAIL.map(([t, l, s, d, delay]) => (
        <span key={"r" + t + l} className="rl" style={{ left: l, fontSize: s, animationDuration: `${d}s`, animationDelay: `${delay}s` }}>{t}</span>
      ))}
    </div>
  );
}
