import { STARS } from "@/components/companion/scenes/types";

export const LondonScene = () => (
  <>
    <svg className="ben" viewBox="0 0 40 130" aria-hidden="true">
      <path d="M14 130V52h12v78zM12 52h16l-2-8H14zM15 44h10V30l-5-18-5 18zM19 12h2V2h-2z" />
      <circle className="face" cx="20" cy="38" r="4.2" />
    </svg>
    <em className="gas" />
    <s style={{ top: "52%" }} />
    <s style={{ top: "66%", animationDelay: "-6s" }} />
    <s style={{ top: "80%", animationDelay: "-11s" }} />
    {STARS.slice(0, 7).map(([l, t, d], i) => (
      <i key={i} style={{ left: `${l}%`, top: `${t * 0.5}%`, animationDelay: `${d}s` }} />
    ))}
  </>
);
