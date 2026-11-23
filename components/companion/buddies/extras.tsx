export const Extras = ({ hat = [40, 12] as [number, number], noHat = false }) => (
  <>
    {!noHat && (
      <g className="hat" transform={`translate(${hat[0] - 40}, ${hat[1] - 12})`}>
        <path d="M30 12 L40 -10 L50 12 Z" fill="#ff5d73" />
        <circle cx="40" cy="-11" r="3.2" fill="#ffc933" />
        <path d="M33 7h14" stroke="#ffc933" strokeWidth="2" />
      </g>
    )}
    <g className="zzz" fontFamily="var(--ff-display, system-ui)" fontWeight="800" fill="#9fb3c8">
      <text x="58" y="12" fontSize="11">
        z
      </text>
      <text x="66" y="0" fontSize="8">
        z
      </text>
    </g>
    <g className="spark" fill="#ffc933">
      <path d="M8 18l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
      <path d="M72 30l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6z" />
    </g>
  </>
);

export const NightStudy = () => (
  <g className="ns" aria-hidden="true">
    <defs>
      <radialGradient id="ns-glow" cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor="#ffd56a" stopOpacity="0.6" />
        <stop offset="1" stopColor="#ffd56a" stopOpacity="0" />
      </radialGradient>
    </defs>
    <ellipse className="ns-glow" cx="62" cy="84" rx="30" ry="26" fill="url(#ns-glow)" />
    <path
      d="M66 94h10M71 94V82l-5-8"
      stroke="#8b94a8"
      strokeWidth="1.6"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M60 72l8-5 7 6z" fill="#ffc933" stroke="#d8a928" strokeWidth="0.8" strokeLinejoin="round" />
    <path
      d="M24 85q8-3 16 1v9q-8-4-16-1zM56 85q-8-3-16 1v9q8-4 16-1z"
      fill="#fdf6e3"
      stroke="#c9b98a"
      strokeWidth="1"
      strokeLinejoin="round"
    />
    <path
      d="M27 88q5-1.5 10 .5M27 91q5-1.5 10 .5M43 88.5q5-2 10-.5M43 91.5q5-2 10-.5"
      stroke="#b9a878"
      strokeWidth="0.8"
      fill="none"
      strokeLinecap="round"
    />
    <path
      className="ns-page"
      d="M40 86q6-3 14-1v9q-8-3-14 0z"
      fill="#fff"
      stroke="#c9b98a"
      strokeWidth="0.8"
      strokeLinejoin="round"
    />
  </g>
);
