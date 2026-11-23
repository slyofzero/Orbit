import type { Buddy } from "@/components/companion/types";
import { Extras } from "@/components/companion/buddies/extras";

export const Ghost = () => (
  <>
    <ellipse className="gshadow" cx="40" cy="92" rx="22" ry="3.6" fill="rgba(0,0,0,0.25)" />
    <g className="body float">
      <g className="shiver">
        <ellipse
          className="wing wl"
          cx="15"
          cy="56"
          rx="5.5"
          ry="11"
          fill="#f2f5ff"
          stroke="#c9d1ee"
          strokeWidth="1.3"
          transform="rotate(30 15 56)"
        />
        <ellipse
          className="wing wr"
          cx="65"
          cy="56"
          rx="5.5"
          ry="11"
          fill="#f2f5ff"
          stroke="#c9d1ee"
          strokeWidth="1.3"
          transform="rotate(-30 65 56)"
        />
        <path
          d="M17 88V42a23 23 0 0146 0v46q-5.75 -8 -11.5 0q-5.75 8 -11.5 0q-5.75 -8 -11.5 0q-5.75 8 -11.5 0z"
          fill="#f6f8ff"
          stroke="#c9d1ee"
          strokeWidth="1.6"
        />
        <ellipse cx="22" cy="56" rx="4.2" ry="2.6" fill="#ff9ab8" opacity="0.55" />
        <ellipse cx="58" cy="56" rx="4.2" ry="2.6" fill="#ff9ab8" opacity="0.55" />
        <circle cx="31" cy="44" r="9" fill="#fff" stroke="#9aa3c8" strokeWidth="1.4" />
        <circle cx="49" cy="44" r="9" fill="#fff" stroke="#9aa3c8" strokeWidth="1.4" />
        <g className="pupils">
          <circle cx="31" cy="44" r="2.6" fill="#1b1b33" />
          <circle cx="49" cy="44" r="2.6" fill="#1b1b33" />
        </g>
        <ellipse className="lid" cx="31" cy="44" rx="9.6" ry="9.6" fill="#f6f8ff" />
        <ellipse className="lid" cx="49" cy="44" rx="9.6" ry="9.6" fill="#f6f8ff" />
        <path
          d="M25 33q6 -4 11 -1M55 33q-6 -4 -11 -1"
          stroke="#9aa3c8"
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
        />
        <ellipse className="gmouth" cx="40" cy="62" rx="5.2" ry="7" fill="#2a2748" />
        <ellipse cx="40" cy="65.5" rx="3" ry="2.6" fill="#ff7b9c" />
        <path className="sweat" d="M64 28q-4 7 0 9q4 -2 0 -9z" fill="#7ed0ff" />
        <Extras hat={[40, 22]} />
      </g>
    </g>
  </>
);

export const GHOST_BUDDY: Buddy = {
  id: "ghost",
  name: "Boo the ghost",
  scene: "cake",
  special: { from: 23, to: 24, name: "Witching hour" },
  art: Ghost,
  react: {
    supernova: "EEEK! Oh, just a star. Phew.",
    nebula: "Is that frosting?! No? Phew.",
    shooting: "Eek! Was that a flying cupcake?",
    comet: "A comet! Not a cake. I think.",
    cluster: "Sprinkles?! Oh, only stars.",
    aurora: "Green icing in the sky?! Oh, just lights.",
    saturn: "A giant donut with a hole! NOPE.",
    asteroid: "A rock! Thank goodness, not a cake.",
    impact: "EEEK!! Was it a cake?! No? Phew.",
    rings: "The rings are flying! Are those doughnuts?!",
  },
  lines: {
    chat: [
      "B-b-boo. Is that cake over there?",
      "I'm not scared of exams. Cake, yes.",
      "Please keep the cake away from me.",
      "Boo! Wait, don't look at the cake.",
      "I'm shaking. It's probably the cake.",
      "Study first, and no one brings cake.",
      "Whooo-oo… I mean eek. Cake!",
      "Any cake nearby? Asking for nobody.",
    ],
    sleep: [
      "zzz… no cake… zzz…",
      "zzz… floating through a dream… boo…",
      "Eek… no… zzz… just a pillow…",
      "Shhh. Ghosts sleep too. Mostly.",
    ],
    night: [
      "B-boo. Night study is my favourite. No cake in sight.",
      "Spooky hours, scholarly hours.",
      "Whooo reads at night? Me.",
      "The lamp is cosy. Please keep the cake away.",
    ],
    party: [
      "Whooo! All done! Party! (Is there cake?)",
      "Confetti is fine. Confetti is not cake. Yay!",
      "You did it! I'm floating higher than ever.",
      "Boo-tiful work today!",
    ],
    special: [
      "Witching hour! Whooo! Study before the stroke of midnight.",
      "B-boo. Almost midnight. Finish strong.",
      "The cake is just a rumour, right? Study on.",
    ],
    outcomes: {
      right: ["Whooo! Correct! No cake needed.", "Correct! I'm so happy I'm floating higher.", "Boo-tiful answer!"],
      wrong: [
        "Eek! Wrong. But no cake, so it's fine.",
        "Wrong! I got a fright. Try again.",
        "Whoops. Wrong. Not scary, though. Cake is scary.",
      ],
      skip: ["Skipped! Hope there's no cake in the next one.", "B-boo. Skipped. I'll hide with you."],
      giveup: [
        "You ran away from the mock! I would too, if there was cake.",
        "Eek, you left! It's okay. I vanish all the time.",
      ],
      quit: [
        "Eek, you left some unsolved! Are you running from the cake?",
        "B-boo, leaving already? The questions will haunt you.",
      ],
      progress: ["Whooo! Good session. No cake required.", "B-boo-tiful progress. See you next time!"],
    },
  },
};
