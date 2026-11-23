import type { Buddy } from "@/components/companion/types";
import { Extras } from "@/components/companion/buddies/extras";

export const Astronaut = () => (
  <>
    <g className="body float">
      <rect x="14" y="45" width="10" height="30" rx="4" fill="#c5ced9" />
      <ellipse cx="22" cy="90" rx="0" ry="0" />
      <ellipse className="wing wl" cx="19" cy="60" rx="6.5" ry="13" fill="#f2f5f9" stroke="#cfd8e3" strokeWidth="1.4" />
      <ellipse className="wing wr" cx="61" cy="60" rx="6.5" ry="13" fill="#f2f5f9" stroke="#cfd8e3" strokeWidth="1.4" />
      <rect x="22" y="46" width="36" height="34" rx="14" fill="#f2f5f9" stroke="#cfd8e3" strokeWidth="1.4" />
      <rect x="32" y="54" width="16" height="11" rx="3" fill="#3a86ff" />
      <circle className="led l1" cx="37" cy="59.5" r="1.9" fill="#fff" />
      <circle className="led l2" cx="43" cy="59.5" r="1.9" fill="#ffc933" />
      <ellipse cx="32" cy="82" rx="7.5" ry="8" fill="#f2f5f9" stroke="#cfd8e3" strokeWidth="1.4" />
      <ellipse cx="48" cy="82" rx="7.5" ry="8" fill="#f2f5f9" stroke="#cfd8e3" strokeWidth="1.4" />
      <ellipse cx="32" cy="88" rx="8" ry="4" fill="#ff6b6b" />
      <ellipse cx="48" cy="88" rx="8" ry="4" fill="#ff6b6b" />
      <line x1="60" y1="16" x2="64" y2="6" stroke="#cfd8e3" strokeWidth="2" />
      <circle cx="64" cy="5" r="3" fill="#ff9a3c" />
      <circle cx="40" cy="30" r="22" fill="#f2f5f9" stroke="#cfd8e3" strokeWidth="1.4" />
      <ellipse cx="40" cy="31" rx="16.5" ry="13.5" fill="#14213d" />
      <path d="M28 25q6-6 14-5" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.4" />
      <g className="pupils">
        <circle cx="34" cy="32" r="4" fill="#fff" />
        <circle cx="46" cy="32" r="4" fill="#fff" />
        <circle cx="34.6" cy="32.4" r="2" fill="#14213d" />
        <circle cx="46.6" cy="32.4" r="2" fill="#14213d" />
      </g>
      <ellipse className="lid" cx="40" cy="31" rx="16.5" ry="13.5" fill="#14213d" />
      <Extras hat={[40, 8]} />
    </g>
  </>
);

export const ASTRONAUT_BUDDY: Buddy = {
  id: "astro",
  name: "Nova the astronaut",
  scene: "space",
  special: { from: 11, to: 12, name: "Spacewalk" },
  art: Astronaut,
  react: {
    supernova: "That's a real one! Wow!",
    nebula: "Stellar nursery. I've flown past one. Not this pretty.",
    shooting: "Meteors! Mind the visor.",
    comet: "Comet flyby. Great view from up here.",
    cluster: "A star cluster. My favourite neighbours.",
    aurora: "I've seen auroras from orbit. They look even better from the ground.",
    saturn: "Saturn! I've always wanted to visit.",
    asteroid: "Houston, we have an incoming asteroid!",
    impact: "Impact confirmed. Earth, are you okay?",
    rings: "The rings just left the building.",
  },
  lines: {
    chat: [
      "Houston, we have a study session.",
      "Small steps. One giant leap by exam day.",
      "Gravity pulls. Discipline pulls back.",
      "Mission: finish today's checklist.",
      "Orbit complete: another day, another tick.",
      "No excuses in zero-g. Just float into the problem.",
      "Countdown to exam day: still plenty of fuel.",
      "Ground control says: take a short break.",
    ],
    sleep: [
      "floating… zzz… drifting…",
      "zzz… sleeping bag attached to the wall…",
      "Houston… five more minutes of orbit… zzz…",
      "Quiet cabin. Crew is resting…",
    ],
    night: [
      "Night cycle. Time to review the day's mission.",
      "Reading by the cabin light. Cosy.",
      "Evening orbit: one more topic.",
      "The stars are out. So is my notebook.",
    ],
    party: [
      "Mission complete! Zero-g dance party!",
      "All tasks docked. Confetti in orbit!",
      "Houston, the checklist is empty. Celebrate!",
      "One small step for you. One giant party for us.",
    ],
    special: [
      "Spacewalk time! Tethered to the study plan.",
      "Floating outside the capsule. Great view of your progress.",
      "EVA in progress. Keep going.",
    ],
    outcomes: {
      right: ["Houston, that's a correct answer!", "Perfect landing.", "Mission success on that one."],
      wrong: [
        "Small course correction needed. Check the explanation.",
        "Off target. Recalculate and relaunch.",
        "Not this orbit. Try again.",
      ],
      skip: ["Skipping this one. We'll circle back.", "Question parked in orbit. Return when ready."],
      giveup: [
        "Mission aborted. Debrief with the review page.",
        "Abort logged. Next launch window is whenever you choose.",
      ],
      quit: [
        "Leaving the topic before it's cleared? Mission incomplete.",
        "Questions still in orbit. Dock with them next time.",
      ],
      progress: ["Good orbit today. Progress logged.", "Mission segment complete. Resume from here next time."],
    },
  },
};
