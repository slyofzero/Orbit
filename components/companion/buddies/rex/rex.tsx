import type { Buddy } from "@/components/companion/types";
import { Extras } from "@/components/companion/buddies/extras";

const REX = [
  "...............gggggg.",
  "..............gggggggg",
  "..............gggggggg",
  "..............gggggggg",
  "..............ggggggg.",
  "..............gggg....",
  ".........d...ggggg....",
  "..g.....dd.ggggggg.dd.",
  "..gg...ddggggggggg.dd.",
  "..ggg.ddgggggggggg....",
  "...gggggggggggggggg...",
  "....ggggggggggggggg...",
  ".....ggggbbbbbbggg....",
  "......gggbbbbbbggg....",
  ".......ggbbbbbgggg....",
  ".......gggbbbggg......",
  ".......ggg...ggg......",
  "......dddd...dddd.....",
];
const REX_COL: Record<string, string> = { g: "#4fc15a", d: "#2a8a3a", b: "#d4f59a" };

export const Rex = () => (
  <>
    <ellipse cx="42" cy="93" rx="30" ry="4" fill="rgba(0,0,0,0.28)" />
    <g className="body" shapeRendering="crispEdges">
      <g transform="translate(-7 0)">
        {REX.flatMap((row, y) =>
          [...row].map((c, x) =>
            c === "." ? null : (
              <rect key={`${x}-${y}`} x={x * 3.6} y={22 + y * 3.6} width="3.7" height="3.7" fill={REX_COL[c]} />
            ),
          ),
        )}
        <rect x="57.6" y="26.4" width="7.4" height="7.4" fill="#fff" />
        <g className="pupils">
          <rect x="61" y="28.2" width="3.7" height="4.4" fill="#111" />
        </g>
        <rect className="lid" x="57.6" y="26.4" width="7.4" height="7.4" fill="#4fc15a" />
        <rect x="64.8" y="39" width="10" height="2" fill="#fff" />
        <rect x="68" y="40.8" width="2.6" height="2.6" fill="#fff" />
        <Extras hat={[66, 30]} />
      </g>
    </g>
  </>
);

export const REX_BUDDY: Buddy = {
  id: "rex",
  name: "Rexy the T-rex",
  scene: "paris",
  special: { from: 10, to: 11, name: "Rampage" },
  art: Rex,
  react: {
    supernova: "ROAR! That exploded harder than the meteor that got my family.",
    nebula: "Pixel clouds. Very retro. I approve.",
    shooting: "Wish on a meteor? Bold choice.",
    comet: "Another space rock? Please not again.",
    cluster: "Sparkles! Sparkles are fine.",
    aurora: "Disco lights in the sky! Level up!",
    saturn: "A planet with a hoop! Bonus stage!",
    asteroid: "Oh no. Not this again.",
    impact: "Hit! Game over, man. Game over.",
    rings: "The rings left! Insert coin to continue.",
  },
  lines: {
    chat: [
      "ROAR! Time to study.",
      "My arms are tiny, my goals are huge.",
      "Bonjour! Study like a prehistoric legend.",
      "Extinction is not on today's schedule.",
      "Press start on the next topic.",
      "Fossilised habits can be changed.",
      "Rawr means keep going.",
      "One more level. One more problem.",
    ],
    sleep: [
      "zzz… RAWR… zzz…",
      "zzz… dreaming of tiny arms… rawr…",
      "Five more minutes… then ROAR… zzz…",
      "Shhh. Dinosaur is hibernating.",
    ],
    night: [
      "Night level unlocked: study mode.",
      "Rawr. Quiet reading. Tiny arms hold the book.",
      "Evening quest: finish one topic.",
      "Lamp on. Press start.",
    ],
    party: [
      "ROAR! All tasks done! Party level unlocked!",
      "Victory stomp! Rawr!",
      "Checklist cleared. Insert confetti.",
      "You win the day. Dino dance!",
    ],
    special: [
      "RAMPAGE! Smashing through those problems!",
      "Rawr! Stomp-stomp. Strong start to the day.",
      "Morning rampage: eat problems, not time.",
    ],
    outcomes: {
      right: ["ROAR! Correct! +100 points.", "Level up! Right answer.", "Nailed it. My tiny arms applaud."],
      wrong: [
        "Rawr… wrong. Insert coin to continue.",
        "Game over on that one. Try again.",
        "Wrong answer. Not extinct yet, though.",
      ],
      skip: ["Skipped this level. Bonus stage later.", "Boss question skipped. It'll be back."],
      giveup: ["You quit the mock. Game over, man. Press start again.", "Rage-quit detected. Respawn when ready."],
      quit: [
        "Quitting mid-level? Unsolved questions remain. Rawr.",
        "You left with questions undone. Continue? Press start.",
      ],
      progress: ["Checkpoint saved! Nice run.", "ROAR! Progress made. Press start when you return."],
    },
  },
};
