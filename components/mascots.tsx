// Five study buddies. Every one has .pupils (follow the cursor) and .lid (blink / sleep) so the same animation rules apply.
import type { ReactNode } from "react";

const Extras = ({ hat = [40, 12] as [number, number], noHat = false }) => (
  <>
    {!noHat && <g className="hat" transform={`translate(${hat[0] - 40}, ${hat[1] - 12})`}><path d="M30 12 L40 -10 L50 12 Z" fill="#ff5d73" /><circle cx="40" cy="-11" r="3.2" fill="#ffc933" /><path d="M33 7h14" stroke="#ffc933" strokeWidth="2" /></g>}
    <g className="zzz" fontFamily="var(--font-display)" fontWeight="800" fill="#9fb3c8"><text x="58" y="12" fontSize="11">z</text><text x="66" y="0" fontSize="8">z</text></g>
    <g className="spark" fill="#ffc933"><path d="M8 18l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" /><path d="M72 30l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6z" /></g>
  </>
);

const Owl = () => (
  <>
    <rect x="6" y="84" width="68" height="11" rx="2.5" fill="#14b8a6" /><rect x="12" y="75" width="58" height="10" rx="2.5" fill="#ff5d73" /><rect x="9" y="67" width="62" height="9" rx="2.5" fill="#ffc933" />
    <g className="body">
      <path d="M18 24 L22 6 L35 19 Z M62 24 L58 6 L45 19 Z" fill="#a8703f" /><ellipse cx="40" cy="44" rx="25" ry="26" fill="#a8703f" /><ellipse cx="40" cy="54" rx="15" ry="16" fill="#f6e0bd" />
      <path d="M33 52q3 3 6 0M41 52q3 3 6 0M33 60q3 3 6 0M41 60q3 3 6 0" stroke="#d9b98c" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <ellipse className="wing wl" cx="16" cy="48" rx="7" ry="15" fill="#8a5a30" /><ellipse className="wing wr" cx="64" cy="48" rx="7" ry="15" fill="#8a5a30" />
      <circle cx="30" cy="34" r="10" fill="#fff" stroke="#6b4423" strokeWidth="1.5" /><circle cx="50" cy="34" r="10" fill="#fff" stroke="#6b4423" strokeWidth="1.5" />
      <g className="pupils"><circle cx="30" cy="34" r="4.3" fill="#111" /><circle cx="50" cy="34" r="4.3" fill="#111" /><circle cx="31.4" cy="32.6" r="1.2" fill="#fff" /><circle cx="51.4" cy="32.6" r="1.2" fill="#fff" /></g>
      <ellipse className="lid" cx="30" cy="34" rx="10.5" ry="10.5" fill="#a8703f" /><ellipse className="lid" cx="50" cy="34" rx="10.5" ry="10.5" fill="#a8703f" />
      <path d="M36 42 L44 42 L40 50 Z" fill="#ff9a3c" /><ellipse cx="33" cy="69" rx="5" ry="2.4" fill="#ff9a3c" /><ellipse cx="47" cy="69" rx="5" ry="2.4" fill="#ff9a3c" />
      <Extras />
    </g>
  </>
);

