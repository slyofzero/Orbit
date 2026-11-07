"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { QUOTES } from "@/lib/quotes";
import { todayIST } from "@/lib/plan";
import { KEYS, usePersisted, usePlan } from "@/lib/store";
import { BUDDIES, type Reaction } from "./mascots";
import { OUTCOME_LINES } from "./outcomes";
import { takePending, type Outcome } from "@/lib/outcome";

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

export default function Companion() {
  const { days: DAYS } = usePlan();
  const [done] = usePersisted<Record<string, boolean>>(KEYS.done, {});
  const [idx, setIdx] = useState(0);
  const [say, setSay] = useState<string | null>(null);
  const [hour, setHour] = useState(12);
  const [party, setParty] = useState(false);
  const [dizzy, setDizzy] = useState(false);
  const svg = useRef<SVGSVGElement>(null);
  const bubble = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clicks = useRef<number[]>([]);

  const buddy = BUDDIES[idx];
  const today = todayIST();
  const day = DAYS.find((d) => d.date === today);
  const allDone = !!day && day.tasks.length > 0 && day.tasks.every((_, i) => done[`${today}:${i}`]);
  const mood = hour < 5 ? "sleep" : allDone || party ? "party" : "awake";
  const moodRef = useRef(mood); moodRef.current = mood;
  const idxRef = useRef(idx); idxRef.current = idx;

  const pathname = usePathname();
  const pathRef = useRef(pathname); pathRef.current = pathname;

  const speak = useCallback((t?: string, ms = 5200) => {
    const b = BUDDIES[idxRef.current];
    setSay(t ?? (moodRef.current === "sleep" ? b.sleep : moodRef.current === "party" ? pick(["All done today! Brilliant.", "Day complete. Go rest, champion.", "Look at you, ticking everything!"]) : pick(b.chat)));
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
    setHour(Number(new Date().toLocaleString("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" })));
    try { const s = sessionStorage.getItem("gate.buddy"); if (s) setIdx(Number(s) % BUDDIES.length); } catch { /* ignore */ }
  }, []);

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
    const t = setInterval(() => { if (!document.hidden && Math.random() < 0.6) speak(); }, 150_000);
    const first = setTimeout(() => { if (!document.hidden) speak("Hi! I'm your study buddy. Click me. Click my sky, too."); }, 9000);
    const cosmic = (e: Event) => { const line = BUDDIES[idxRef.current].react[(e as CustomEvent).detail as Reaction]; if (line) setTimeout(() => speak(line), 600); };
    let lastOutcome = 0;
    const outcome = (kind: Outcome) => {
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
        if (document.hidden || pathRef.current === "/") return schedule(60_000);
        if (!pool.length) pool = QUOTES.map((_, i) => i);
        const [i] = pool.splice(Math.floor(Math.random() * pool.length), 1);
        speak(QUOTES[i], Math.max(7000, 2500 + QUOTES[i].length * 70));
        schedule(gap());
      }, delay);
    };
    schedule(gap());
    const finale = () => { setParty(true); speak("You found the secret! Cosmic party!"); setTimeout(() => setParty(false), 9000); };
    window.addEventListener("gate-cosmos", cosmic);
    window.addEventListener("gate-cosmos-phase", cosmic);
    window.addEventListener("gate-finale", finale);
    return () => { clearInterval(t); clearTimeout(first); clearTimeout(pendingT); clearTimeout(quoteT); window.removeEventListener("gate-outcome", onOutcome); window.removeEventListener("gate-cosmos", cosmic); window.removeEventListener("gate-cosmos-phase", cosmic); window.removeEventListener("gate-finale", finale); };
  }, [speak]);

  const onPet = () => {
    const now = Date.now();
    clicks.current = [...clicks.current.filter((t) => now - t < 3000), now];
    if (clicks.current.length >= 5) {
      clicks.current = [];
      setDizzy(true); speak("Whee… too much spinning…");
      window.dispatchEvent(new CustomEvent("gate-cosmos-now", { detail: "nebula" }));
      setTimeout(() => setDizzy(false), 2400);
      return;
    }
    speak();
  };

  return (
    <>
    <div className="rail-stage" onClick={(e) => { if (!(e.target as HTMLElement).closest(".pet")) change(); }} title="Click the scene to meet someone else">
      <div className={`sky scene-${buddy.scene}`} key={buddy.id} aria-hidden="true"><SceneArt scene={buddy.scene} /></div>
      <div className={`pet ${mood} ${dizzy ? "dizzy" : ""}`} key={`${buddy.id}-pet`}>
        {say && <div className="pet-say" key={say} role="status">{say}</div>}
        <button className="pet-btn" aria-label={`${buddy.name}, your study buddy. Click for a message`} onClick={onPet}>
          <svg ref={svg} viewBox="0 -14 80 110" className="owl" aria-hidden="true">{buddy.art()}</svg>
        </button>
      </div>
    </div>
    </>
  );
}
