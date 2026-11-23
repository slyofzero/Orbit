"use client";
// The app's ever-present background layer: pinned to the viewport (it doesn't scroll with the page) behind
// every app page, mounted once in app/(app)/layout.tsx so it survives page changes.
// A page picks what it shows with `useScene("welcome")`; pages that don't ask get "none" (empty).
// A scene fades in; when the page leaves it fades out and is then removed (its animation stops).

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { OrbitScene } from "@/components/background/OrbitScene";
import type { PracticeTab } from "@/lib/practice";
import { PracticeScene } from "@/components/background/PracticeScene";
import { AmbientCanvas } from "@/components/background/ambient/AmbientCanvas";
import { CosmicCanvas } from "@/components/background/cosmos/CosmicCanvas";

/** How long a scene takes to fade in or out (ms). */
const FADE_MS = 1000;

function PracticeBackdrop({ kind }: { kind: PracticeTab }) {
  return (
    <>
      <PracticeScene kind={kind} className="absolute inset-0 size-full" />
      <div className="absolute inset-0 bg-linear-to-r from-pad via-pad/85 to-pad/10 max-[900px]:bg-pad/80" />
    </>
  );
}

/** What the backdrop can show. Add a scene here, then call `useScene(name)` in the page that wants it. */
const SCENES = {
  /** Nothing: the plain page background. */
  none: null,
  /** The no-plan welcome: the solar system, sun high on the right, the text side (left) washed out. */
  welcome: (
    <>
      <OrbitScene className="absolute inset-0 size-full" sunX={0.78} sunY={0.32} />
      <div className="absolute inset-0 bg-linear-to-r from-pad via-pad/85 to-pad/10 max-[900px]:bg-pad/80" />
    </>
  ),
  /** Practice onboarding, one per tab (components/background/PracticeScene.tsx); the text side is washed out too. */
  practiceTopics: <PracticeBackdrop kind="topics" />,
  practiceProgramming: <PracticeBackdrop kind="programming" />,
  practiceMocks: <PracticeBackdrop kind="mocks" />,
} satisfies Record<string, ReactNode>;

export type SceneName = keyof typeof SCENES;
const DEFAULT: SceneName = "none";

const SceneContext = createContext<(name: SceneName) => void>(() => {});

/** Show `name` on the backdrop while the calling page is on screen (back to "none" when it leaves). */
export function useScene(name: SceneName) {
  const set = useContext(SceneContext);
  useEffect(() => {
    set(name);
    return () => set(DEFAULT);
  }, [name, set]);
}

export function Backdrop({ children }: { children: ReactNode }) {
  const [name, setName] = useState<SceneName>(DEFAULT);
  const [shown, setShown] = useState<SceneName>(DEFAULT); // what is drawn (lags behind while fading out)
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (name === shown) {
      // mounted (or back to it mid-fade): fade in on the next frame, so the browser sees opacity 0 first
      let raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(() => setVisible(SCENES[name] !== null));
      });
      return () => cancelAnimationFrame(raf);
    }
    // a different scene: fade the current one out, then swap
    setVisible(false);
    const t = setTimeout(() => setShown(name), SCENES[shown] === null ? 0 : FADE_MS);
    return () => clearTimeout(t);
  }, [name, shown]);

  return (
    <SceneContext.Provider value={setName}>
      {/* 1. Bottom canvas: subtle ambient background (floating Greek alphabets & math characters) */}
      <AmbientCanvas />
      {/* 2. Top canvas: dedicated exclusively for Cosmic Events animations */}
      <CosmicCanvas />
      {/* 3. Page-specific backdrop scene overlay (welcome, practice onboarding, etc.) */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden transition-opacity ease-out"
        style={{ opacity: visible ? 1 : 0, transitionDuration: `${FADE_MS}ms` }}
      >
        {SCENES[shown]}
      </div>
      {/* 4. Page elements sit in front */}
      {children}
    </SceneContext.Provider>
  );
}