const Robot = () => (
  <>
    <ellipse cx="40" cy="91" rx="31" ry="5" fill="#1f8a82" /><rect x="22" y="88" width="36" height="3" rx="1.5" fill="#5ef2e0" opacity="0.7" />
    <g className="body">
      <rect x="29" y="72" width="8" height="15" rx="3" fill="#5b7a99" /><rect x="43" y="72" width="8" height="15" rx="3" fill="#5b7a99" />
      <rect x="20" y="46" width="40" height="30" rx="9" fill="#8fb3d6" /><rect x="30" y="54" width="20" height="13" rx="3" fill="#263a52" />
      <circle className="led l1" cx="36" cy="60" r="2.2" fill="#5ef2e0" /><circle className="led l2" cx="41" cy="60" r="2.2" fill="#ffc933" /><circle className="led l3" cx="46" cy="60" r="2.2" fill="#ff5d73" />
      <rect x="9" y="50" width="9" height="22" rx="4.5" fill="#7a9bbd" /><rect className="wing wr" x="62" y="50" width="9" height="22" rx="4.5" fill="#7a9bbd" />
      <line x1="40" y1="12" x2="40" y2="3" stroke="#7a9bbd" strokeWidth="2.5" strokeLinecap="round" /><circle className="beacon" cx="40" cy="2" r="3.4" fill="#ff5d73" />
      <rect x="15" y="11" width="50" height="36" rx="13" fill="#a9c7e4" /><rect x="21" y="17" width="38" height="24" rx="9" fill="#0d1b2a" />
      <g className="pupils"><circle cx="31.5" cy="28" r="5" fill="#5ef2e0" /><circle cx="48.5" cy="28" r="5" fill="#5ef2e0" /><circle cx="32.8" cy="26.6" r="1.4" fill="#fff" /><circle cx="49.8" cy="26.6" r="1.4" fill="#fff" /></g>
      <path d="M35 35q5 3 10 0" stroke="#5ef2e0" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <rect className="lid" x="21" y="17" width="38" height="24" rx="9" fill="#0d1b2a" />
      <Extras hat={[40, 12]} />
    </g>
  </>
);

const Cat = () => (
  <>
    <ellipse cx="40" cy="89" rx="33" ry="8" fill="#f06292" /><ellipse cx="40" cy="86" rx="29" ry="6" fill="#f8bbd0" />
    <g className="body">
      <path className="tail" d="M60 80 q22 -2 16 -28" stroke="#e8923a" strokeWidth="7" fill="none" strokeLinecap="round" />
      <ellipse cx="40" cy="66" rx="22" ry="20" fill="#f0a04b" /><ellipse cx="40" cy="72" rx="12" ry="12" fill="#fbd9a8" />
      <path d="M20 60q4 2 4 7M60 60q-4 2-4 7" stroke="#c9742a" strokeWidth="2" fill="none" strokeLinecap="round" />
      <ellipse cx="32" cy="82" rx="5.5" ry="4" fill="#f6b86c" /><ellipse cx="48" cy="82" rx="5.5" ry="4" fill="#f6b86c" />
      <path d="M21 24 L22 4 L36 15 Z M59 24 L58 4 L44 15 Z" fill="#f0a04b" /><path d="M25 18 L25 9 L31 14 Z M55 18 L55 9 L49 14 Z" fill="#f8a5b8" />
      <circle cx="40" cy="34" r="20" fill="#f0a04b" /><path d="M36 17v6M40 16v7M44 17v6" stroke="#c9742a" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="31" cy="34" rx="6.5" ry="7" fill="#d8ee7a" stroke="#7a5a2a" strokeWidth="1.2" /><ellipse cx="49" cy="34" rx="6.5" ry="7" fill="#d8ee7a" stroke="#7a5a2a" strokeWidth="1.2" />
      <g className="pupils"><ellipse cx="31" cy="34" rx="2.2" ry="5.4" fill="#111" /><ellipse cx="49" cy="34" rx="2.2" ry="5.4" fill="#111" /></g>
      <ellipse className="lid" cx="31" cy="34" rx="7" ry="7.5" fill="#f0a04b" /><ellipse className="lid" cx="49" cy="34" rx="7" ry="7.5" fill="#f0a04b" />
      <path d="M37.5 42 L42.5 42 L40 45.5 Z" fill="#f06292" /><path d="M40 45.5q-3 4-6 1M40 45.5q3 4 6 1" stroke="#7a4a1a" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      <path d="M17 41h-9M17 45l-8 3M63 41h9M63 45l8 3" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" opacity="0.85" />
      <Extras hat={[40, 14]} />
    </g>
  </>
);

