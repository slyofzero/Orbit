"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { QUOTES } from "@/lib/quotes";
import { todayIST } from "@/lib/plan";
import { KEYS, usePersisted, usePlan } from "@/lib/store";
import { BUDDIES, type Reaction } from "./mascots";
import { OUTCOME_LINES } from "./outcomes";
import { ADMIN_LINES, ADMIN_NOTES } from "./adminLines";
import { isAdminProfile } from "@/lib/profiles";
import { takePending, type Outcome } from "@/lib/outcome";
import { SPECIALS, partyActive, petMode, specialOf, type PartyRec } from "@/lib/petMode";
import { NIGHT_LINES, PARTY_LINES, SLEEP_LINES, SPECIAL_LINES } from "./modeLines";

const STARS: [number, number, number][] = [[12, 8, 0], [70, 14, 1.2], [38, 20, 2.1], [84, 32, 0.6], [20, 38, 1.7], [58, 44, 2.6], [8, 56, 0.9], [76, 60, 1.9], [44, 66, 0.3], [90, 74, 2.3], [26, 80, 1.4], [62, 8, 0.8], [30, 52, 2.0], [84, 88, 1.1]];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const ROTATE_MS = 5 * 60 * 1000;

const SceneArt = ({ scene }: { scene: string }) => {
  switch (scene) {
    case "sky": return (<><em className="orb" />{STARS.map(([l, t, d], i) => <i key={i} style={{ left: `${l}%`, top: `${t}%`, animationDelay: `${d}s` }} />)}<u /><u className="b" /><b style={{ top: "14%", animationDelay: "-6s" }} /><b className="s" style={{ top: "34%", animationDelay: "-22s" }} /><b style={{ top: "52%", animationDelay: "-40s" }} /></>);
    case "lab": return (<>{STARS.map(([l, , d], i) => <i key={i} style={{ left: `${l}%`, animationDelay: `${-d * 3}s`, animationDuration: `${5 + (i % 4)}s` }}>{i % 2 ? "1" : "0"}</i>)}<s style={{ top: "12%" }} /><s style={{ top: "40%", animationDelay: "-1s" }} /><s style={{ top: "68%", animationDelay: "-2s" }} /></>);
    case "rain": return (<><em className="lamp" />{STARS.concat(STARS).map(([l, t, d], i) => <i key={i} style={{ left: `${(l * 1.07 + i * 3) % 100}%`, animationDelay: `${-(t / 10 + d + i * 0.17)}s`, animationDuration: `${0.9 + (i % 5) * 0.15}s` }} />)}<u /></>);
    case "space": return (<><em className="planet" />{STARS.map(([l, t, d], i) => <i key={i} style={{ left: `${l}%`, top: `${t}%`, animationDelay: `${-d * 4}s`, animationDuration: `${12 + (i % 5) * 4}s` }} />)}<u /></>);
    case "london": return (<><svg className="ben" viewBox="0 0 40 130" aria-hidden="true"><path d="M14 130V52h12v78zM12 52h16l-2-8H14zM15 44h10V30l-5-18-5 18zM19 12h2V2h-2z" /><circle className="face" cx="20" cy="38" r="4.2" /></svg><em className="gas" /><s style={{ top: "52%" }} /><s style={{ top: "66%", animationDelay: "-6s" }} /><s style={{ top: "80%", animationDelay: "-11s" }} />{STARS.slice(0, 7).map(([l, t, d], i) => <i key={i} style={{ left: `${l}%`, top: `${t * 0.5}%`, animationDelay: `${d}s` }} />)}</>);
    case "paris": return (<><em className="sun" /><svg className="eif" viewBox="0 0 60 120" aria-hidden="true"><path d="M30 2l2 36c3 22 9 48 26 82h-9c-5-10-9-17-14-21H25c-5 4-9 11-14 21H2C19 86 25 60 28 38z" /><rect x="19" y="62" width="22" height="3" /><rect x="14" y="88" width="32" height="3.5" /><defs><linearGradient id="eifbeam"><stop offset="0" stopColor="#fff7c0" /><stop offset="1" stopColor="#fff7c0" stopOpacity="0" /></linearGradient></defs><rect className="beam" x="30" y="1" width="80" height="2" rx="1" fill="url(#eifbeam)" /></svg>{STARS.slice(0, 9).map(([l, t, d], i) => <i key={i} style={{ left: `${l}%`, top: `${t * 0.45}%`, animationDelay: `${d}s` }} />)}</>);
    case "cake": return (<>{["🍰", "🧁", "🎂", "🍩", "🍪", "🧁", "🍰", "🍩", "🎂", "🍪"].map((c, i) => <i key={i} style={{ left: `${(i * 37 + 8) % 86}%`, animationDelay: `${-i * 2.1}s`, animationDuration: `${15 + (i % 4) * 3}s`, fontSize: 14 + (i % 3) * 4 }}>{c}</i>)}</>);
    default: return (<><u />{STARS.map(([l, t, d], i) => <i key={i} style={{ left: `${l}%`, animationDelay: `${-d * 3 - t / 9}s`, animationDuration: `${7 + (i % 5) * 1.5}s`, width: 4 + (i % 4) * 3, height: 4 + (i % 4) * 3 }} />)}</>);
  }
};

