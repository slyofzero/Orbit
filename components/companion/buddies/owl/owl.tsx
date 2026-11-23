import type { Buddy } from "@/components/companion/types";
import { Extras } from "@/components/companion/buddies/extras";

export const Owl = () => (
  <>
    <rect x="6" y="84" width="68" height="11" rx="2.5" fill="#14b8a6" />
    <rect x="12" y="75" width="58" height="10" rx="2.5" fill="#ff5d73" />
    <rect x="9" y="67" width="62" height="9" rx="2.5" fill="#ffc933" />
    <g className="body">
      <path d="M18 24 L22 6 L35 19 Z M62 24 L58 6 L45 19 Z" fill="#a8703f" />
      <ellipse cx="40" cy="44" rx="25" ry="26" fill="#a8703f" />
      <ellipse cx="40" cy="54" rx="15" ry="16" fill="#f6e0bd" />
      <path
        d="M33 52q3 3 6 0M41 52q3 3 6 0M33 60q3 3 6 0M41 60q3 3 6 0"
        stroke="#d9b98c"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      />
      <ellipse className="wing wl" cx="16" cy="48" rx="7" ry="15" fill="#8a5a30" />
      <ellipse className="wing wr" cx="64" cy="48" rx="7" ry="15" fill="#8a5a30" />
      <circle cx="30" cy="34" r="10" fill="#fff" stroke="#6b4423" strokeWidth="1.5" />
      <circle cx="50" cy="34" r="10" fill="#fff" stroke="#6b4423" strokeWidth="1.5" />
      <g className="pupils">
        <circle cx="30" cy="34" r="4.3" fill="#111" />
        <circle cx="50" cy="34" r="4.3" fill="#111" />
        <circle cx="31.4" cy="32.6" r="1.2" fill="#fff" />
        <circle cx="51.4" cy="32.6" r="1.2" fill="#fff" />
      </g>
      <ellipse className="lid" cx="30" cy="34" rx="10.5" ry="10.5" fill="#a8703f" />
      <ellipse className="lid" cx="50" cy="34" rx="10.5" ry="10.5" fill="#a8703f" />
      <path d="M36 42 L44 42 L40 50 Z" fill="#ff9a3c" />
      <ellipse cx="33" cy="69" rx="5" ry="2.4" fill="#ff9a3c" />
      <ellipse cx="47" cy="69" rx="5" ry="2.4" fill="#ff9a3c" />
      <Extras />
    </g>
  </>
);

export const OWL_BUDDY: Buddy = {
  id: "owl",
  name: "Hoot the owl",
  scene: "sky",
  special: { from: 0, to: 3, name: "Midnight hunt" },
  nocturnal: true,
  art: Owl,
  react: {
    supernova: "A star just exploded. Hoot. Respect.",
    nebula: "A newborn nebula. Make a wish.",
    shooting: "Shooting stars! Wish for full marks.",
    comet: "A comet! Rarer than a perfect mock.",
    cluster: "Stars twinkling on cue. Show-offs.",
    aurora: "Northern lights! Worth staying up for.",
    saturn: "Saturn! Look at those rings. Hoot hoot.",
    asteroid: "Incoming rock! Tuck in your wings.",
    impact: "Direct hit. Earth has survived worse than finals.",
    rings: "The rings flew off! Is that allowed?",
  },
  lines: {
    chat: [
      "One question. Then another.",
      "Hoot! Did you tick a task yet?",
      "Water break? Then back to it.",
      "Mistake log time. Future you says thanks.",
      "I believe in your eigenvalues.",
      "Slow is fine. Stopping isn't.",
      "Stretch your neck. Look far away. Resume.",
      "Wrong in practice beats wrong in the exam.",
    ],
    sleep: [
      "zzz… sleep is revision too…",
      "Hoot… five more minutes… zzz…",
      "zzz… I dreamed of eigenvalues…",
      "Shhh. Day shift is for sleeping. Hoot…",
    ],
    night: [
      "Night shift! The best hours for revision.",
      "Hoot. The lamp is on. Let's read.",
      "Night study suits me. Quiet and sharp.",
      "One chapter more, then we rest.",
    ],
    party: [
      "Hoot hoot! Every task done. Party time!",
      "Wise move, finishing early. Celebrate!",
      "Confetti for the scholar! Hoot!",
      "A perfect day. Even owls dance.",
    ],
    special: [
      "Midnight hunt! My eyes see every detail now.",
      "Hoot. The quiet hours are for hard problems.",
      "Wide awake. Ask me anything.",
    ],
    outcomes: {
      right: ["Hoot! Correct.", "Sharp eyes. Next one?", "That's the way. Hoot hoot."],
      wrong: [
        "Hoot. Wrong, but now you know. Log it.",
        "Even owls miss the mouse. Check why.",
        "Not quite. Read the explanation, then try again.",
      ],
      skip: ["Skipped? Come back to it, I'll remember.", "A skip is a debt. Pay it later."],
      giveup: [
        "You walked out of the mock. It happens. Read the review, then return.",
        "Hoot… that one got away. The next one won't.",
      ],
      quit: [
        "Leaving with questions unsolved? Hoot. They'll wait for you.",
        "Half-done is half-learned. Come back soon.",
      ],
      progress: ["Hoot! Good session. Rest your wings.", "Progress made. Wise owls call that a win."],
    },
  },
};
