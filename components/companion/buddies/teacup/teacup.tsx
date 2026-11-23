import type { Buddy } from "@/components/companion/types";
import { Extras } from "@/components/companion/buddies/extras";

export const Teacup = () => (
  <>
    <ellipse cx="40" cy="90" rx="31" ry="6.5" fill="#dfe7f5" stroke="#b6c3dc" strokeWidth="1.4" />
    <ellipse cx="40" cy="88.5" rx="21" ry="3.6" fill="#f4f7fd" />
    <path
      className="steam"
      d="M18 38q-6 -8 0 -15q6 -7 0 -14"
      stroke="#fff"
      strokeWidth="2.4"
      fill="none"
      strokeLinecap="round"
      opacity="0.8"
    />
    <path
      className="steam s2"
      d="M64 38q6 -8 0 -15q-6 -7 0 -14"
      stroke="#fff"
      strokeWidth="2.4"
      fill="none"
      strokeLinecap="round"
      opacity="0.8"
    />
    <g className="body">
      <path d="M62 54q20 -1 16 14q-4 12 -17 9" stroke="#c9d4e8" strokeWidth="5.5" fill="none" strokeLinecap="round" />
      <path d="M16 46h48q0 36 -24 40q-24 -4 -24 -40z" fill="#fffaf0" stroke="#c9d4e8" strokeWidth="1.6" />
      <path d="M18 74h44" stroke="#3b6bb5" strokeWidth="1.6" strokeDasharray="1 4.2" strokeLinecap="round" />
      <path d="M20.5 78.6q19.5 5 39 0" stroke="#3b6bb5" strokeWidth="1.2" fill="none" />
      <ellipse cx="40" cy="47" rx="24" ry="5" fill="#8a4f2a" stroke="#c9d4e8" strokeWidth="1.4" />
      <circle cx="30" cy="62" r="6" fill="#fff" stroke="#6b5a47" strokeWidth="1.3" />
      <circle cx="50" cy="62" r="6" fill="#fff" stroke="#6b5a47" strokeWidth="1.3" />
      <g className="pupils">
        <circle cx="30" cy="62" r="2.7" fill="#111" />
        <circle cx="50" cy="62" r="2.7" fill="#111" />
      </g>
      <ellipse className="lid" cx="30" cy="62" rx="6.6" ry="6.6" fill="#fffaf0" />
      <ellipse className="lid" cx="50" cy="62" rx="6.6" ry="6.6" fill="#fffaf0" />
      <circle cx="50" cy="62" r="8.4" fill="none" stroke="#d8a928" strokeWidth="1.5" />
      <path d="M56 68q5 9 1 17" stroke="#d8a928" strokeWidth="1" fill="none" />
      <path d="M40 69q-5 -3 -10 0q-3 2 -6 -1q4 6 16 4q12 2 16 -4q-3 3 -6 1q-5 -3 -10 0z" fill="#4a2f1a" />
      <path d="M35 74q5 4 10 0" stroke="#4a2f1a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <ellipse cx="40" cy="45" rx="19.5" ry="4.2" fill="#1d1d2b" />
      <rect x="28" y="22" width="24" height="23" rx="2.2" fill="#2b2b40" />
      <rect x="28" y="37" width="24" height="5.5" fill="#b3262e" />
      <rect x="37" y="36.4" width="6" height="6.6" rx="1" fill="none" stroke="#e6c34a" strokeWidth="1.3" />
      <ellipse cx="40" cy="22" rx="12" ry="2.6" fill="#3a3a55" />
      <Extras noHat />
    </g>
  </>
);

export const TEACUP_BUDDY: Buddy = {
  id: "tea",
  name: "Lord Earl Grey",
  scene: "london",
  special: { from: 16, to: 17, name: "Tea time" },
  art: Teacup,
  react: {
    supernova: "Good heavens! A supernova. Most irregular.",
    nebula: "Quite the display. Reminds me of the Great Exhibition.",
    shooting: "A shooting star! I shall wish for a better biscuit.",
    comet: "A comet! Terribly punctual.",
    cluster: "Sparkling indeed. How very festive.",
    aurora: "The Northern Lights! One does adore a good show.",
    saturn: "Saturn! Rather a fine hat, I must say.",
    asteroid: "Oh dear. Something rocky approaches.",
    impact: "Well! That will spill the tea.",
    rings: "The rings have come off. How undignified.",
  },
  lines: {
    chat: [
      "A spot of revision, I think.",
      "Splendid progress. Do carry on.",
      "Tea first, then Bayes' theorem.",
      "Posture, old chap. And hydration.",
      "One simply does not skip the mistake log.",
      "Stiff upper lip. The next problem awaits.",
      "Jolly good. One more topic?",
      "A well-planned day is a well-brewed pot.",
    ],
    sleep: [
      "snoring politely… zzz…",
      "A nap before the next pot… zzz…",
      "Hmm? Not now, old chap… zzz…",
      "zzz… the kettle can wait…",
    ],
    night: [
      "An evening cuppa and a chapter, I think.",
      "Lamp lit, kettle warm. Splendid.",
      "Night study is quite civilised, really.",
      "Tea cools, revision warms. Carry on.",
    ],
    party: [
      "Splendid! All done. A toast with tea!",
      "Jolly good show. Do enjoy the party.",
      "Every task ticked. Quite remarkable.",
      "Biscuits for everyone. You've earned it.",
    ],
    special: [
      "Tea time! Quite the highlight of the afternoon.",
      "Steam rising, spirits too. A short break, then onward.",
      "Four o'clock sharp. Marvellous.",
    ],
    outcomes: {
      right: ["Splendid! Quite correct.", "Jolly good. A biscuit for you.", "Impeccable. Do carry on."],
      wrong: [
        "Oh dear. Incorrect. Tea and the explanation, I think.",
        "A minor misstep. Happens to the best of us.",
        "Not quite right, old chap. Try again.",
      ],
      skip: ["Skipped? How unlike one. Return to it presently.", "Leaving it for later, are we? Very well."],
      giveup: ["Abandoning the mock? Most irregular. Do come back.", "A retreat, not a defeat. Regroup over tea."],
      quit: [
        "Leaving the questions unfinished? How unlike one. Do return.",
        "A tidy desk is a finished one. Pray come back.",
      ],
      progress: ["Jolly good session. Time for a cuppa.", "Steady progress, old chap. Do carry on later."],
    },
  },
};
