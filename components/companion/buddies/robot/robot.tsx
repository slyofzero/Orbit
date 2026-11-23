import type { Buddy } from "@/components/companion/types";
import { Extras } from "@/components/companion/buddies/extras";

export const Robot = () => (
  <>
    <ellipse cx="40" cy="91" rx="31" ry="5" fill="#1f8a82" />
    <rect x="22" y="88" width="36" height="3" rx="1.5" fill="#5ef2e0" opacity="0.7" />
    <g className="body">
      <rect x="29" y="72" width="8" height="15" rx="3" fill="#5b7a99" />
      <rect x="43" y="72" width="8" height="15" rx="3" fill="#5b7a99" />
      <rect x="20" y="46" width="40" height="30" rx="9" fill="#8fb3d6" />
      <rect x="30" y="54" width="20" height="13" rx="3" fill="#263a52" />
      <circle className="led l1" cx="36" cy="60" r="2.2" fill="#5ef2e0" />
      <circle className="led l2" cx="41" cy="60" r="2.2" fill="#ffc933" />
      <circle className="led l3" cx="46" cy="60" r="2.2" fill="#ff5d73" />
      <rect x="9" y="50" width="9" height="22" rx="4.5" fill="#7a9bbd" />
      <rect className="wing wr" x="62" y="50" width="9" height="22" rx="4.5" fill="#7a9bbd" />
      <line x1="40" y1="12" x2="40" y2="3" stroke="#7a9bbd" strokeWidth="2.5" strokeLinecap="round" />
      <circle className="beacon" cx="40" cy="2" r="3.4" fill="#ff5d73" />
      <rect x="15" y="11" width="50" height="36" rx="13" fill="#a9c7e4" />
      <rect x="21" y="17" width="38" height="24" rx="9" fill="#0d1b2a" />
      <g className="pupils">
        <circle cx="31.5" cy="28" r="5" fill="#5ef2e0" />
        <circle cx="48.5" cy="28" r="5" fill="#5ef2e0" />
        <circle cx="32.8" cy="26.6" r="1.4" fill="#fff" />
        <circle cx="49.8" cy="26.6" r="1.4" fill="#fff" />
      </g>
      <path d="M35 35q5 3 10 0" stroke="#5ef2e0" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <rect className="lid" x="21" y="17" width="38" height="24" rx="9" fill="#0d1b2a" />
      <Extras hat={[40, 12]} />
    </g>
  </>
);

export const ROBOT_BUDDY: Buddy = {
  id: "robot",
  name: "Bit the robot",
  scene: "lab",
  special: { from: 13, to: 14, name: "Overclock" },
  art: Robot,
  react: {
    supernova: "Supernova detected. Beautiful. Illogical, but beautiful.",
    nebula: "Nebula scan: 100% pretty.",
    shooting: "Meteor trajectory logged. Wish queued.",
    comet: "Comet speed: very fast. My fans are spinning.",
    cluster: "Star cluster found. Counting… I lost count.",
    aurora: "Aurora detected. Charged particles, lovely colours.",
    saturn: "Saturn confirmed. Ring count: several.",
    asteroid: "WARNING: object on collision course.",
    impact: "Impact registered. Systems nominal. Mostly.",
    rings: "Rings have left the planet. Unplanned disassembly.",
  },
  lines: {
    chat: [
      "Running motivation.exe. All systems go.",
      "Recommended next action: one solved problem.",
      "Sorting your tasks by priority. Start with the top one.",
      "Fun fact: I never skip a revision cycle.",
      "Bug found: you haven't practised today. Patching now?",
      "Beep boop. Tick a box.",
      "Probability you'll finish today: high, if you start now.",
      "Time complexity of procrastination: O(infinity).",
    ],
    sleep: [
      "standby mode… 01111010 01111010…",
      "zzz… defragmenting dreams…",
      "Low power. Please try again after charging…",
      "bzzt… no input… zzz…",
    ],
    night: [
      "Night mode on. Screen brightness lowered.",
      "Reading at low power. Efficient.",
      "Lamp online. Studying in progress.",
      "Evening session: one solved problem, then log off.",
    ],
    party: [
      "All tasks complete. Dance protocol started.",
      "Beep boop! Celebration mode: ON.",
      "Checklist: 100%. Confetti: deployed.",
      "Mission accomplished. Disco subroutine running.",
    ],
    special: [
      "Overclock engaged. Fans spinning. Ready to solve.",
      "Afternoon boost: processing at full speed.",
      "Temperature rising. Productivity too.",
    ],
    outcomes: {
      right: ["Answer verified. Correct.", "Match found. Nice.", "Output: correct. Satisfaction: high."],
      wrong: [
        "Error detected. Debug the explanation.",
        "Mismatch. Logging to your mistakes list.",
        "Wrong output. Not a crash, just a learning step.",
      ],
      skip: ["Question skipped. Added to the backlog.", "Null answer received. I'll flag it."],
      giveup: [
        "Process terminated early. Core dump: review the questions.",
        "Mock aborted. Restart when ready. No hard feelings.",
      ],
      quit: [
        "Session closed with unsolved items. Added to your backlog.",
        "Exiting early. Unfinished questions remain in memory.",
      ],
      progress: ["Session saved. Progress logged. Well done.", "Questions answered: more than zero. Efficiency up."],
    },
  },
};