const Astronaut = () => (
  <>
    <g className="body float">
      <rect x="14" y="45" width="10" height="30" rx="4" fill="#c5ced9" />
      <ellipse cx="22" cy="90" rx="0" ry="0" />
      <ellipse className="wing wl" cx="19" cy="60" rx="6.5" ry="13" fill="#f2f5f9" stroke="#cfd8e3" strokeWidth="1.4" /><ellipse className="wing wr" cx="61" cy="60" rx="6.5" ry="13" fill="#f2f5f9" stroke="#cfd8e3" strokeWidth="1.4" />
      <rect x="22" y="46" width="36" height="34" rx="14" fill="#f2f5f9" stroke="#cfd8e3" strokeWidth="1.4" />
      <rect x="32" y="54" width="16" height="11" rx="3" fill="#3a86ff" /><circle className="led l1" cx="37" cy="59.5" r="1.9" fill="#fff" /><circle className="led l2" cx="43" cy="59.5" r="1.9" fill="#ffc933" />
      <ellipse cx="32" cy="82" rx="7.5" ry="8" fill="#f2f5f9" stroke="#cfd8e3" strokeWidth="1.4" /><ellipse cx="48" cy="82" rx="7.5" ry="8" fill="#f2f5f9" stroke="#cfd8e3" strokeWidth="1.4" />
      <ellipse cx="32" cy="88" rx="8" ry="4" fill="#ff6b6b" /><ellipse cx="48" cy="88" rx="8" ry="4" fill="#ff6b6b" />
      <line x1="60" y1="16" x2="64" y2="6" stroke="#cfd8e3" strokeWidth="2" /><circle cx="64" cy="5" r="3" fill="#ff9a3c" />
      <circle cx="40" cy="30" r="22" fill="#f2f5f9" stroke="#cfd8e3" strokeWidth="1.4" /><ellipse cx="40" cy="31" rx="16.5" ry="13.5" fill="#14213d" />
      <path d="M28 25q6-6 14-5" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.4" />
      <g className="pupils"><circle cx="34" cy="32" r="4" fill="#fff" /><circle cx="46" cy="32" r="4" fill="#fff" /><circle cx="34.6" cy="32.4" r="2" fill="#14213d" /><circle cx="46.6" cy="32.4" r="2" fill="#14213d" /></g>
      <ellipse className="lid" cx="40" cy="31" rx="16.5" ry="13.5" fill="#14213d" />
      <Extras hat={[40, 8]} />
    </g>
  </>
);

const Jelly = () => (
  <>
    <circle className="bub" cx="14" cy="60" r="3" fill="none" stroke="#bff3ff" strokeWidth="1.3" /><circle className="bub b2" cx="68" cy="52" r="2.2" fill="none" stroke="#bff3ff" strokeWidth="1.3" /><circle className="bub b3" cx="22" cy="80" r="1.8" fill="none" stroke="#bff3ff" strokeWidth="1.2" />
    <g className="body float">
      {[22, 31, 40, 49, 58].map((x, i) => (
        <path key={x} className="tent" style={{ animationDelay: `${-i * 0.5}s` }} d={`M${x} 56 q${i % 2 ? 5 : -5} 12 0 24 q-4 6 0 10`} stroke="#f472b6" strokeWidth="6" fill="none" strokeLinecap="round" />
      ))}
      <ellipse cx="40" cy="38" rx="25" ry="25" fill="#f472b6" /><circle cx="26" cy="22" r="3.2" fill="#f9a8d4" /><circle cx="52" cy="20" r="2.4" fill="#f9a8d4" /><circle cx="58" cy="30" r="1.8" fill="#f9a8d4" />
      <circle cx="31" cy="40" r="7.5" fill="#fff" /><circle cx="49" cy="40" r="7.5" fill="#fff" />
      <g className="pupils"><circle cx="31" cy="40" r="3.8" fill="#3b0a3c" /><circle cx="49" cy="40" r="3.8" fill="#3b0a3c" /><circle cx="32.2" cy="38.8" r="1.1" fill="#fff" /><circle cx="50.2" cy="38.8" r="1.1" fill="#fff" /></g>
      <ellipse className="lid" cx="31" cy="40" rx="8" ry="8" fill="#f472b6" /><ellipse className="lid" cx="49" cy="40" rx="8" ry="8" fill="#f472b6" />
      <ellipse cx="22" cy="50" rx="4" ry="2.4" fill="#fb7185" opacity="0.6" /><ellipse cx="58" cy="50" rx="4" ry="2.4" fill="#fb7185" opacity="0.6" />
      <path d="M35 51q5 4 10 0" stroke="#3b0a3c" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <Extras hat={[40, 18]} />
    </g>
  </>
);


