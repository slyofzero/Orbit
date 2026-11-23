"use client";

import { useEffect } from "react";
import { atom, useAtom } from "jotai";

export type SceneName = "none" | "welcome" | "practiceTopics" | "practiceProgramming" | "practiceMocks";

export const sceneAtom = atom<SceneName>("none");

/**
 * Global hook to read or set the active backdrop scene.
 * If called with a scene name, mounts that scene while the caller is active,
 * and resets back to "none" on unmount.
 */
export function useScene(name?: SceneName) {
  const [scene, setScene] = useAtom(sceneAtom);

  useEffect(() => {
    if (!name) return;
    setScene(name);
    return () => setScene("none");
  }, [name, setScene]);

  return { scene, setScene };
}
