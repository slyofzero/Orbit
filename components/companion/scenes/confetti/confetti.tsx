const CONFETTI = ["#ff5d73", "#ffc933", "#14b8a6", "#7c5cff", "#4fc3ff", "#ff9ab8"];

export const Confetti = () => (
  <div className="confetti" aria-hidden="true">
    {Array.from({ length: 18 }, (_, i) => (
      <i
        key={i}
        style={{
          left: `${(i * 53 + 7) % 96}%`,
          background: CONFETTI[i % CONFETTI.length],
          animationDelay: `${-(i * 0.37) % 4}s`,
          animationDuration: `${2.6 + (i % 5) * 0.5}s`,
          width: 4 + (i % 3) * 2,
          height: 7 + (i % 4) * 2,
        }}
      />
    ))}
  </div>
);
