"use client";
import { useEffect, useState } from "react";
import { applyTheme, readTheme, type ThemeChoice } from "@/lib/theme";
import { Segmented } from "./Segmented";
import { IconMonitor, IconMoon, IconSun } from "./icons";

export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>("system");
  useEffect(() => setChoice(readTheme()), []);
  const pick = (c: ThemeChoice) => { setChoice(c); applyTheme(c); };
  return (
    <Segmented label="Theme" value={choice} onChange={pick} segments={[
      { value: "light", label: "Light", icon: <IconSun /> },
      { value: "system", label: "System", icon: <IconMonitor /> },
      { value: "dark", label: "Dark", icon: <IconMoon /> },
    ]} />
  );
}