const Teacup = () => (
  <>
    <ellipse cx="40" cy="90" rx="31" ry="6.5" fill="#dfe7f5" stroke="#b6c3dc" strokeWidth="1.4" /><ellipse cx="40" cy="88.5" rx="21" ry="3.6" fill="#f4f7fd" />
    <path className="steam" d="M18 38q-6 -8 0 -15q6 -7 0 -14" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" opacity="0.8" />
    <path className="steam s2" d="M64 38q6 -8 0 -15q-6 -7 0 -14" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" opacity="0.8" />
    <g className="body">
      <path d="M62 54q20 -1 16 14q-4 12 -17 9" stroke="#c9d4e8" strokeWidth="5.5" fill="none" strokeLinecap="round" />
      <path d="M16 46h48q0 36 -24 40q-24 -4 -24 -40z" fill="#fffaf0" stroke="#c9d4e8" strokeWidth="1.6" />
      <path d="M18 74h44" stroke="#3b6bb5" strokeWidth="1.6" strokeDasharray="1 4.2" strokeLinecap="round" /><path d="M20.5 78.6q19.5 5 39 0" stroke="#3b6bb5" strokeWidth="1.2" fill="none" />
      <ellipse cx="40" cy="47" rx="24" ry="5" fill="#8a4f2a" stroke="#c9d4e8" strokeWidth="1.4" />
      <circle cx="30" cy="62" r="6" fill="#fff" stroke="#6b5a47" strokeWidth="1.3" /><circle cx="50" cy="62" r="6" fill="#fff" stroke="#6b5a47" strokeWidth="1.3" />
      <g className="pupils"><circle cx="30" cy="62" r="2.7" fill="#111" /><circle cx="50" cy="62" r="2.7" fill="#111" /></g>
      <ellipse className="lid" cx="30" cy="62" rx="6.6" ry="6.6" fill="#fffaf0" /><ellipse className="lid" cx="50" cy="62" rx="6.6" ry="6.6" fill="#fffaf0" />
      <circle cx="50" cy="62" r="8.4" fill="none" stroke="#d8a928" strokeWidth="1.5" /><path d="M56 68q5 9 1 17" stroke="#d8a928" strokeWidth="1" fill="none" />
      <path d="M40 69q-5 -3 -10 0q-3 2 -6 -1q4 6 16 4q12 2 16 -4q-3 3 -6 1q-5 -3 -10 0z" fill="#4a2f1a" /><path d="M35 74q5 4 10 0" stroke="#4a2f1a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <ellipse cx="40" cy="45" rx="19.5" ry="4.2" fill="#1d1d2b" /><rect x="28" y="22" width="24" height="23" rx="2.2" fill="#2b2b40" /><rect x="28" y="37" width="24" height="5.5" fill="#b3262e" /><rect x="37" y="36.4" width="6" height="6.6" rx="1" fill="none" stroke="#e6c34a" strokeWidth="1.3" />
      <ellipse cx="40" cy="22" rx="12" ry="2.6" fill="#3a3a55" />
      <Extras noHat />
    </g>
  </>
);

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
const Rex = () => (
  <>
    <ellipse cx="42" cy="93" rx="30" ry="4" fill="rgba(0,0,0,0.28)" />
    <g className="body" shapeRendering="crispEdges"><g transform="translate(-7 0)">
      {REX.flatMap((row, y) => [...row].map((c, x) => (c === "." ? null : <rect key={`${x}-${y}`} x={x * 3.6} y={22 + y * 3.6} width="3.7" height="3.7" fill={REX_COL[c]} />)))}
      <rect x="57.6" y="26.4" width="7.4" height="7.4" fill="#fff" />
      <g className="pupils"><rect x="61" y="28.2" width="3.7" height="4.4" fill="#111" /></g>
      <rect className="lid" x="57.6" y="26.4" width="7.4" height="7.4" fill="#4fc15a" />
      <rect x="64.8" y="39" width="10" height="2" fill="#fff" /><rect x="68" y="40.8" width="2.6" height="2.6" fill="#fff" />
      <Extras hat={[66, 30]} />
    </g></g>
  </>
);

