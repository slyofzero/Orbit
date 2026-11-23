import { STARS } from "@/components/companion/scenes/types";

export const LabScene = () => (
  <>
    {STARS.map(([l, , d], i) => (
      <i
        key={i}
        style={{
          left: `${l}%`,
          animationDelay: `${-d * 3}s`,
          animationDuration: `${5 + (i % 4)}s`,
        }}
      >
        {i % 2 ? "1" : "0"}
      </i>
    ))}
    <s style={{ top: "12%" }} />
    <s style={{ top: "40%", animationDelay: "-1s" }} />
    <s style={{ top: "68%", animationDelay: "-2s" }} />
  </>
);
