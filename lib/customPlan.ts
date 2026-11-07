// Turns a plan someone wrote (or an AI wrote for them) as JSON into the PlanData the app runs on.
// Pure functions only, so scripts/check.ts can test them.
import { Day, DayKind } from "./types";
import { Milestone, PlanData, addDays, daysBetween, weekday } from "./plan";

export const KINDS: DayKind[] = ["study", "crunch", "light", "mock", "buffer", "exam", "taper"];
const MAX_DAYS = 800;
const MAX_ERRORS = 12;

const isDate = (s: unknown): s is string => {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};

const defaultTasks = (kind: DayKind, title: string): string[] => {
  switch (kind) {
    case "study": return [`Main block: ${title}`, "Practise problems on today's topic", "Quick revision of an earlier topic", "Write down anything you got wrong"];
    case "crunch": return [title, "Note anything unclear"];
    case "light": return ["Light revision of recent topics", "Answer a few questions from older topics"];
    case "mock": return [`Take your practice test: ${title}`, "Review every mistake", "Update your notes"];
    case "buffer": return ["Catch up on anything you skipped", "Fix your weak spots"];
    case "exam": return [`${title}. Good luck!`];
    case "taper": return ["Light read-through only. No new topics.", "Sleep early"];
  }
};
const defaultHours: Record<DayKind, number> = { study: 2, crunch: 1, light: 1, mock: 3, buffer: 2, exam: 0, taper: 1 };

export interface ParseResult { plan: PlanData | null; errors: string[]; warnings: string[] }