const Ghost = () => (
  <>
    <ellipse className="gshadow" cx="40" cy="92" rx="22" ry="3.6" fill="rgba(0,0,0,0.25)" />
    <g className="body float"><g className="shiver">
      <ellipse className="wing wl" cx="15" cy="56" rx="5.5" ry="11" fill="#f2f5ff" stroke="#c9d1ee" strokeWidth="1.3" transform="rotate(30 15 56)" /><ellipse className="wing wr" cx="65" cy="56" rx="5.5" ry="11" fill="#f2f5ff" stroke="#c9d1ee" strokeWidth="1.3" transform="rotate(-30 65 56)" />
      <path d="M17 88V42a23 23 0 0146 0v46q-5.75 -8 -11.5 0q-5.75 8 -11.5 0q-5.75 -8 -11.5 0q-5.75 8 -11.5 0z" fill="#f6f8ff" stroke="#c9d1ee" strokeWidth="1.6" />
      <ellipse cx="22" cy="56" rx="4.2" ry="2.6" fill="#ff9ab8" opacity="0.55" /><ellipse cx="58" cy="56" rx="4.2" ry="2.6" fill="#ff9ab8" opacity="0.55" />
      <circle cx="31" cy="44" r="9" fill="#fff" stroke="#9aa3c8" strokeWidth="1.4" /><circle cx="49" cy="44" r="9" fill="#fff" stroke="#9aa3c8" strokeWidth="1.4" />
      <g className="pupils"><circle cx="31" cy="44" r="2.6" fill="#1b1b33" /><circle cx="49" cy="44" r="2.6" fill="#1b1b33" /></g>
      <ellipse className="lid" cx="31" cy="44" rx="9.6" ry="9.6" fill="#f6f8ff" /><ellipse className="lid" cx="49" cy="44" rx="9.6" ry="9.6" fill="#f6f8ff" />
      <path d="M25 33q6 -4 11 -1M55 33q-6 -4 -11 -1" stroke="#9aa3c8" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <ellipse className="gmouth" cx="40" cy="62" rx="5.2" ry="7" fill="#2a2748" /><ellipse cx="40" cy="65.5" rx="3" ry="2.6" fill="#ff7b9c" />
      <path className="sweat" d="M64 28q-4 7 0 9q4 -2 0 -9z" fill="#7ed0ff" />
      <Extras hat={[40, 22]} />
    </g></g>
  </>
);

export type Scene = "sky" | "lab" | "rain" | "space" | "sea" | "london" | "paris" | "cake";
export type Reaction = "supernova" | "nebula" | "shooting" | "comet" | "cluster" | "aurora" | "saturn" | "asteroid" | "impact" | "rings";
export interface Buddy { id: string; name: string; scene: Scene; art: () => ReactNode; chat: string[]; sleep: string; react: Record<Reaction, string> }

