"use client";
// The admin screens read and write other profiles' saved data directly (same browser storage, other profile's keys).
import { Profile, listProfiles, scope } from "./profiles";
import { KEYS } from "./store";
import { Loc, PackData, allQuestions } from "./packs";
import { searchIds } from "./packEdit";
import { PlanData } from "./plan";

export function readKey<T>(profile: string, key: string): T | null {
  try { const s = localStorage.getItem(scope(key, profile)); return s ? (JSON.parse(s) as T) : null; } catch { return null; }
}
export function writeKey(profile: string, key: string, value: unknown | null) {
  if (value === null) localStorage.removeItem(scope(key, profile));
  else localStorage.setItem(scope(key, profile), JSON.stringify(value));
}

export const readPack = (profile: string): PackData | null => {
  const p = readKey<PackData>(profile, KEYS.pack);
  return p ? { ...p, mockTests: p.mockTests ?? [], mocks: p.mocks ?? [] } : null;
};
export const writePack = (profile: string, pack: PackData | null) => writeKey(profile, KEYS.pack, pack);
export const readPlan = (profile: string) => readKey<PlanData>(profile, KEYS.plan);

export interface ProfileSummary { profile: Profile; planName: string | null; planDays: number; packName: string | null; practice: number; mockTests: number; mockQuestions: number; topics: number }
export function summaries(): ProfileSummary[] {
  return listProfiles().filter((p) => !p.admin).map((profile) => {
    const pack = readPack(profile.id), plan = readPlan(profile.id);
    return {
      profile, planName: plan?.name ?? null, planDays: plan?.days.length ?? 0, packName: pack?.name ?? null,
      practice: pack?.questions.length ?? 0, mockTests: pack?.mockTests.length ?? 0,
      mockQuestions: pack ? allQuestions(pack).filter((l) => l.bank === "mock").length : 0, topics: pack?.topics.length ?? 0,
    };
  });
}

/** Looks an id up in every profile. */
export function findAcross(needle: string): { profile: Profile; loc: Loc }[] {
  const out: { profile: Profile; loc: Loc }[] = [];
  for (const profile of listProfiles().filter((p) => !p.admin)) {
    const pack = readPack(profile.id);
    if (pack) for (const loc of searchIds(pack, needle, 20)) out.push({ profile, loc });
  }
  return out.slice(0, 60);
}
