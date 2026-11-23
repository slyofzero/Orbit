"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { BUDDIES } from "@/components/companion/buddies";
import { SceneArt } from "@/components/companion/scenes/SceneArt";
import { Confetti } from "@/components/companion/scenes/Confetti";
import { NightStudy } from "@/components/companion/buddies/extras";
import { petMode, specialOf, partyActive } from "@/components/companion/lib/petMode";
import { takePending } from "@/components/companion/lib/outcome";
import type { Reaction, PetMode, PartyRec, Outcome } from "@/components/companion/types";
import { QUOTES } from "@/lib/quotes";
import { todayIST } from "@/lib/dates";
import { useQuery } from "@/lib/db/client";

const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const ROTATE_MS = 5 * 60 * 1000;
const STORAGE_KEY = "orbit.buddy";

const istHour = (ms: number) =>
  Number(
    new Date(ms).toLocaleString("en-GB", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: "Asia/Kolkata",
    }),
  );

export function Companion({ forcedBuddyId, forcedMode }: { forcedBuddyId?: string; forcedMode?: string }) {
  const [now, setNow] = useState(0);
  const [idx, setIdx] = useState(0);
  const [say, setSay] = useState<string | null>(null);
  const [party, setParty] = useState(false);
  const [dizzy, setDizzy] = useState(false);
  const [partyRec, setPartyRec] = useState<PartyRec>(null);

  const svg = useRef<SVGSVGElement>(null);
  const bubble = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clicks = useRef<number[]>([]);
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  const today = todayIST();
  const { data: heroData } = useQuery("dashboard.hero", { today });

  // Today's day is done if today's planned tasks are all finished
  const allDone = Boolean(
    heroData?.todayTasks && heroData.todayTasks.total > 0 && heroData.todayTasks.done === heroData.todayTasks.total,
  );

  const buddy = forcedBuddyId ? (BUDDIES.find((b) => b.id === forcedBuddyId) ?? BUDDIES[idx]) : BUDDIES[idx];
  const hour = now ? istHour(now) : 12;
  const partyOn = party || partyActive(partyRec, today, now);
  const autoMood = petMode(hour, buddy, partyOn);
  const mood = (forcedMode as PetMode | undefined) ?? autoMood;
  const special = specialOf(hour, buddy, mood);

  const moodRef = useRef(mood);
  moodRef.current = mood;
  const specialRef = useRef(special);
  specialRef.current = special;
  const idxRef = useRef(idx);
  idxRef.current = idx;

  const speak = useCallback((t?: string, ms = 5200) => {
    const b = BUDDIES[idxRef.current];
    const m = moodRef.current;
    const line =
      m === "sleep"
        ? pick(b.lines.sleep)
        : m === "party"
          ? pick(b.lines.party)
          : specialRef.current && Math.random() < 0.5
            ? pick(b.lines.special)
            : m === "night" && Math.random() < 0.6
              ? pick(b.lines.night)
              : pick(b.lines.chat);
    setSay(t ?? line);
    if (bubble.current) clearTimeout(bubble.current);
    bubble.current = setTimeout(() => setSay(null), ms);
  }, []);

  const change = useCallback((to?: number | string) => {
    setIdx((cur) => {
      const target = typeof to === "string" ? BUDDIES.findIndex((b) => b.id === to) : to;
      const n = target !== undefined && target >= 0 ? target : (cur + 1) % BUDDIES.length;
      try {
        sessionStorage.setItem(STORAGE_KEY, String(n));
      } catch {}
      return n;
    });
    setSay(null);
  }, []);

  useEffect(() => {
    setNow(Date.now());
    try {
      const s = sessionStorage.getItem(STORAGE_KEY);
      if (s) setIdx(Number(s) % BUDDIES.length);
    } catch {}
  }, []);

  // Clock tick every 20s
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(t);
  }, []);

  // Party mode starts when all tasks done today
  const prevAll = useRef<boolean | null>(null);
  useEffect(() => {
    if (prevAll.current === null) {
      prevAll.current = allDone;
      if (allDone) setPartyRec({ date: today, at: 0 });
      return;
    }
    if (allDone && !prevAll.current) setPartyRec({ date: today, at: Date.now() });
    if (!allDone && prevAll.current) setPartyRec(null);
    prevAll.current = allDone;
  }, [allDone, today]);

  // Rotate buddy
  useEffect(() => {
    const t = setInterval(() => {
      if (!document.hidden) change();
    }, ROTATE_MS);
    const manual = (e: Event) => change((e as CustomEvent).detail);
    window.addEventListener("gate-buddy", manual);
    return () => {
      clearInterval(t);
      window.removeEventListener("gate-buddy", manual);
    };
  }, [change]);

  // Eyes follow mouse
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const move = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = svg.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height * 0.35);
        const k = Math.max(1, Math.hypot(dx, dy) / 90);
        el.style.setProperty("--px", `${Math.max(-3.2, Math.min(3.2, dx / k / 28))}px`);
        el.style.setProperty("--py", `${Math.max(-2.6, Math.min(2.6, dy / k / 34))}px`);
      });
    };
    window.addEventListener("mousemove", move);
    return () => {
      window.removeEventListener("mousemove", move);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Periodic chatter & reactions
  useEffect(() => {
    const t = setInterval(() => {
      if (!document.hidden && moodRef.current !== "sleep" && Math.random() < 0.6) speak();
    }, 150_000);

    const first = setTimeout(() => {
      if (!document.hidden && moodRef.current !== "sleep") {
        speak("Hi! I'm your study buddy. Click me. Click my sky, too.");
      }
    }, 9000);

    const cosmic = (e: Event) => {
      const b = BUDDIES[idxRef.current];
      const line = b.react[(e as CustomEvent).detail as Reaction];
      if (line && moodRef.current !== "sleep") setTimeout(() => speak(line), 600);
    };

    let lastOutcome = 0;
    const outcome = (kind: Outcome) => {
      if (moodRef.current === "sleep") return;
      if (kind === "right" || kind === "wrong") {
        if (Math.random() > 0.4 || Date.now() - lastOutcome < 15_000) return;
      }
      lastOutcome = Date.now();
      const lines = BUDDIES[idxRef.current].lines.outcomes[kind];
      if (lines?.length) speak(pick(lines));
    };

    const onOutcome = (e: Event) => outcome((e as CustomEvent).detail as Outcome);
    const pending = takePending();
    const pendingT = pending ? setTimeout(() => outcome(pending), 1200) : undefined;
    window.addEventListener("gate-outcome", onOutcome);

    let quoteT: ReturnType<typeof setTimeout>;
    let pool: number[] = [];
    const schedule = (delay: number) => {
      quoteT = setTimeout(() => {
        if (document.hidden || pathRef.current === "/dashboard" || moodRef.current === "sleep") {
          return schedule(60_000);
        }
        if (!pool.length) pool = QUOTES.map((_, i) => i);
        const [i] = pool.splice(Math.floor(Math.random() * pool.length), 1);
        speak(QUOTES[i], Math.max(7000, 2500 + QUOTES[i].length * 70));
        schedule((20 + Math.random() * 10) * 60_000);
      }, delay);
    };
    schedule((20 + Math.random() * 10) * 60_000);

    const finale = () => {
      setParty(true);
      speak("You found the secret! Cosmic party!");
      setTimeout(() => setParty(false), 9000);
    };

    window.addEventListener("gate-cosmos", cosmic);
    window.addEventListener("gate-cosmos-phase", cosmic);
    window.addEventListener("gate-finale", finale);

    return () => {
      clearInterval(t);
      clearTimeout(first);
      clearTimeout(pendingT);
      clearTimeout(quoteT);
      window.removeEventListener("gate-outcome", onOutcome);
      window.removeEventListener("gate-cosmos", cosmic);
      window.removeEventListener("gate-cosmos-phase", cosmic);
      window.removeEventListener("gate-finale", finale);
    };
  }, [speak]);

  const onPet = () => {
    const curTime = Date.now();
    clicks.current = [...clicks.current.filter((t) => curTime - t < 3000), curTime];
    if (moodRef.current === "sleep") {
      speak();
      return;
    }
    if (clicks.current.length >= 5) {
      clicks.current = [];
      setDizzy(true);
      speak("Whee… too much spinning…");
      window.dispatchEvent(new CustomEvent("gate-cosmos-now", { detail: "nebula" }));
      setTimeout(() => setDizzy(false), 2400);
      return;
    }
    speak();
  };

  return (
    <div
      className={`rail-stage mode-${mood}`}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest(".pet")) change();
      }}
      title="Click the scene to meet someone else"
    >
      <div className={`sky scene-${buddy.scene}`} key={buddy.id} aria-hidden="true">
        <SceneArt scene={buddy.scene} />
        {mood === "party" && <Confetti />}
      </div>
      <div className={`pet ${mood} ${special ? `sp-${buddy.id}` : ""} ${dizzy ? "dizzy" : ""}`} key={`${buddy.id}-pet`}>
        {say && (
          <div className="pet-say" key={say} role="status">
            {say}
          </div>
        )}
        <button
          className="pet-btn"
          aria-label={`${buddy.name}, your study buddy, ${
            mood === "sleep"
              ? "asleep"
              : mood === "party"
                ? "partying"
                : mood === "night"
                  ? "studying at night"
                  : "awake"
          }. Click for a message`}
          onClick={onPet}
        >
          <svg ref={svg} viewBox="0 -14 80 110" className="owl" aria-hidden="true">
            {buddy.art()}
            {mood === "night" && <NightStudy />}
          </svg>
        </button>
      </div>
    </div>
  );
}