// Night study: a warm lamp glow, a small open book and a lamp, drawn over the buddy's lap.
const NightStudy = () => (
  <g className="ns" aria-hidden="true">
    <defs><radialGradient id="ns-glow" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#ffd56a" stopOpacity="0.6" /><stop offset="1" stopColor="#ffd56a" stopOpacity="0" /></radialGradient></defs>
    <ellipse className="ns-glow" cx="62" cy="84" rx="30" ry="26" fill="url(#ns-glow)" />
    <path d="M66 94h10M71 94V82l-5-8" stroke="#8b94a8" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M60 72l8-5 7 6z" fill="#ffc933" stroke="#d8a928" strokeWidth="0.8" strokeLinejoin="round" />
    <path d="M24 85q8-3 16 1v9q-8-4-16-1zM56 85q-8-3-16 1v9q8-4 16-1z" fill="#fdf6e3" stroke="#c9b98a" strokeWidth="1" strokeLinejoin="round" />
    <path d="M27 88q5-1.5 10 .5M27 91q5-1.5 10 .5M43 88.5q5-2 10-.5M43 91.5q5-2 10-.5" stroke="#b9a878" strokeWidth="0.8" fill="none" strokeLinecap="round" />
    <path className="ns-page" d="M40 86q6-3 14-1v9q-8-3-14 0z" fill="#fff" stroke="#c9b98a" strokeWidth="0.8" strokeLinejoin="round" />
  </g>
);

// Party: confetti pieces falling through the scene.
const CONFETTI = ["#ff5d73", "#ffc933", "#14b8a6", "#7c5cff", "#4fc3ff", "#ff9ab8"];
const Confetti = () => (
  <div className="confetti" aria-hidden="true">
    {Array.from({ length: 18 }, (_, i) => <i key={i} style={{ left: `${(i * 53 + 7) % 96}%`, background: CONFETTI[i % CONFETTI.length], animationDelay: `${-(i * 0.37) % 4}s`, animationDuration: `${2.6 + (i % 5) * 0.5}s`, width: 4 + (i % 3) * 2, height: 7 + (i % 4) * 2 }} />)}
  </div>
);

const istHour = (ms: number) => Number(new Date(ms).toLocaleString("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Kolkata" }));

