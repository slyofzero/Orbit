"use client";

import { useEffect, useRef } from "react";
import { COSMIC_EVENTS, COSMIC_KINDS } from "@/components/background/cosmos/events";
import { calm, createCosmicContext, rand } from "@/components/background/cosmos/helpers";
import type { CosmicEventKind } from "@/components/background/cosmos/types";
import { supernova } from "@/components/background/cosmos/events/supernova";
import { aurora } from "@/components/background/cosmos/events/aurora";
import { nebula } from "@/components/background/cosmos/events/nebula";
import { cluster } from "@/components/background/cosmos/events/cluster";
import { shooting } from "@/components/background/cosmos/events/shooting";

// Something happens in the sky behind the pages every 15 to 25 minutes (random). Konami code for the finale.
export function Cosmos() {
  const layer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!layer.current) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const ctx = createCosmicContext(layer.current, timers);

    let last: CosmicEventKind | null = null;
    const run = (k?: CosmicEventKind) => {
      if (calm()) return;
      let kind = k;
      if (!kind) {
        do {
          kind = COSMIC_KINDS[Math.floor(Math.random() * COSMIC_KINDS.length)];
        } while (kind === last);
      }
      last = kind;
      COSMIC_EVENTS[kind]?.(ctx);
      window.dispatchEvent(new CustomEvent("gate-cosmos", { detail: kind }));
    };

    // First event after ~25s, then one every 15-25 min
    let t: ReturnType<typeof setTimeout>;
    const loop = (ms: number) => {
      t = setTimeout(() => {
        if (!document.hidden) run();
        loop(rand(15 * 60_000, 25 * 60_000));
      }, ms);
    };
    loop(25_000);

    const manual = (e: Event) => run((e as CustomEvent).detail as CosmicEventKind | undefined);
    window.addEventListener("gate-cosmos-now", manual);

    // Konami code: up up down down left right left right b a
    const code = [
      "ArrowUp",
      "ArrowUp",
      "ArrowDown",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "ArrowLeft",
      "ArrowRight",
      "b",
      "a",
    ];
    let pos = 0;
    const key = (e: KeyboardEvent) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      pos = k === code[pos] ? pos + 1 : k === code[0] ? 1 : 0;
      if (pos === code.length) {
        pos = 0;
        if (calm()) return;
        window.dispatchEvent(new CustomEvent("gate-finale"));
        supernova(ctx, ctx.W() * 0.3, ctx.H() * 0.35);
        ctx.later(() => supernova(ctx, ctx.W() * 0.7, ctx.H() * 0.5), 450);
        ctx.later(() => supernova(ctx, ctx.W() * 0.5, ctx.H() * 0.75), 900);
        aurora(ctx);
        nebula(ctx);
        ctx.later(() => cluster(ctx), 600);
        ctx.later(() => shooting(ctx), 1200);
        ctx.later(() => shooting(ctx), 3000);
      }
    };

    window.addEventListener("keydown", key);

    return () => {
      clearTimeout(t);
      timers.forEach(clearTimeout);
      window.removeEventListener("gate-cosmos-now", manual);
      window.removeEventListener("keydown", key);
    };
  }, []);

  return <div className="cosmos" ref={layer} aria-hidden="true" />;
}
