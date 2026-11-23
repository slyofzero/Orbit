import { STARS } from "@/components/companion/scenes/types";

export const SpaceScene = () => (
  <>
    <em className="planet" />
    {STARS.map(([l, t, d], i) => (
      <i
        key={i}
        style={{
          left: `${l}%`,
          top: `${t}%`,
          animationDelay: `${-d * 4}s`,
          animationDuration: `${12 + (i % 5) * 4}s`,
        }}
      />
    ))}
    <u />
  </>
);
