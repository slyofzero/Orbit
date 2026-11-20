// The plan file Orbit imports ("orbit-plan", version 1): what an AI chat writes for the user and the
// import screen reads. It maps straight onto the plan tables (types/tables/plans/):
//
//   { "format": "orbit-plan", "version": 1, "name": "…", "description": "…",
//     "starts_on": "YYYY-MM-DD", "ends_on": "YYYY-MM-DD",            (optional: first / last day)
//     "milestones": [{ "name": "…", "short": "…", "date": "YYYY-MM-DD", "note": "…" }],
//     "days": [
//       { "date": "YYYY-MM-DD", "title": "…", "kind": "study", "hours": 2, "note": "…",
//         "tasks": ["…"], "questions": ["question id", …] },
//       { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD", "weekdays": ["mon", …], "title": "…", … } ] }
//
// Ranges keep files short. A single "date" beats any range; a later range beats an earlier one.
// Validation refuses with plain-English errors (AGENTS.md rule 5): nothing half-checked is saved.
// The AI prompt that describes this format is lib/prompts/planPrompt.ts: change both together.

import { addDays, daysBetween, isIsoDate, weekday, type IsoDate } from "@/lib/dates";
import type { PlanDayKind } from "@/types/tables";

export const PLAN_FORMAT = "orbit-plan";
export const PLAN_VERSION = 1;
export const DAY_KINDS: readonly PlanDayKind[] = ["study", "light", "mock", "crunch", "buffer", "exam", "taper"];
export const WEEKDAY_NAMES = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const; // lib/dates weekday(): 0 = Monday
export const LIMITS = {
  days: 731, // two years
  tasks: 20, // per day
  milestones: 50,
  questions: 200, // linked per day
  name: 80,
  description: 1500,
  title: 120,
  task: 300,
  note: 1000,
  milestoneName: 60,
  milestoneShort: 16,
  milestoneNote: 200,
} as const;
const MAX_ERRORS = 12;

export interface PlanFileDay {
  date: IsoDate;
  title: string;
  kind: PlanDayKind;
  hours: number | null;
  note: string | null;
  tasks: string[];
  questions: string[]; // question ids from the user's packs
}
export interface PlanFileMilestone {
  name: string;
  short: string | null;
  date: IsoDate;
  note: string | null;
}
export interface PlanFile {
  name: string;
  description: string | null;
  starts_on: IsoDate;
  ends_on: IsoDate;
  milestones: PlanFileMilestone[];
  days: PlanFileDay[]; // one per date, in date order
}
export interface PlanParse {
  plan: PlanFile | null; // null = refused; see errors
  errors: string[];
  warnings: string[];
}

