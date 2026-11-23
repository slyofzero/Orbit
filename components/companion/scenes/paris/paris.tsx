import { STARS } from "@/components/companion/scenes/types";

export const ParisScene = () => (
  <>
    <em className="sun" />
    <svg className="eif" viewBox="0 0 60 120" aria-hidden="true">
      <path d="M30 2l2 36c3 22 9 48 26 82h-9c-5-10-9-17-14-21H25c-5 4-9 11-14 21H2C19 86 25 60 28 38z" />
      <rect x="19" y="62" width="22" height="3" />
      <rect x="14" y="88" width="32" height="3.5" />
      <defs>
        <linearGradient id="eifbeam">
          <stop offset="0" stopColor="#fff7c0" />
          <stop offset="1" stopColor="#fff7c0" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect className="beam" x="30" y="1" width="80" height="2" rx="1" fill="url(#eifbeam)" />
    </svg>
    {STARS.slice(0, 9).map(([l, t, d], i) => (
      <i key={i} style={{ left: `${l}%`, top: `${t * 0.45}%`, animationDelay: `${d}s` }} />
    ))}
  </>
);
