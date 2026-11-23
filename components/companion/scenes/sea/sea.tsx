import { STARS } from "@/components/companion/scenes/types";

export const SeaScene = () => (
  <>
    <u />
    {STARS.map(([l, t, d], i) => (
      <i
        key={i}
        style={{
          left: `${l}%`,
          animationDelay: `${-d * 3 - t / 9}s`,
          animationDuration: `${7 + (i % 5) * 1.5}s`,
          width: 4 + (i % 4) * 3,
          height: 4 + (i % 4) * 3,
        }}
      />
    ))}
  </>
);
