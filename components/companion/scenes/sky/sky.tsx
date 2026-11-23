import { STARS } from "@/components/companion/scenes/types";

export const SkyScene = () => (
  <>
    <em className="orb" />
    {STARS.map(([l, t, d], i) => (
      <i key={i} style={{ left: `${l}%`, top: `${t}%`, animationDelay: `${d}s` }} />
    ))}
    <u />
    <u className="b" />
    <b style={{ top: "14%", animationDelay: "-6s" }} />
    <b className="s" style={{ top: "34%", animationDelay: "-22s" }} />
    <b style={{ top: "52%", animationDelay: "-40s" }} />
  </>
);