/** JSON turns "\frac" into a form feed + "rac", "\times" into a tab + "imes"… Put those backslashes back. */
export function repairBackslashes(s: string): { text: string; fixed: number } {
  let fixed = 0;
  const text = s.replace(/[\f\b\v]|[\t\r](?=[a-zA-Z])/g, (c) => {
    fixed++;
    return { "\f": "\\f", "\b": "\\b", "\v": "\\v", "\t": "\\t", "\r": "\\r" }[c]!;
  });
  return { text, fixed };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Reads a plan file (its text, or already-parsed JSON) and checks every rule. */
export function parsePlanFile(input: unknown): PlanParse {
  const errors: string[] = [];
  const warnings: string[] = [];
  const err = (m: string) => {
    if (errors.length < MAX_ERRORS) errors.push(m);
    else if (errors.length === MAX_ERRORS) errors.push("…and more. Fix these first.");
  };
  const refused = (): PlanParse => ({ plan: null, errors, warnings });

  // ----- text → JSON (AI chats often wrap the file in ``` fences) -----
  let data = input;
  if (typeof input === "string") {
    const text = input
      .trim()
      .replace(/^```(?:json)?\s*\n?/i, "")
      .replace(/\n?```\s*$/, "");
    try {
      data = JSON.parse(text);
    } catch (e) {
      err(
        `This isn't valid JSON (${e instanceof Error ? e.message : String(e)}). Ask the AI for "only the JSON, with every backslash doubled (\\\\frac, not \\frac)".`,
      );
      return refused();
    }
  }
  if (!isObj(data)) {
    err('The file must be one JSON object: { "format": "orbit-plan", "name": …, "days": […] }.');
    return refused();
  }
  const o = data;

  let fixedSlashes = 0;
  const text = (v: unknown, max: number): string => {
    const r = repairBackslashes(String(v).trim());
    fixedSlashes += r.fixed;
    return r.text.slice(0, max);
  };
  const optText = (v: unknown, where: string, max: number): string | null => {
    if (v === undefined || v === null || v === "") return null;
    if (typeof v !== "string") {
      err(`${where} must be text.`);
      return null;
    }
    if (v.trim().length > max) warnings.push(`${where} was longer than ${max} characters, so it was cut.`);
    return text(v, max) || null;
  };

  // ----- header -----
  if (o.format === undefined)
    warnings.push('"format": "orbit-plan" is missing; the file was read as an Orbit plan anyway.');
  else if (o.format !== PLAN_FORMAT) err(`"format" must be "${PLAN_FORMAT}" (this file says "${String(o.format)}").`);
  if (o.version !== undefined && o.version !== PLAN_VERSION)
    err(`"version" ${String(o.version)} isn't supported; this Orbit reads version ${PLAN_VERSION}.`);
  if (typeof o.name !== "string" || !o.name.trim())
    err('The plan needs a "name", e.g. "name": "Spring semester plan".');
  const name = typeof o.name === "string" ? text(o.name, LIMITS.name) : "";
  const description = optText(o.description, '"description"', LIMITS.description);
  for (const key of ["starts_on", "ends_on"] as const)
    if (o[key] !== undefined && (typeof o[key] !== "string" || !isIsoDate(o[key] as string)))
      err(`"${key}" "${String(o[key])}" is not a real date (use YYYY-MM-DD).`);

  // ----- days -----
  if (!Array.isArray(o.days) || o.days.length === 0) {
    err('"days" must be a list with at least one day.');
    return refused();
  }
  const built = new Map<IsoDate, { day: PlanFileDay; single: boolean }>();
  o.days.forEach((raw, i) => {
    const w = `days[${i}]`;
    if (!isObj(raw)) return err(`${w} must be an object.`);
    const single = raw.date !== undefined;
    const ranged = raw.from !== undefined || raw.to !== undefined;
    if (single === ranged) return err(`${w} needs either "date", or both "from" and "to".`);
    if (single && (typeof raw.date !== "string" || !isIsoDate(raw.date)))
      return err(`${w}.date "${String(raw.date)}" is not a real date (use YYYY-MM-DD).`);
    if (
      ranged &&
      !(typeof raw.from === "string" && isIsoDate(raw.from) && typeof raw.to === "string" && isIsoDate(raw.to))
    )
      return err(`${w}: "from" and "to" must both be real dates (YYYY-MM-DD).`);
    if (ranged && (raw.to as string) < (raw.from as string)) return err(`${w}: "to" is before "from".`);
    if (typeof raw.title !== "string" || !raw.title.trim()) return err(`${w} needs a "title".`);
    const kind = (raw.kind ?? "study") as PlanDayKind;
    if (!DAY_KINDS.includes(kind))
      return err(`${w}.kind "${String(raw.kind)}" must be one of: ${DAY_KINDS.join(", ")}.`);
    let hours: number | null = null;
    if (raw.hours !== undefined && raw.hours !== null) {
      if (typeof raw.hours !== "number" || !isFinite(raw.hours) || raw.hours < 0 || raw.hours > 24)
        return err(`${w}.hours must be a number from 0 to 24.`);
      hours = raw.hours;
    }
    let tasks: string[] = [];
    if (raw.tasks !== undefined) {
      if (!Array.isArray(raw.tasks) || raw.tasks.some((t) => typeof t !== "string" || !t.trim()))
        return err(`${w}.tasks must be a list of non-empty texts.`);
      if (raw.tasks.length > LIMITS.tasks)
        return err(`${w} has ${raw.tasks.length} tasks; the most is ${LIMITS.tasks}.`);
      tasks = (raw.tasks as string[]).map((t) => text(t, LIMITS.task));
    }
    let questions: string[] = [];
    if (raw.questions !== undefined) {
      if (!Array.isArray(raw.questions) || raw.questions.some((q) => typeof q !== "string" || !q.trim()))
        return err(`${w}.questions must be a list of question ids (texts).`);
      if (raw.questions.length > LIMITS.questions)
        return err(`${w} links ${raw.questions.length} questions; the most is ${LIMITS.questions}.`);
      questions = [...new Set((raw.questions as string[]).map((q) => q.trim()))];
    }
    let weekdays: number[] | null = null;
    if (raw.weekdays !== undefined) {
      if (!ranged) return err(`${w}: "weekdays" only works together with "from" and "to".`);
      if (
        !Array.isArray(raw.weekdays) ||
        raw.weekdays.length === 0 ||
        raw.weekdays.some(
          (d) => typeof d !== "string" || !(WEEKDAY_NAMES as readonly string[]).includes(d.toLowerCase()),
        )
      )
        return err(`${w}.weekdays must be a list of: ${WEEKDAY_NAMES.join(", ")}.`);
      weekdays = (raw.weekdays as string[]).map((d) => (WEEKDAY_NAMES as readonly string[]).indexOf(d.toLowerCase()));
    }
    const note = optText(raw.note, `${w}.note`, LIMITS.note);
    const title = text(raw.title, LIMITS.title);

    const dates: IsoDate[] = single
      ? [raw.date as string]
      : (() => {
          const n = daysBetween(raw.from as string, raw.to as string) + 1;
          if (n > LIMITS.days) return [];
          return Array.from({ length: n }, (_, k) => addDays(raw.from as string, k)).filter(
            (d) => !weekdays || weekdays.includes(weekday(d)),
          );
        })();
    if (!single && daysBetween(raw.from as string, raw.to as string) + 1 > LIMITS.days)
      return err(`${w} covers more than ${LIMITS.days} days.`);
    for (const date of dates) {
      const prev = built.get(date);
      if (prev?.single && single) {
        err(`${w}: ${date} is already planned by an earlier "date" entry.`);
        continue;
      }
      if (prev?.single && !single) continue; // a single date always beats a range
      built.set(date, {
        single,
        day: { date, title, kind, hours, note, tasks: [...tasks], questions: [...questions] },
      });
    }
  });
  if (errors.length) return refused();
  if (built.size === 0) {
    err("No days were left after applying the weekday filters.");
    return refused();
  }
  if (built.size > LIMITS.days) {
    err(`The plan has ${built.size} days; the most is ${LIMITS.days}.`);
    return refused();
  }
  const days = [...built.values()].map((x) => x.day).sort((a, b) => (a.date < b.date ? -1 : 1));

  // ----- plan dates -----
  const starts_on = typeof o.starts_on === "string" && isIsoDate(o.starts_on) ? o.starts_on : days[0].date;
  const ends_on = typeof o.ends_on === "string" && isIsoDate(o.ends_on) ? o.ends_on : days[days.length - 1].date;
  if (ends_on < starts_on) err(`"ends_on" (${ends_on}) is before "starts_on" (${starts_on}).`);
  const outside = days.filter((d) => d.date < starts_on || d.date > ends_on);
  if (outside.length)
    err(
      `${outside.length} day(s) fall outside "starts_on" … "ends_on", e.g. ${outside[0].date}. Move them, or widen the plan's dates.`,
    );

  // ----- milestones -----
  const milestones: PlanFileMilestone[] = [];
  if (o.milestones !== undefined) {
    if (!Array.isArray(o.milestones)) err('"milestones" must be a list.');
    else if (o.milestones.length > LIMITS.milestones)
      err(`There are ${o.milestones.length} milestones; the most is ${LIMITS.milestones}.`);
    else
      o.milestones.forEach((m, i) => {
        const w = `milestones[${i}]`;
        if (!isObj(m) || typeof m.name !== "string" || !m.name.trim()) return err(`${w} needs a "name".`);
        if (typeof m.date !== "string" || !isIsoDate(m.date))
          return err(`${w}.date "${String(m.date)}" is not a real date (use YYYY-MM-DD).`);
        milestones.push({
          name: text(m.name, LIMITS.milestoneName),
          short: optText(m.short, `${w}.short`, LIMITS.milestoneShort),
          date: m.date,
          note: optText(m.note, `${w}.note`, LIMITS.milestoneNote),
        });
      });
  }
  if (!milestones.length)
    warnings.push("No milestones, so the dashboard has nothing to count down to. You can add them later.");
  milestones.sort((a, b) => (a.date < b.date ? -1 : 1));

  if (fixedSlashes) warnings.push(`${fixedSlashes} maths backslash(es) were broken by JSON and have been put back.`);
  if (errors.length) return refused();
  return { plan: { name, description, starts_on, ends_on, milestones, days }, errors, warnings };
}

/** Counts for a preview: days, study days (with tasks), tasks, linked questions. */
export function planSummary(p: PlanFile) {
  return {
    days: p.days.length,
    tasks: p.days.reduce((s, d) => s + d.tasks.length, 0),
    questions: p.days.reduce((s, d) => s + d.questions.length, 0),
    milestones: p.milestones.length,
    span: daysBetween(p.starts_on, p.ends_on) + 1,
  };
}