export function parsePlan(input: unknown): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const err = (m: string) => { if (errors.length < MAX_ERRORS) errors.push(m); else if (errors.length === MAX_ERRORS) errors.push("…and more. Fix these first."); };
  const fail = (): ParseResult => ({ plan: null, errors, warnings });

  if (typeof input !== "object" || input === null || Array.isArray(input)) { err("The file must be one JSON object, like { \"name\": …, \"days\": […] }."); return fail(); }
  const o = input as Record<string, unknown>;

  const name = typeof o.name === "string" && o.name.trim() ? o.name.trim().slice(0, 60) : "My plan";
  if (o.name !== undefined && typeof o.name !== "string") err('"name" must be text.');

  // ----- phases (optional) -----
  const phaseList: { id: string; name: string; from?: string }[] = [];
  if (o.phases !== undefined) {
    if (!Array.isArray(o.phases)) err('"phases" must be a list.');
    else o.phases.forEach((p, i) => {
      const q = p as Record<string, unknown>;
      if (typeof q !== "object" || q === null || typeof q.id !== "string" || !q.id.trim() || typeof q.name !== "string") { err(`phases[${i}] needs an "id" and a "name".`); return; }
      if (q.from !== undefined && !isDate(q.from)) { err(`phases[${i}].from "${String(q.from)}" is not a real date (use YYYY-MM-DD).`); return; }
      if (phaseList.some((x) => x.id === q.id)) { err(`phases[${i}].id "${q.id}" is used twice.`); return; }
      phaseList.push({ id: String(q.id).trim().slice(0, 12), name: String(q.name).trim().slice(0, 90), from: q.from as string | undefined });
    });
  }

  // ----- days -----
  if (!Array.isArray(o.days) || o.days.length === 0) { err('"days" must be a list with at least one day.'); return fail(); }
  const built = new Map<string, { day: Day; explicit: boolean }>();

  o.days.forEach((raw, i) => {
    const w = `days[${i}]`;
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) { err(`${w} must be an object.`); return; }
    const r = raw as Record<string, unknown>;
    const single = r.date !== undefined;
    const ranged = r.from !== undefined || r.to !== undefined;
    if (single === ranged) { err(`${w} needs either "date", or both "from" and "to".`); return; }
    if (single && !isDate(r.date)) { err(`${w}.date "${String(r.date)}" is not a real date (use YYYY-MM-DD).`); return; }
    if (ranged && (!isDate(r.from) || !isDate(r.to))) { err(`${w}: "from" and "to" must both be real dates (YYYY-MM-DD).`); return; }
    if (ranged && (r.to as string) < (r.from as string)) { err(`${w}: "to" is before "from".`); return; }
    if (typeof r.title !== "string" || !r.title.trim()) { err(`${w} needs a "title".`); return; }
    const kind = (r.kind ?? "study") as DayKind;
    if (!KINDS.includes(kind)) { err(`${w}.kind "${String(r.kind)}" is not one of: ${KINDS.join(", ")}.`); return; }
    const title = r.title.trim().slice(0, 120);
    let hours = defaultHours[kind];
    if (r.hours !== undefined) {
      if (typeof r.hours !== "number" || !isFinite(r.hours) || r.hours < 0 || r.hours > 16) { err(`${w}.hours must be a number from 0 to 16.`); return; }
      hours = r.hours;
    }
    let tasks = defaultTasks(kind, title);
    if (r.tasks !== undefined) {
      if (!Array.isArray(r.tasks) || r.tasks.length === 0 || r.tasks.length > 12 || r.tasks.some((t) => typeof t !== "string" || !t.trim())) { err(`${w}.tasks must be a list of 1 to 12 non-empty texts.`); return; }
      tasks = (r.tasks as string[]).map((t) => t.trim().slice(0, 200));
    }
    let topics: string[] = [];
    if (r.topics !== undefined) {
      if (!Array.isArray(r.topics) || r.topics.some((t) => typeof t !== "string")) { err(`${w}.topics must be a list of topic ids.`); return; }
      topics = r.topics as string[];
    }
    let targetQs = 0;
    const q = r.questions ?? r.targetQs;
    if (q !== undefined) {
      if (typeof q !== "number" || !Number.isInteger(q) || q < 0 || q > 200) { err(`${w}.questions must be a whole number from 0 to 200.`); return; }
      targetQs = q;
    }
    let phase = "";
    if (r.phase !== undefined) {
      if (typeof r.phase !== "string") { err(`${w}.phase must be text.`); return; }
      phase = r.phase.trim().slice(0, 12);
    }
    let wd: number[] | null = null;
    if (r.weekdays !== undefined) {
      if (!ranged) { err(`${w}: "weekdays" only works together with "from" and "to".`); return; }
      if (!Array.isArray(r.weekdays) || r.weekdays.some((n) => !Number.isInteger(n) || n < 0 || n > 6)) { err(`${w}.weekdays must be numbers 0 to 6 (0 = Sunday).`); return; }
      wd = r.weekdays as number[];
    }

    const dates = single ? [r.date as string] : Array.from({ length: daysBetween(r.from as string, r.to as string) + 1 }, (_, k) => addDays(r.from as string, k)).filter((d) => !wd || wd.includes(weekday(d)));
    if (dates.length > MAX_DAYS) { err(`${w} covers too many days (the limit is ${MAX_DAYS}).`); return; }
    for (const date of dates) {
      const prev = built.get(date);
      if (prev?.explicit && single) { err(`${w}: ${date} is already planned by an earlier "date" entry.`); continue; }
      if (prev?.explicit && !single) continue; // a single date always beats a range
      built.set(date, { explicit: single, day: { date, phase, kind, hours, title, topics, tasks: [...tasks], targetQs } });
    }
  });

  if (errors.length) return fail();
  if (built.size === 0) { err("No days were left after applying the weekday filters."); return fail(); }
  if (built.size > MAX_DAYS) { err(`The plan has ${built.size} days; the limit is ${MAX_DAYS}.`); return fail(); }

  const days = [...built.values()].map((x) => x.day).sort((a, b) => a.date.localeCompare(b.date));

  // ----- assign phases -----
  const phaseNames: Record<string, string> = {};
  const withFrom = phaseList.filter((p) => p.from).sort((a, b) => (a.from as string).localeCompare(b.from as string));
  for (const d of days) {
    if (!d.phase) {
      const byDate = [...withFrom].reverse().find((p) => (p.from as string) <= d.date);
      d.phase = byDate?.id ?? phaseList[0]?.id ?? "A";
    }
  }
  const order = [...new Set(days.map((d) => d.phase))];
  for (const id of order) {
    const given = phaseList.find((p) => p.id === id);
    if (!given && phaseList.length) warnings.push(`Phase "${id}" is used by a day but not listed in "phases". It was added with its id as the title.`);
    phaseNames[id] = given?.name ?? (phaseList.length ? id : name);
  }

  // ----- milestones -----
  let milestones: Milestone[] = [];
  if (o.milestones !== undefined) {
    if (!Array.isArray(o.milestones)) err('"milestones" must be a list.');
    else o.milestones.forEach((m, i) => {
      const q = m as Record<string, unknown>;
      if (typeof q !== "object" || q === null || typeof q.name !== "string" || !q.name.trim()) { err(`milestones[${i}] needs a "name".`); return; }
      if (!isDate(q.date)) { err(`milestones[${i}].date "${String(q.date)}" is not a real date (use YYYY-MM-DD).`); return; }
      if (q.note !== undefined && typeof q.note !== "string") { err(`milestones[${i}].note must be text.`); return; }
      milestones.push({ id: `p${i + 1}`, name: q.name.trim().slice(0, 40), short: q.name.trim().slice(0, 40), date: q.date, note: (q.note as string | undefined)?.slice(0, 160) });
    });
  } else {
    milestones = days.filter((d) => d.kind === "exam").map((d, i) => ({ id: `p${i + 1}`, name: d.title.slice(0, 40), short: d.title.slice(0, 40), date: d.date }));
    if (milestones.length) warnings.push('No "milestones" given, so each exam day became a milestone.');
    else warnings.push('No milestones. The countdown on Today stays empty until you add one there.');
  }
  if (errors.length) return fail();
  milestones.sort((a, b) => a.date.localeCompare(b.date));

  return { plan: { name, days, phaseNames, milestones }, errors, warnings };
}

