import type { Buddy } from "@/components/companion/types";
import { Extras } from "@/components/companion/buddies/extras";

export const Jelly = () => (
  <>
    <circle className="bub" cx="14" cy="60" r="3" fill="none" stroke="#bff3ff" strokeWidth="1.3" />
    <circle className="bub b2" cx="68" cy="52" r="2.2" fill="none" stroke="#bff3ff" strokeWidth="1.3" />
    <circle className="bub b3" cx="22" cy="80" r="1.8" fill="none" stroke="#bff3ff" strokeWidth="1.2" />
    <g className="body float">
      {[22, 31, 40, 49, 58].map((x, i) => (
        <path
          key={x}
          className="tent"
          style={{ animationDelay: `${-i * 0.5}s` }}
          d={`M${x} 56 q${i % 2 ? 5 : -5} 12 0 24 q-4 6 0 10`}
          stroke="#f472b6"
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
        />
      ))}
      <ellipse cx="40" cy="38" rx="25" ry="25" fill="#f472b6" />
      <circle cx="26" cy="22" r="3.2" fill="#f9a8d4" />
      <circle cx="52" cy="20" r="2.4" fill="#f9a8d4" />
      <circle cx="58" cy="30" r="1.8" fill="#f9a8d4" />
      <circle cx="31" cy="40" r="7.5" fill="#fff" />
      <circle cx="49" cy="40" r="7.5" fill="#fff" />
      <g className="pupils">
        <circle cx="31" cy="40" r="3.8" fill="#3b0a3c" />
        <circle cx="49" cy="40" r="3.8" fill="#3b0a3c" />
        <circle cx="32.2" cy="38.8" r="1.1" fill="#fff" />
        <circle cx="50.2" cy="38.8" r="1.1" fill="#fff" />
      </g>
      <ellipse className="lid" cx="31" cy="40" rx="8" ry="8" fill="#f472b6" />
      <ellipse className="lid" cx="49" cy="40" rx="8" ry="8" fill="#f472b6" />
      <ellipse cx="22" cy="50" rx="4" ry="2.4" fill="#fb7185" opacity="0.6" />
      <ellipse cx="58" cy="50" rx="4" ry="2.4" fill="#fb7185" opacity="0.6" />
      <path d="M35 51q5 4 10 0" stroke="#3b0a3c" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <Extras hat={[40, 18]} />
    </g>
  </>
);

export const JELLY_BUDDY: Buddy = {
  id: "jelly",
  name: "Blob the jellyfish",
  scene: "sea",
  special: { from: 20, to: 21, name: "Glow hour" },
  art: Jelly,
  react: {
    supernova: "Blub! Lights in the sky!",
    nebula: "So many colours. Like a jellyfish bloom.",
    shooting: "Shooting stars. I only see them through the water.",
    comet: "Blub. A very fast fish in the sky.",
    cluster: "Sparkles! They look like plankton.",
    aurora: "The sky is glowing like me!",
    saturn: "A planet with a ring. Like a floaty.",
    asteroid: "Blub… that rock is big. And fast.",
    impact: "Even down here, I felt that.",
    rings: "Rings flying off! Wheee.",
  },
  lines: {
    chat: [
      "Go with the flow. Then solve the problem.",
      "Blub. Take a deep breath.",
      "Deep thoughts need deep focus.",
      "Be soft with yourself, firm with your schedule.",
      "Tentacles crossed for your next mock.",
      "Float, then dive in.",
      "Every bubble is a small win. Pop some.",
      "Swim lanes: one topic at a time.",
    ],
    sleep: [
      "blub… zzz… blub…",
      "zzz… drifting with the tide…",
      "blub… the sea is so quiet… zzz…",
      "Glow off. Sleeping… blub…",
    ],
    night: [
      "Blub. Reading by my own glow.",
      "Quiet tide. Good time to learn.",
      "Evening swim through the notes.",
      "Soft light, steady focus. Blub.",
    ],
    party: [
      "Blub blub! Everything's done. Party bubbles!",
      "Glowing with pride. Party time!",
      "You did it! Splash!",
      "A whole day completed. Float and celebrate.",
    ],
    special: [
      "Glow hour! I shine brightest now.",
      "Blub. Bioluminescence on. Let's study bright.",
      "Evening glow. Everything looks calmer.",
    ],
    outcomes: {
      right: ["Blub! You got it.", "Glowing with pride. Correct!", "Smooth swimming. Correct."],
      wrong: [
        "Blub… wrong. Drift back and read why.",
        "A little current pushed you off. Try again.",
        "Wrong, but you're still afloat.",
      ],
      skip: ["Floating past this one. Blub.", "Skipped. It'll bob back up later."],
      giveup: ["You swam out of the mock. The tide comes back.", "Blub… that was a rough one. Rest, then return."],
      quit: [
        "Blub… swimming off with questions left behind?",
        "You drifted away. The rest will float until you return.",
      ],
      progress: ["Blub. Nice swim. Every answer counts.", "You made waves today. Rest, then return."],
    },
  },
};
