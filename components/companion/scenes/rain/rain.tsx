import { STARS } from "@/components/companion/scenes/types";

export const RainScene = () => (
  <>
    <em className="lamp" />
    {STARS.concat(STARS).map(([l, t, d], i) => (
      <i
        key={i}
        style={{
          left: `${(l * 1.07 + i * 3) % 100}%`,
          animationDelay: `${-(t / 10 + d + i * 0.17)}s`,
          animationDuration: `${0.9 + (i % 5) * 0.15}s`,
        }}
      />
    ))}
    <u />
  </>
);
