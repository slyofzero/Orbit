import type { Buddy } from "@/components/companion/types";
import { Extras } from "@/components/companion/buddies/extras";

export const Cat = () => (
  <>
    <ellipse cx="40" cy="89" rx="33" ry="8" fill="#f06292" />
    <ellipse cx="40" cy="86" rx="29" ry="6" fill="#f8bbd0" />
    <g className="body">
      <path
        className="tail"
        d="M60 80 q22 -2 16 -28"
        stroke="#e8923a"
        strokeWidth="7"
        fill="none"
        strokeLinecap="round"
      />
      <ellipse cx="40" cy="66" rx="22" ry="20" fill="#f0a04b" />
      <ellipse cx="40" cy="72" rx="12" ry="12" fill="#fbd9a8" />
      <path d="M20 60q4 2 4 7M60 60q-4 2-4 7" stroke="#c9742a" strokeWidth="2" fill="none" strokeLinecap="round" />
      <ellipse cx="32" cy="82" rx="5.5" ry="4" fill="#f6b86c" />
      <ellipse cx="48" cy="82" rx="5.5" ry="4" fill="#f6b86c" />
      <path d="M21 24 L22 4 L36 15 Z M59 24 L58 4 L44 15 Z" fill="#f0a04b" />
      <path d="M25 18 L25 9 L31 14 Z M55 18 L55 9 L49 14 Z" fill="#f8a5b8" />
      <circle cx="40" cy="34" r="20" fill="#f0a04b" />
      <path d="M36 17v6M40 16v7M44 17v6" stroke="#c9742a" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="31" cy="34" rx="6.5" ry="7" fill="#d8ee7a" stroke="#7a5a2a" strokeWidth="1.2" />
      <ellipse cx="49" cy="34" rx="6.5" ry="7" fill="#d8ee7a" stroke="#7a5a2a" strokeWidth="1.2" />
      <g className="pupils">
        <ellipse cx="31" cy="34" rx="2.2" ry="5.4" fill="#111" />
        <ellipse cx="49" cy="34" rx="2.2" ry="5.4" fill="#111" />
      </g>
      <ellipse className="lid" cx="31" cy="34" rx="7" ry="7.5" fill="#f0a04b" />
      <ellipse className="lid" cx="49" cy="34" rx="7" ry="7.5" fill="#f0a04b" />
      <path d="M37.5 42 L42.5 42 L40 45.5 Z" fill="#f06292" />
      <path
        d="M40 45.5q-3 4-6 1M40 45.5q3 4 6 1"
        stroke="#7a4a1a"
        strokeWidth="1.3"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M17 41h-9M17 45l-8 3M63 41h9M63 45l8 3"
        stroke="#fff"
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.85"
      />
      <Extras hat={[40, 14]} />
    </g>
  </>
);

export const CAT_BUDDY: Buddy = {
  id: "cat",
  name: "Miso the cat",
  scene: "rain",
  special: { from: 21, to: 22, name: "Zoomies" },
  art: Cat,
  react: {
    supernova: "Mrrow! Something exploded. I want it.",
    nebula: "Pretty smoke. Can I bat at it?",
    shooting: "A streak! Must. Chase.",
    comet: "A giant laser pointer in the sky!",
    cluster: "Sparkles! Sparkles everywhere!",
    aurora: "Glowing green curtains. Fancy.",
    saturn: "A planet with a hula hoop. Cute.",
    asteroid: "It's coming right for us. I'm not moving.",
    impact: "Boom. I knocked it off the sky like a cup.",
    rings: "Rings flew away. I'd have caught them.",
  },
  lines: {
    chat: [
      "Rainy day. Perfect for problems.",
      "Mrrow. Open the book.",
      "I knocked your distractions off the desk.",
      "Nap after the next task. I'll supervise.",
      "Purr. You're doing fine.",
      "Ignore the rain. Solve one more.",
      "Keep calm and solve it twice.",
      "That blank page isn't scary. It's just waiting.",
    ],
    sleep: [
      "purrr… zzz… purrr…",
      "Mrrow… ten more minutes… zzz…",
      "zzz… chasing a laser dot… purr…",
      "Do not disturb. Cat is sleeping.",
    ],
    night: [
      "Lamp on, rain outside. Perfect study weather.",
      "Purr. I'll sit on your notes. For warmth.",
      "Evening reading. Mrrow.",
      "Quiet hours. Great for hard problems.",
    ],
    party: [
      "Mrrow! All done. Treats? Please?",
      "Party time. I knocked the confetti off the shelf.",
      "You did it. I'll allow one head scratch.",
      "Purr-fect day. Celebrate!",
    ],
    special: [
      "Zoomies! Mrrow! Solve something before I run past!",
      "Evening zoomies. Energy for one more problem.",
      "I ran round the room twice. Your turn to focus.",
    ],
    outcomes: {
      right: ["Mrrow! Nailed it.", "Purr. That was a good one.", "Correct! Treat? No? Fine."],
      wrong: [
        "Mrrow… wrong. I'd knock it off the table.",
        "Missed it. Land on your feet next time.",
        "Wrong, but cats get nine tries.",
      ],
      skip: ["Skipping? Very cat of you. Come back later.", "Walked right past it. Respect. Return soon."],
      giveup: ["You left the mock. I won't judge. Much.", "Tail between legs, but you can start again."],
      quit: [
        "Leaving already? The questions are still sitting there. Staring.",
        "Mrrow. You left some unsolved. I noticed.",
      ],
      progress: ["Mrrow. Good session. You may pet me now.", "Some progress, some naps. Perfect."],
    },
  },
};
