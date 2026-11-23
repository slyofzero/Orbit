import type { ReactNode } from "react";

export type Scene = "sky" | "lab" | "rain" | "space" | "sea" | "london" | "paris" | "cake";

export type Reaction =
  | "supernova"
  | "nebula"
  | "shooting"
  | "comet"
  | "cluster"
  | "aurora"
  | "saturn"
  | "asteroid"
  | "impact"
  | "rings";

export type PetMode = "active" | "night" | "sleep" | "party";

export type Outcome = "right" | "wrong" | "skip" | "giveup" | "quit" | "progress";

export type PartyRec = { date: string; at: number } | null;

export interface BuddySpecial {
  name: string;
  from: number; // IST hour [from, to)
  to: number;
}

export interface BuddyLines {
  chat: string[];
  sleep: string[];
  night: string[];
  party: string[];
  special: string[];
  outcomes: Record<Outcome, string[]>;
}

export interface Buddy {
  id: string;
  name: string;
  scene: Scene;
  special: BuddySpecial;
  nocturnal?: boolean;
  art: () => ReactNode;
  react: Record<Reaction, string>;
  lines: BuddyLines;
}
