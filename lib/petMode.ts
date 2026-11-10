// The study buddies' modes. Pure functions, so the schedule is easy to test and to change.
//
// Clock modes (India time):
//   active  09:00 - 18:00   lively animations, chatty
//   night   18:00 - 24:00   "night study" (book, lamp), chatty
//   sleep   00:00 - 09:00   asleep and silent; a click only gets a sleepy line
// The owl keeps the opposite schedule in the daytime: it sleeps 09:00 - 18:00 and is awake the rest of the day.
// Party mode (all of today's planned tasks ticked, for 15 minutes) beats every other mode.
// Every buddy also has one "signature" hour (see SPECIALS) that adds extra flair on top of the clock mode.

export type PetMode = "active" | "night" | "sleep" | "party";

export const DAY_FROM = 9;     // active mode starts
export const NIGHT_FROM = 18;  // night-study mode starts; it runs until midnight
export const PARTY_MS = 15 * 60 * 1000;

export const clockMode = (hour: number, buddyId: string): Exclude<PetMode, "party"> => {
  const day = hour >= DAY_FROM && hour < NIGHT_FROM;
  if (buddyId === "owl") return day ? "sleep" : hour >= NIGHT_FROM ? "night" : "active";
  return day ? "active" : hour >= NIGHT_FROM ? "night" : "sleep";
};

export const petMode = (hour: number, buddyId: string, partyOn: boolean): PetMode => (partyOn ? "party" : clockMode(hour, buddyId));

/** One signature hour per buddy: [from, to) in India time. Only applies while the buddy is awake and not partying. */
export const SPECIALS: Record<string, { from: number; to: number; name: string }> = {
  owl: { from: 0, to: 3, name: "Midnight hunt" },
  robot: { from: 13, to: 14, name: "Overclock" },
  cat: { from: 21, to: 22, name: "Zoomies" },
  astro: { from: 11, to: 12, name: "Spacewalk" },
  jelly: { from: 20, to: 21, name: "Glow hour" },
  tea: { from: 16, to: 17, name: "Tea time" },
  rex: { from: 10, to: 11, name: "Rampage" },
  ghost: { from: 23, to: 24, name: "Witching hour" },
};

export const specialOf = (hour: number, buddyId: string, mode: PetMode): string | null => {
  const s = SPECIALS[buddyId];
  if (!s || (mode !== "active" && mode !== "night")) return null;
  return hour >= s.from && hour < s.to ? buddyId : null;
};

/** The party record: when today's last planned task was ticked (`at` is 0 when it was already complete before Orbit saw it, so no party). */
export type PartyRec = { date: string; at: number } | null;
export const partyActive = (rec: PartyRec, today: string, now: number): boolean => !!rec && rec.date === today && rec.at > 0 && now - rec.at < PARTY_MS;