// The reverse of parsePlan: the plan as a JSON object you can upload again (used to export a plan before replacing it).
export function planToJson(plan: PlanData) {
  const phaseStart: Record<string, string> = {};
  for (const d of plan.days) phaseStart[d.phase] ??= d.date;
  return {
    name: plan.name,
    phases: Object.entries(plan.phaseNames).map(([id, name]) => ({ id, name, from: phaseStart[id] })),
    milestones: plan.milestones.map(({ name, date, note }) => ({ name, date, ...(note ? { note } : {}) })),
    days: plan.days.map((d) => ({
      date: d.date, title: d.title, kind: d.kind, hours: d.hours, phase: d.phase, tasks: d.tasks,
      ...(d.topics.length ? { topics: d.topics } : {}), ...(d.targetQs ? { questions: d.targetQs } : {}),
    })),
  };
}

// ---------- help for people writing a plan ----------
export const templateJson = (start: string): string => {
  const a = (n: number) => addDays(start, n);
  return JSON.stringify({
    name: "My study plan",
    phases: [
      { id: "A", name: "Learn the basics", from: a(0) },
      { id: "B", name: "Practice and revise", from: a(14) },
    ],
    milestones: [
      { name: "Mid-term", date: a(13), note: "Optional note shown under the milestone" },
      { name: "Final exam", date: a(27) },
    ],
    days: [
      { from: a(0), to: a(4), title: "Read and take notes", kind: "study", hours: 2, tasks: ["Read the next chapter", "Write a one-page summary"] },
      { date: a(5), title: "Weekly practice test", kind: "mock", hours: 3 },
      { date: a(6), title: "Rest and light review", kind: "light", hours: 1 },
      { from: a(7), to: a(11), weekdays: [1, 2, 3, 4, 5], title: "Problem sets", kind: "study", hours: 2, questions: 10 },
      { date: a(12), title: "Practice test", kind: "mock", hours: 3 },
      { date: a(13), title: "Mid-term", kind: "exam" },
      { from: a(14), to: a(25), title: "Revision and past papers", kind: "study", hours: 2 },
      { date: a(26), title: "Rest before the exam", kind: "taper", hours: 1 },
      { date: a(27), title: "Final exam", kind: "exam" },
    ],
  }, null, 2);
};

export const aiPrompt = (start: string): string => `Create a day-by-day study plan for me and reply with ONLY one JSON object (no explanation, no markdown fence).

About me (fill this in before sending):
- Goal / exam: 
- Exam or deadline dates: 
- Plan should start on: ${start}
- Hours I can study on weekdays / weekends: 
- Topics to cover, and which ones are weak: 
- Days I am busy or want off: 

Use exactly this format:
- "name": short plan name.
- "phases": optional list of { "id": "A", "name": "…", "from": "YYYY-MM-DD" }.
- "milestones": list of { "name": "…", "date": "YYYY-MM-DD", "note": "optional" } for exams, tests and deadlines.
- "days": list of day entries. Each is either { "date": "YYYY-MM-DD", … } or a range { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD", "weekdays": [1,2,3,4,5], … } (weekdays optional, 0 = Sunday). A single "date" entry overrides a range on the same day.
  Fields: "title" (required), "kind" (one of: study, crunch, light, mock, buffer, exam, taper), "hours" (0-16), "tasks" (optional list of 1-12 short checklist items for that day), "questions" (optional practice-question target).
  Kinds: study = full study day, crunch = short day, light = light revision, mock = practice test, buffer = catch-up, exam = exam day, taper = rest before an exam.
- All dates are YYYY-MM-DD and real calendar dates. Give "tasks" for every day so each day has a clear checklist.

Here is a valid example to copy the shape from:
${templateJson(start)}`;
