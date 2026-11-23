// check.ts section: companion. Run: bun run check
import { BUDDIES, getBuddyById } from "@/components/companion/buddies";
import { clockMode, petMode, specialOf, partyActive, PARTY_MS } from "@/components/companion/lib/petMode";
import { ok } from "@/scripts/checks/helpers";
import type { Reaction, Outcome } from "@/components/companion/types";

console.log("companion and cosmos");
{
  const REACTIONS: Reaction[] = [
    "supernova",
    "nebula",
    "shooting",
    "comet",
    "cluster",
    "aurora",
    "saturn",
    "asteroid",
    "impact",
    "rings",
  ];
  const OUTCOMES: Outcome[] = ["right", "wrong", "skip", "giveup", "quit", "progress"];

  ok(new Set(BUDDIES.map((b) => b.id)).size === BUDDIES.length, "buddy ids must be unique");
  ok(BUDDIES.length === 8, "exactly 8 buddies in rotation");

  for (const b of BUDDIES) {
    ok(
      b.name && b.lines.chat.length >= 6 && typeof b.art === "function",
      `buddy ${b.id}: needs a name, at least 6 chat lines and art`,
    );

    for (const r of REACTIONS) {
      ok(Boolean(b.react[r]), `buddy ${b.id}: missing react line "${r}"`);
    }

    for (const o of OUTCOMES) {
      ok((b.lines.outcomes[o]?.length ?? 0) > 0, `buddy ${b.id}: missing outcome lines "${o}"`);
      for (const l of b.lines.outcomes[o]) {
        ok(!/\bGATE\b/.test(l), `buddy ${b.id}: no exam names in outcome "${o}": ${l}`);
      }
    }

    for (const l of [...b.lines.chat, ...Object.values(b.react)]) {
      ok(!/\bGATE\b/.test(l), `buddy ${b.id}: no exam names in buddy lines: ${l}`);
    }

    for (const [name, lines, min] of [
      ["sleep", b.lines.sleep, 3],
      ["night", b.lines.night, 3],
      ["party", b.lines.party, 3],
      ["special", b.lines.special, 3],
    ] as const) {
      ok((lines?.length ?? 0) >= min, `buddy ${b.id}: ${name} needs at least ${min} lines`);
      for (const l of lines ?? []) {
        ok(!/\bGATE\b/.test(l), `buddy ${b.id}: no exam names in ${name}: ${l}`);
      }
    }

    ok(
      b.special && b.special.from !== undefined && b.special.to !== undefined && Boolean(b.special.name),
      `buddy ${b.id}: needs a signature hour in special`,
    );
  }

  const cat = getBuddyById("cat");
  const owl = getBuddyById("owl");

  // The clock schedule: active 9-18, night study 18-24, asleep 0-9; owl reversed in day
  for (const [h, m] of [
    [0, "sleep"],
    [8, "sleep"],
    [9, "active"],
    [17, "active"],
    [18, "night"],
    [23, "night"],
  ] as const) {
    ok(clockMode(h, cat) === m, `clockMode(${h}, cat) = ${m}`);
  }

  for (const [h, m] of [
    [0, "active"],
    [8, "active"],
    [9, "sleep"],
    [17, "sleep"],
    [18, "night"],
    [23, "night"],
  ] as const) {
    ok(clockMode(h, owl) === m, `clockMode(${h}, owl) = ${m}`);
  }

  ok(petMode(3, cat, true) === "party" && petMode(12, owl, true) === "party", "party mode overrides clock");

  for (const b of BUDDIES) {
    ok(clockMode(b.special.from, b) !== "sleep", `signature hour of ${b.id} does not fall while it sleeps`);
  }

  ok(
    specialOf(21, cat, "night") && !specialOf(21, cat, "party") && !specialOf(3, cat, "sleep"),
    "signature hours apply only while awake and not partying",
  );

  const t0 = Date.parse("2026-11-20T10:00:00Z");
  ok(
    partyActive({ date: "2026-11-20", at: t0 }, "2026-11-20", t0 + PARTY_MS - 1000) &&
      !partyActive({ date: "2026-11-20", at: t0 }, "2026-11-20", t0 + PARTY_MS + 1000),
    "a party lasts exactly 15 minutes",
  );

  ok(
    !partyActive({ date: "2026-11-20", at: 0 }, "2026-11-20", t0) &&
      !partyActive({ date: "2026-11-19", at: t0 }, "2026-11-20", t0 + 1000) &&
      !partyActive(null, "2026-11-20", t0),
    "no party for already complete day, yesterday, or null",
  );
}
