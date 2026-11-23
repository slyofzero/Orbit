// The study buddies' modes. Pure functions without hardcoded character data.
//
// Clock modes (India time):
//   active  09:00 - 18:00   lively animations, chatty
//   night   18:00 - 24:00   "night study" (book, lamp), chatty
//   sleep   00:00 - 09:00   asleep and silent; a click only gets a sleepy line
// Nocturnal buddies (like the owl) sleep during daytime (09:00 - 18:00) and are awake at night.
// Party mode (all of today's planned tasks ticked, for 15 minutes) beats every other mode.
// Each buddy specifies its own signature hour via its `special` property.

import type { PetMode, PartyRec, Buddy } from "@/components/companion/types";

export const DAY_FROM = 9; // active mode starts
export const NIGHT_FROM = 18; // night-study mode starts; it runs until midnight
export const PARTY_MS = 15 * 60 * 1000;

export const clockMode = (hour: number, buddyOrNocturnal?: Buddy | boolean): Exclude<PetMode, "party"> => {
  const nocturnal = typeof buddyOrNocturnal === "boolean" ? buddyOrNocturnal : !!buddyOrNocturnal?.nocturnal;
  const day = hour >= DAY_FROM && hour < NIGHT_FROM;
  if (nocturnal) return day ? "sleep" : hour >= NIGHT_FROM ? "night" : "active";
  return day ? "active" : hour >= NIGHT_FROM ? "night" : "sleep";
};

export const petMode = (hour: number, buddyOrNocturnal: Buddy | boolean, partyOn: boolean): PetMode =>
  partyOn ? "party" : clockMode(hour, buddyOrNocturnal);

export const specialOf = (hour: number, buddy: Buddy, mode: PetMode): boolean => {
  if (mode !== "active" && mode !== "night") return false;
  return hour >= buddy.special.from && hour < buddy.special.to;
};

/** The party record: when today's last planned task was ticked (`at` is 0 when it was already complete before Orbit saw it, so no party). */
export const partyActive = (rec: PartyRec, today: string, now: number): boolean =>
  !!rec && rec.date === today && rec.at > 0 && now - rec.at < PARTY_MS;