export default function Companion() {
  const { days: DAYS, ready: planReady } = usePlan();
  const [done, , doneReady] = usePersisted<Record<string, boolean>>(KEYS.done, {});
  const [partyRec, setPartyRec, partyReady] = usePersisted<PartyRec>(KEYS.party, null);
  const [now, setNow] = useState(0); // 0 until the browser has mounted (keeps the first render the same on server and client)
  const [idx, setIdx] = useState(0);
  const [say, setSay] = useState<string | null>(null);
  const [party, setParty] = useState(false); // the hidden finale party (9 seconds)
  const [dizzy, setDizzy] = useState(false);
  const svg = useRef<SVGSVGElement>(null);
  const bubble = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clicks = useRef<number[]>([]);
  const adminRef = useRef(false); // the Admin profile gets its own dialogue, and treats you as the boss

  const buddy = BUDDIES[idx];
  const today = todayIST();
  const day = DAYS.find((d) => d.date === today);
  const allDone = !!day && day.tasks.length > 0 && day.tasks.every((_, i) => done[`${today}:${i}`]);
  const hour = now ? istHour(now) : 12;
  const partyOn = party || partyActive(partyRec, today, now);
  const mood = petMode(hour, buddy.id, partyOn); // "active" | "night" | "sleep" | "party"
  const special = specialOf(hour, buddy.id, mood);
  const moodRef = useRef(mood); moodRef.current = mood;
  const specialRef = useRef(special); specialRef.current = special;
  const idxRef = useRef(idx); idxRef.current = idx;


  const pathname = usePathname();
  const pathRef = useRef(pathname); pathRef.current = pathname;

  const speak = useCallback((t?: string, ms = 5200) => {
    const b = BUDDIES[idxRef.current];
    const a = adminRef.current ? ADMIN_LINES[b.id] : null;
    const m = moodRef.current;
    const line = a
      ? (m === "sleep" ? a.sleep : pick(a.chat))
      : m === "sleep" ? pick(SLEEP_LINES[b.id] ?? [b.sleep])
      : m === "party" ? pick(PARTY_LINES[b.id] ?? ["All done today! Brilliant."])
      : specialRef.current && Math.random() < 0.5 ? pick(SPECIAL_LINES[b.id])
      : m === "night" && Math.random() < 0.6 ? pick(NIGHT_LINES[b.id])
      : pick(b.chat);
    setSay(t ?? line);
    if (bubble.current) clearTimeout(bubble.current);
    bubble.current = setTimeout(() => setSay(null), ms);
  }, []);

  const change = useCallback((to?: number | string) => {
    setIdx((cur) => {
      const target = typeof to === "string" ? BUDDIES.findIndex((b) => b.id === to) : to;
      const n = target !== undefined && target >= 0 ? target : (cur + 1) % BUDDIES.length;
      try { sessionStorage.setItem("gate.buddy", String(n)); } catch { /* ignore */ }
      return n;
    });
    setSay(null);
  }, []);

  useEffect(() => {
    adminRef.current = isAdminProfile();
    setNow(Date.now());
    try { const s = sessionStorage.getItem("gate.buddy"); if (s) setIdx(Number(s) % BUDDIES.length); } catch { /* ignore */ }
  }, []);

  // the clock: re-check the mode every 20 seconds (sleep, night study and the end of a party all depend on it)
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 20_000); return () => clearInterval(t); }, []);

  // party mode starts the moment the last planned task of today gets ticked, and lasts 30 minutes.
  // A day that was already complete when Orbit first looked gets no party, and unticking a task ends it.
  const prevAll = useRef<boolean | null>(null);
  useEffect(() => {
    if (!doneReady || !planReady || !partyReady) return;
    const mine = partyRec?.date === today;
    if (prevAll.current === null) {
      prevAll.current = allDone;
      if (allDone && !mine) setPartyRec({ date: today, at: 0 });
      if (!allDone && mine) setPartyRec(null);
      return;
    }
    if (allDone && !prevAll.current) setPartyRec({ date: today, at: Date.now() });
    if (!allDone && prevAll.current && mine) setPartyRec(null);
    prevAll.current = allDone;
  }, [doneReady, planReady, partyReady, allDone, partyRec, today, setPartyRec]);
  // another buddy (and its backdrop) every few minutes
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) change(); }, ROTATE_MS);
    const manual = (e: Event) => change((e as CustomEvent).detail);
    window.addEventListener("gate-buddy", manual);
    return () => { clearInterval(t); window.removeEventListener("gate-buddy", manual); };
  }, [change]);

  // eyes follow the cursor
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const move = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = svg.current; if (!el) return;
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height * 0.35);
        const k = Math.max(1, Math.hypot(dx, dy) / 90);
        el.style.setProperty("--px", `${Math.max(-3.2, Math.min(3.2, dx / k / 28))}px`);
        el.style.setProperty("--py", `${Math.max(-2.6, Math.min(2.6, dy / k / 34))}px`);
      });
    };
    window.addEventListener("mousemove", move);
    return () => { window.removeEventListener("mousemove", move); cancelAnimationFrame(raf); };
  }, []);

  // chatter, and reactions to the sky show
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden && moodRef.current !== "sleep" && Math.random() < 0.6) speak(); }, 150_000);
    const first = setTimeout(() => { if (!document.hidden && moodRef.current !== "sleep") speak(adminRef.current ? ADMIN_LINES[BUDDIES[idxRef.current].id]?.hello : "Hi! I'm your study buddy. Click me. Click my sky, too."); }, 9000);
    const cosmic = (e: Event) => { const b = BUDDIES[idxRef.current]; const line = adminRef.current ? ADMIN_LINES[b.id]?.react : b.react[(e as CustomEvent).detail as Reaction]; if (line && moodRef.current !== "sleep") setTimeout(() => speak(line), 600); };
    let lastOutcome = 0;
    const outcome = (kind: Outcome) => {
      if (moodRef.current === "sleep") return; // asleep: no comments
      // right/wrong answers get a reaction only now and then; skips and give-ups always do
      if (kind === "right" || kind === "wrong") {
        if (Math.random() > 0.4 || Date.now() - lastOutcome < 15_000) return;
      }
      lastOutcome = Date.now();
      const lines = OUTCOME_LINES[BUDDIES[idxRef.current].id]?.[kind];
      if (lines?.length) speak(pick(lines));
    };
    const onOutcome = (e: Event) => outcome((e as CustomEvent).detail as Outcome);
    const pending = takePending();
    const pendingT = pending ? setTimeout(() => outcome(pending), 1200) : undefined;
    window.addEventListener("gate-outcome", onOutcome);
    // a motivational quote every 20-30 minutes, anywhere except the dashboard (which already shows one).
    // If the moment is wrong (dashboard, hidden tab) it looks again a minute later.
    let quoteT: ReturnType<typeof setTimeout>;
    let pool: number[] = [];
    const gap = () => (20 + Math.random() * 10) * 60_000;
    const schedule = (delay: number) => {
      quoteT = setTimeout(() => {
        if (document.hidden || pathRef.current === "/" || moodRef.current === "sleep") return schedule(60_000);
        const list = adminRef.current ? ADMIN_NOTES : QUOTES;
        if (!pool.length) pool = list.map((_, i) => i);
        const [i] = pool.splice(Math.floor(Math.random() * pool.length), 1);
        speak(list[i], Math.max(7000, 2500 + list[i].length * 70));
        schedule(gap());
      }, delay);
    };
    schedule(gap());
    const finale = () => { setParty(true); speak(adminRef.current ? "Boss found the secret! Cosmic party!" : "You found the secret! Cosmic party!"); setTimeout(() => setParty(false), 9000); };
    window.addEventListener("gate-cosmos", cosmic);
    window.addEventListener("gate-cosmos-phase", cosmic);
    window.addEventListener("gate-finale", finale);
    return () => { clearInterval(t); clearTimeout(first); clearTimeout(pendingT); clearTimeout(quoteT); window.removeEventListener("gate-outcome", onOutcome); window.removeEventListener("gate-cosmos", cosmic); window.removeEventListener("gate-cosmos-phase", cosmic); window.removeEventListener("gate-finale", finale); };
  }, [speak]);

  const onPet = () => {
    const now = Date.now();
    clicks.current = [...clicks.current.filter((t) => now - t < 3000), now];
    if (moodRef.current === "sleep") { speak(); return; } // asleep: only a sleepy line, no matter how many clicks
    if (clicks.current.length >= 5) {
      clicks.current = [];
      setDizzy(true); speak(adminRef.current ? "Whee… Boss, too much spinning…" : "Whee… too much spinning…");
      window.dispatchEvent(new CustomEvent("gate-cosmos-now", { detail: "nebula" }));
      setTimeout(() => setDizzy(false), 2400);
      return;
    }
    speak();
  };

  return (
    <>
    <div className={`rail-stage mode-${mood}`} onClick={(e) => { if (!(e.target as HTMLElement).closest(".pet")) change(); }} title="Click the scene to meet someone else">
      <div className={`sky scene-${buddy.scene}`} key={buddy.id} aria-hidden="true"><SceneArt scene={buddy.scene} />{mood === "party" && <Confetti />}</div>
      <div className={`pet ${mood} ${special ? `sp-${special}` : ""} ${dizzy ? "dizzy" : ""}`} key={`${buddy.id}-pet`}>
        {say && <div className="pet-say" key={say} role="status">{say}</div>}
        <button className="pet-btn" aria-label={`${buddy.name}, your study buddy, ${mood === "sleep" ? "asleep" : mood === "party" ? "partying" : mood === "night" ? "studying at night" : "awake"}. Click for a message`} onClick={onPet}>
          <svg ref={svg} viewBox="0 -14 80 110" className="owl" aria-hidden="true">{buddy.art()}{mood === "night" && <NightStudy />}</svg>
        </button>
      </div>
    </div>
    </>
  );
}