export const BUDDIES: Buddy[] = [
  { id: "owl", name: "Hoot the owl", scene: "sky", art: Owl, sleep: "zzz… sleep is revision too…",
    react: { supernova: "A star just exploded. Hoot. Respect.", nebula: "A newborn nebula. Make a wish.", shooting: "Shooting stars! Wish for full marks.", comet: "A comet! Rarer than a perfect mock.", cluster: "Stars twinkling on cue. Show-offs.", aurora: "Northern lights! Worth staying up for.", saturn: "Saturn! Look at those rings. Hoot hoot.", asteroid: "Incoming rock! Tuck in your wings.", impact: "Direct hit. Earth has survived worse than finals.", rings: "The rings flew off! Is that allowed?" },
    chat: ["One question. Then another.", "Hoot! Did you tick a task yet?", "Water break? Then back to it.", "Mistake log time. Future you says thanks.", "I believe in your eigenvalues.", "Slow is fine. Stopping isn't.", "Stretch your neck. Look far away. Resume.", "Wrong in practice beats wrong in the exam."] },
  { id: "robot", name: "Bit the robot", scene: "lab", art: Robot, sleep: "standby mode… 01111010 01111010…",
    react: { supernova: "Supernova detected. Beautiful. Illogical, but beautiful.", nebula: "Nebula scan: 100% pretty.", shooting: "Meteor trajectory logged. Wish queued.", comet: "Comet speed: very fast. My fans are spinning.", cluster: "Star cluster found. Counting… I lost count.", aurora: "Aurora detected. Charged particles, lovely colours.", saturn: "Saturn confirmed. Ring count: several.", asteroid: "WARNING: object on collision course.", impact: "Impact registered. Systems nominal. Mostly.", rings: "Rings have left the planet. Unplanned disassembly." },
    chat: ["Running motivation.exe. All systems go.", "Recommended next action: one solved problem.", "Sorting your tasks by priority. Start with the top one.", "Fun fact: I never skip a revision cycle.", "Bug found: you haven't practised today. Patching now?", "Beep boop. Tick a box.", "Probability you'll finish today: high, if you start now.", "Time complexity of procrastination: O(infinity)."] },
  { id: "cat", name: "Miso the cat", scene: "rain", art: Cat, sleep: "purrr… zzz… purrr…",
    react: { supernova: "Mrrow! Something exploded. I want it.", nebula: "Pretty smoke. Can I bat at it?", shooting: "A streak! Must. Chase.", comet: "A giant laser pointer in the sky!", cluster: "Sparkles! Sparkles everywhere!", aurora: "Glowing green curtains. Fancy.", saturn: "A planet with a hula hoop. Cute.", asteroid: "It's coming right for us. I'm not moving.", impact: "Boom. I knocked it off the sky like a cup.", rings: "Rings flew away. I'd have caught them." },
    chat: ["Rainy day. Perfect for problems.", "Mrrow. Open the book.", "I knocked your distractions off the desk.", "Nap after the next task. I'll supervise.", "Purr. You're doing fine.", "Ignore the rain. Solve one more.", "Keep calm and solve it twice.", "That blank page isn't scary. It's just waiting."] },
  { id: "astro", name: "Nova the astronaut", scene: "space", art: Astronaut, sleep: "floating… zzz… drifting…",
    react: { supernova: "That's a real one! Wow!", nebula: "Stellar nursery. I've flown past one. Not this pretty.", shooting: "Meteors! Mind the visor.", comet: "Comet flyby. Great view from up here.", cluster: "A star cluster. My favourite neighbours.", aurora: "I've seen auroras from orbit. They look even better from the ground.", saturn: "Saturn! I've always wanted to visit.", asteroid: "Houston, we have an incoming asteroid!", impact: "Impact confirmed. Earth, are you okay?", rings: "The rings just left the building." },
    chat: ["Houston, we have a study session.", "Small steps. One giant leap by exam day.", "Gravity pulls. Discipline pulls back.", "Mission: finish today's checklist.", "Orbit complete: another day, another tick.", "No excuses in zero-g. Just float into the problem.", "Countdown to GATE: still plenty of fuel.", "Ground control says: take a short break."] },
  { id: "jelly", name: "Blob the jellyfish", scene: "sea", art: Jelly, sleep: "blub… zzz… blub…",
    react: { supernova: "Blub! Lights in the sky!", nebula: "So many colours. Like a jellyfish bloom.", shooting: "Shooting stars. I only see them through the water.", comet: "Blub. A very fast fish in the sky.", cluster: "Sparkles! They look like plankton.", aurora: "The sky is glowing like me!", saturn: "A planet with a ring. Like a floaty.", asteroid: "Blub… that rock is big. And fast.", impact: "Even down here, I felt that.", rings: "Rings flying off! Wheee." },
    chat: ["Go with the flow. Then solve the problem.", "Blub. Take a deep breath.", "Deep thoughts need deep focus.", "Be soft with yourself, firm with your schedule.", "Tentacles crossed for your next mock.", "Float, then dive in.", "Every bubble is a small win. Pop some.", "Swim lanes: one topic at a time."] },
  { id: "tea", name: "Lord Earl Grey", scene: "london", art: Teacup, sleep: "snoring politely… zzz…",
    react: { supernova: "Good heavens! A supernova. Most irregular.", nebula: "Quite the display. Reminds me of the Great Exhibition.", shooting: "A shooting star! I shall wish for a better biscuit.", comet: "A comet! Terribly punctual.", cluster: "Sparkling indeed. How very festive.", aurora: "The Northern Lights! One does adore a good show.", saturn: "Saturn! Rather a fine hat, I must say.", asteroid: "Oh dear. Something rocky approaches.", impact: "Well! That will spill the tea.", rings: "The rings have come off. How undignified." },
    chat: ["A spot of revision, I think.", "Splendid progress. Do carry on.", "Tea first, then Bayes' theorem.", "Posture, old chap. And hydration.", "One simply does not skip the mistake log.", "Stiff upper lip. The next problem awaits.", "Jolly good. One more topic?", "A well-planned day is a well-brewed pot."] },
  { id: "rex", name: "Rexy the T-rex", scene: "paris", art: Rex, sleep: "zzz… RAWR… zzz…",
    react: { supernova: "ROAR! That exploded harder than the meteor that got my family.", nebula: "Pixel clouds. Very retro. I approve.", shooting: "Wish on a meteor? Bold choice.", comet: "Another space rock? Please not again.", cluster: "Sparkles! Sparkles are fine.", aurora: "Disco lights in the sky! Level up!", saturn: "A planet with a hoop! Bonus stage!", asteroid: "Oh no. Not this again.", impact: "Hit! Game over, man. Game over.", rings: "The rings left! Insert coin to continue." },
    chat: ["ROAR! Time to study.", "My arms are tiny, my goals are huge.", "Bonjour! Study like a prehistoric legend.", "Extinction is not on today's schedule.", "Press start on the next topic.", "Fossilised habits can be changed.", "Rawr means keep going.", "One more level. One more problem."] },
  { id: "ghost", name: "Boo the ghost", scene: "cake", art: Ghost, sleep: "zzz… no cake… zzz…",
    react: { supernova: "EEEK! Oh, just a star. Phew.", nebula: "Is that frosting?! No? Phew.", shooting: "Eek! Was that a flying cupcake?", comet: "A comet! Not a cake. I think.", cluster: "Sprinkles?! Oh, only stars.", aurora: "Green icing in the sky?! Oh, just lights.", saturn: "A giant donut with a hole! NOPE.", asteroid: "A rock! Thank goodness, not a cake.", impact: "EEEK!! Was it a cake?! No? Phew.", rings: "The rings are flying! Are those doughnuts?!" },
    chat: ["B-b-boo. Is that cake over there?", "I'm not scared of exams. Cake, yes.", "Please keep the cake away from me.", "Boo! Wait, don't look at the cake.", "I'm shaking. It's probably the cake.", "Study first, and no one brings cake.", "Whooo-oo… I mean eek. Cake!", "Any cake nearby? Asking for nobody."] },
];
