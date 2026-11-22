// Plan actions on Manage plan (v1's planner header and /planner/edit): Export plan, Link questions (AI prompt in,
// checked reply out), Unlink questions, and the day-by-day editor. Locked days (lib/dashboard.ts dayLock: past days,
// and today after the lock hour) are never changed here; the screen passes `today` and `hour` (AGENTS.md rule 7).
// Named queries (docs/STORAGE.md §2); how to write one: lib/db/queries/index.ts.

import { bonusEntries, carriedInto, findOriginal, placeBonus, setDayBonus } from "@/lib/db/queries/carry";
import { read, write } from "@/lib/db/queries/core";
import type { Sql } from "@/lib/db/sql";
import { dayLock } from "@/lib/dashboard";
import type { IsoDate } from "@/lib/dates";
import { checkDay, parseDayPatch, splitPatch, type DayForm } from "@/lib/planEdit";
import { LIMITS, planToFile, type PlanFile, type PlanFileDay } from "@/lib/planFile";
import type { PatchInput } from "@/lib/prompts/patchPrompt";
import { parseLinks, readAnswer, type LinkInput, type LinkRules } from "@/lib/planLinks";
import type { PlanDayKind, QuestionType, TopicRating } from "@/types/tables";

const MAX_QUESTIONS = 50_000;
const FIND_LIMIT = 8;

type Plan = { id: string; name: string; description: string | null; starts_on: IsoDate; ends_on: IsoDate };
type BonusRef = { id: number; day_id: number; from_day_id: number; task_id: number | null; question_id: string | null };
/** A bonus row's original item, as placeBonus takes it. */
const itemOf = (b: BonusRef) =>
  b.task_id !== null
    ? { fromDayId: b.from_day_id, taskId: b.task_id }
    : { fromDayId: b.from_day_id, questionId: b.question_id ?? "" };
type Clock = { today: IsoDate; hour: number };

const activePlan = (sql: Sql) =>
  sql.get<Plan>("SELECT id, name, description, starts_on, ends_on FROM plans WHERE is_active = 1");
const isLocked = (date: IsoDate, c: Clock) => dayLock(date, c.today, c.hour) === "locked";

/** Sets one day's linked questions to `ids`, in that order. Links that stay keep their ticks (no delete + insert). */
function setDayLinks(sql: Sql, dayId: number, ids: string[]): void {
  const have = new Set(
    sql
      .all<{ q: string }>("SELECT question_id AS q FROM plan_day_questions WHERE day_id = ? LIMIT 1000", [dayId])
      .map((r) => r.q),
  );
  const keep = new Set(ids);
  for (const q of have)
    if (!keep.has(q)) sql.run("DELETE FROM plan_day_questions WHERE day_id = ? AND question_id = ?", [dayId, q]);
  ids.forEach((q, k) => {
    if (have.has(q))
      sql.run("UPDATE plan_day_questions SET position = ? WHERE day_id = ? AND question_id = ?", [k + 1, dayId, q]);
    else sql.run("INSERT INTO plan_day_questions (day_id, question_id, position) VALUES (?, ?, ?)", [dayId, q, k + 1]);
  });
}

/** What an AI reply is checked against (lib/planLinks.ts LinkRules). */
function linkRules(sql: Sql, plan: Plan, c: Clock): LinkRules {
  const dates = sql
    .all<{ d: IsoDate }>("SELECT on_date AS d FROM plan_days WHERE plan_id = ? LIMIT 2000", [plan.id])
    .map((r) => r.d);
  const ids = sql.all<{ id: string; pool: string }>(
    `SELECT id, pool FROM questions WHERE retired_at IS NULL LIMIT ${MAX_QUESTIONS}`,
  );
  return {
    dates: new Set(dates),
    practice: new Set(ids.filter((q) => q.pool === "practice").map((q) => q.id)),
    mock: new Set(ids.filter((q) => q.pool === "mock").map((q) => q.id)),
    locked: new Set(dates.filter((d) => isLocked(d, c))),
  };
}

/** Edit plan, JSON update: reads and checks a patch against the active plan. Only the dates in it can change. */
function readPatch(sql: Sql, plan: Plan, c: Clock, text: string) {
  const parsed = parseDayPatch(text);
  if (!parsed.plan) return { errors: parsed.errors, warnings: parsed.warnings, apply: [] as PlanFileDay[] };
  const s = splitPatch(parsed.plan.days, plan, (d) => isLocked(d, c));
  const warnings = [...parsed.warnings, ...s.warnings];
  if (!s.apply.length)
    return { errors: ["None of the days in this file can be changed (see the notes above)."], warnings, apply: [] };
  return { errors: [] as string[], warnings, apply: s.apply };
}

/** A patch's bonus entries that can't be used (nothing to save yet): a "from" day that isn't over, or no such task
 *  or linked question on it. They are skipped when the patch is applied. */
function bonusWarnings(sql: Sql, plan: Plan, c: Clock, days: PlanFileDay[]): string[] {
  const bad = days.flatMap((d) =>
    d.bonus.filter((b) => b.from >= c.today || !findOriginal(sql, plan.id, b)).map((b) => `${d.date} (${b.from})`),
  );
  if (!bad.length) return [];
  const list = `${bad.slice(0, 4).join(", ")}${bad.length > 4 ? ` and ${bad.length - 4} more` : ""}`;
  return [
    `${bad.length} bonus item(s) will be skipped: their "from" day isn't over yet, or has no such task or linked question: ${list}.`,
  ];
}

export const planEditQueries = {
  /** Edit plan, JSON update: the plan and its open (not locked) days with their tasks, for the AI prompt
   *  (lib/prompts/patchPrompt.ts). null = no plan. */
  "plan.patchInput": read(
    ["plans", "plan_days", "plan_tasks", "plan_task_ticks", "plan_day_questions", "plan_question_ticks", "plan_bonus"],
    (sql, c: Clock): PatchInput | null => {
      const plan = activePlan(sql);
      if (!plan) return null;
      const rows = sql
        .all<{
          id: number;
          on_date: IsoDate;
          title: string | null;
          kind: PlanDayKind;
          hours: number | null;
          note: string | null;
        }>(
          "SELECT id, on_date, title, kind, hours, note FROM plan_days WHERE plan_id = ? ORDER BY on_date LIMIT 2000",
          [plan.id],
        )
        .filter((d) => !isLocked(d.on_date, c));
      const tasks = new Map<number, string[]>();
      for (const t of sql.all<{ day_id: number; body: string }>(
        `SELECT t.day_id, t.body FROM plan_tasks t JOIN plan_days d ON d.id = t.day_id
       WHERE d.plan_id = ? ORDER BY t.position, t.id LIMIT 50000`,
        [plan.id],
      ))
        tasks.set(t.day_id, [...(tasks.get(t.day_id) ?? []), t.body]);
      // unfinished bonus work on locked days: the AI may move it onto an open day
      const stuck = sql
        .all<{ id: number; on_date: IsoDate }>(
          "SELECT id, on_date FROM plan_days WHERE plan_id = ? AND on_date <= ? ORDER BY on_date LIMIT 2000",
          [plan.id, c.today],
        )
        .filter((d) => isLocked(d.on_date, c))
        .flatMap((d) => {
          const k = carriedInto(sql, plan.id, d.on_date);
          return [
            ...k.tasks.filter((t) => !t.done).map((t) => ({ on: d.on_date, from: t.from, task: t.body })),
            ...k.questions.filter((q) => !q.done).map((q) => ({ on: d.on_date, from: q.from, question: q.id })),
          ];
        })
        .slice(0, LIMITS.bonus);
      return {
        plan,
        days: rows.map((d) => ({
          date: d.on_date,
          title: d.title ?? "Day",
          kind: d.kind,
          hours: d.hours,
          note: d.note,
          tasks: tasks.get(d.id) ?? [],
          bonus: bonusEntries(sql, d.id),
        })),
        stuck,
      };
    },
  ),

  /** Edit plan, JSON update, step 1: what a pasted / uploaded patch would do, without saving anything. */
  "plan.checkPatch": read(
    ["plans", "plan_days", "plan_tasks", "plan_day_questions", "plan_bonus"],
    (sql, p: Clock & { text: string }) => {
      const plan = activePlan(sql);
      if (!plan) return null;
      const r = readPatch(sql, plan, p, p.text);
      const have = new Set(
        sql
          .all<{ d: IsoDate }>("SELECT on_date AS d FROM plan_days WHERE plan_id = ? LIMIT 2000", [plan.id])
          .map((x) => x.d),
      );
      const updated = r.apply.filter((d) => have.has(d.date)).length;
      const warnings = [...r.warnings, ...bonusWarnings(sql, plan, p, r.apply)];
      return { errors: r.errors, warnings, updated, added: r.apply.length - updated };
    },
  ),

  /** Edit plan, JSON update, step 2: checks again and writes the listed dates only. A day in the file gets its
   *  title, type, hours, note and tasks from the file (a task with the same text keeps its tick) and its links if
   *  the file has "questions". Every other day, the plan's name and its milestones stay as they are. One transaction. */
  "plan.applyPatch": write(
    ["plans", "plan_days", "plan_tasks", "plan_day_questions", "plan_bonus"],
    (sql, p: Clock & { text: string }) => {
      const plan = activePlan(sql);
      if (!plan) return { ok: false as const, errors: ["There is no plan to update."] };
      const r = readPatch(sql, plan, p, p.text);
      if (r.errors.length) return { ok: false as const, errors: r.errors };
      let updated = 0;
      let added = 0;
      let tasks = 0;
      let dropped = 0;
      let bonus = 0;
      let skippedBonus = 0;
      for (const d of r.apply) {
        const at = sql.get<{ id: number }>("SELECT id FROM plan_days WHERE plan_id = ? AND on_date = ?", [
          plan.id,
          d.date,
        ]);
        let dayId: number;
        if (at) {
          dayId = at.id;
          sql.run("UPDATE plan_days SET title = ?, kind = ?, hours = ?, note = ? WHERE id = ?", [
            d.title,
            d.kind,
            d.hours,
            d.note,
            dayId,
          ]);
          updated++;
        } else {
          dayId = sql.get<{ id: number }>(
            "INSERT INTO plan_days (plan_id, on_date, title, kind, hours, note) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
            [plan.id, d.date, d.title, d.kind, d.hours, d.note],
          )!.id;
          added++;
        }
        // tasks: reuse a saved task with the same text (its tick stays), delete the rest, add the new ones
        const old = sql.all<{ id: number; body: string }>(
          "SELECT id, body FROM plan_tasks WHERE day_id = ? ORDER BY position, id LIMIT 100",
          [dayId],
        );
        const ids: (number | null)[] = d.tasks.map((body) => {
          const i = old.findIndex((t) => t.body === body);
          return i < 0 ? null : old.splice(i, 1)[0].id;
        });
        for (const t of old) sql.run("DELETE FROM plan_tasks WHERE id = ?", [t.id]);
        d.tasks.forEach((body, k) => {
          const id = ids[k];
          if (id === null)
            sql.run("INSERT INTO plan_tasks (day_id, position, body) VALUES (?, ?, ?)", [dayId, k + 1, body]);
          else sql.run("UPDATE plan_tasks SET position = ? WHERE id = ?", [k + 1, id]);
        });
        tasks += d.tasks.length;
        if (d.hasQuestions) {
          const linked = new Set(
            sql
              .all<{
                q: string;
              }>("SELECT question_id AS q FROM plan_day_questions WHERE day_id = ? LIMIT 1000", [dayId])
              .map((x) => x.q),
          );
          const keep = d.questions.filter(
            (q) =>
              linked.has(q) ||
              !!sql.get("SELECT 1 FROM questions WHERE id = ? AND pool = 'practice' AND retired_at IS NULL", [q]),
          );
          dropped += d.questions.length - keep.length;
          setDayLinks(sql, dayId, keep);
        }
        // bonus: the day's list becomes exactly the file's; an item sitting on another day moves here
        if (d.hasBonus) {
          const b = setDayBonus(sql, plan.id, dayId, d.bonus, p.today);
          bonus += b.placed;
          skippedBonus += b.missing.length;
        }
      }
      sql.run("UPDATE plans SET updated_at = ? WHERE id = ?", [Date.now(), plan.id]);
      const warnings = [...r.warnings];
      if (dropped) warnings.push(`${dropped} linked question(s) left out: not in your practice bank.`);
      if (skippedBonus)
        warnings.push(`${skippedBonus} bonus item(s) skipped: their day isn't over, or has no such task or question.`);
      return { ok: true as const, updated, added, tasks, bonus, warnings };
    },
  ),

  /** Export plan: the active plan as an orbit-plan file (lib/planFile.ts planToFile). null = no plan. */
  "plan.export": read(["plans", "plan_days", "plan_tasks", "plan_day_questions", "plan_bonus", "milestones"], (sql) => {
    const plan = activePlan(sql);
    if (!plan) return null;
    const carriedBefore =
      sql.get<{ c: IsoDate | null }>("SELECT carried_before AS c FROM plans WHERE id = ?", [plan.id])?.c ?? null;
    const days = sql.all<{
      id: number;
      on_date: IsoDate;
      title: string | null;
      kind: PlanDayKind;
      hours: number | null;
      note: string | null;
    }>("SELECT id, on_date, title, kind, hours, note FROM plan_days WHERE plan_id = ? ORDER BY on_date LIMIT 2000", [
      plan.id,
    ]);
    const tasks = new Map<number, string[]>();
    for (const t of sql.all<{ day_id: number; body: string }>(
      `SELECT t.day_id, t.body FROM plan_tasks t JOIN plan_days d ON d.id = t.day_id
       WHERE d.plan_id = ? ORDER BY t.position, t.id LIMIT 50000`,
      [plan.id],
    ))
      tasks.set(t.day_id, [...(tasks.get(t.day_id) ?? []), t.body]);
    const links = new Map<number, string[]>();
    for (const l of sql.all<{ day_id: number; question_id: string }>(
      `SELECT l.day_id, l.question_id FROM plan_day_questions l JOIN plan_days d ON d.id = l.day_id
       WHERE d.plan_id = ? ORDER BY l.position LIMIT 200000`,
      [plan.id],
    ))
      links.set(l.day_id, [...(links.get(l.day_id) ?? []), l.question_id]);
    const milestones = sql.all<{ name: string; short: string | null; date: IsoDate; note: string | null }>(
      "SELECT name, short, on_date AS date, note FROM milestones WHERE plan_id = ? ORDER BY on_date LIMIT 100",
      [plan.id],
    );
    const file: PlanFile = {
      name: plan.name,
      description: plan.description,
      starts_on: plan.starts_on,
      ends_on: plan.ends_on,
      milestones,
      days: days.map((d) => ({
        date: d.on_date,
        title: d.title ?? "Day",
        kind: d.kind,
        hours: d.hours,
        note: d.note,
        tasks: tasks.get(d.id) ?? [],
        questions: links.get(d.id) ?? [],
        bonus: bonusEntries(sql, d.id),
      })),
      carried_before: carriedBefore,
    };
    return {
      file: planToFile(file),
      name: plan.name,
      days: days.length,
      tasks: [...tasks.values()].reduce((n, t) => n + t.length, 0),
      links: [...links.values()].reduce((n, l) => n + l.length, 0),
      bonus: file.days.reduce((n, d) => n + d.bonus.length, 0),
    };
  }),

  /** Link questions: the plan, its current links and the practice bank, for the AI prompt (lib/planLinks.ts).
   *  null = no plan. */
  "plan.linkInput": read(
    [
      "plans",
      "plan_days",
      "plan_tasks",
      "plan_day_questions",
      "questions",
      "topics",
      "subjects",
      "topic_ratings",
      "question_tags",
      "tags",
    ],
    (sql, c: Clock) => {
      const plan = activePlan(sql);
      if (!plan) return null;
      const rows = sql.all<{
        id: number;
        on_date: IsoDate;
        kind: PlanDayKind;
        hours: number | null;
        title: string | null;
      }>("SELECT id, on_date, kind, hours, title FROM plan_days WHERE plan_id = ? ORDER BY on_date LIMIT 2000", [
        plan.id,
      ]);
      const tasks = new Map<number, string[]>();
      for (const t of sql.all<{ day_id: number; body: string }>(
        `SELECT t.day_id, t.body FROM plan_tasks t JOIN plan_days d ON d.id = t.day_id
         WHERE d.plan_id = ? ORDER BY t.position, t.id LIMIT 50000`,
        [plan.id],
      ))
        tasks.set(t.day_id, [...(tasks.get(t.day_id) ?? []), t.body]);
      const links = new Map<IsoDate, string[]>();
      for (const l of sql.all<{ on_date: IsoDate; question_id: string }>(
        `SELECT d.on_date, l.question_id FROM plan_day_questions l JOIN plan_days d ON d.id = l.day_id
         WHERE d.plan_id = ? ORDER BY d.on_date, l.position LIMIT 200000`,
        [plan.id],
      ))
        links.set(l.on_date, [...(links.get(l.on_date) ?? []), l.question_id]);
      const topics = sql.all<{ id: string; name: string; subject: string; rating: TopicRating | null }>(
        `SELECT t.id, t.name, s.name AS subject, r.rating FROM topics t JOIN subjects s ON s.id = t.subject_id
         LEFT JOIN topic_ratings r ON r.topic_id = t.id
         WHERE t.retired_at IS NULL ORDER BY s.position, s.name, t.position, t.name LIMIT 5000`,
      );
      const questions = sql
        .all<{
          id: string;
          topic_id: string;
          type: QuestionType;
          marks: number;
          difficulty: string;
          tags: string | null;
          text: string;
        }>(
          `SELECT q.id, q.topic_id, q.type, q.marks, q.difficulty, substr(q.stem, 1, 600) AS text,
                  (SELECT group_concat(g.name, ',') FROM question_tags qt JOIN tags g ON g.id = qt.tag_id
                   WHERE qt.question_id = q.id) AS tags
           FROM questions q WHERE q.pool = 'practice' AND q.retired_at IS NULL
           ORDER BY q.topic_id, q.created_at, q.rowid LIMIT ${MAX_QUESTIONS}`,
        )
        .map((q) => ({ ...q, tags: q.tags ? q.tags.split(",") : [] }));
      const input: LinkInput = {
        plan: { name: plan.name, description: plan.description },
        days: rows.map((d) => ({
          date: d.on_date,
          kind: d.kind,
          hours: d.hours,
          title: d.title,
          tasks: tasks.get(d.id) ?? [],
        })),
        topics,
        questions,
        current: [...links].map(([date, questions]) => ({ date, questions })),
        locked: rows.map((d) => d.on_date).filter((d) => isLocked(d, c)),
      };
      const open = rows.length - input.locked.length;
      const linkedOpen = input.current.filter((l) => !input.locked.includes(l.date)).length;
      return { input, open, linkedOpen, lockedLinked: input.current.length - linkedOpen };
    },
  ),

  /** Link questions, step 2: checks a pasted AI reply against the plan and bank without saving anything. */
  "plan.checkLinks": read(["plans", "plan_days", "questions"], (sql, p: Clock & { text: string }) => {
    const plan = activePlan(sql);
    if (!plan) return null;
    const a = readAnswer(p.text);
    if (a.errors.length) return { errors: a.errors, warnings: a.warnings, days: 0, questions: 0 };
    const r = parseLinks(a.value, linkRules(sql, plan, p));
    return { errors: r.errors, warnings: [...a.warnings, ...r.warnings], days: r.days, questions: r.questions };
  }),

  /** Link questions, step 3: checks the reply again and makes it the links of every open day: a day in the reply
   *  gets exactly its questions, an open day left out loses its links. Locked days keep theirs. One transaction. */
  "plan.applyLinks": write(["plan_day_questions"], (sql, p: Clock & { text: string }) => {
    const plan = activePlan(sql);
    if (!plan) return { ok: false as const, errors: ["There is no plan to link questions to."] };
    const a = readAnswer(p.text);
    if (a.errors.length) return { ok: false as const, errors: a.errors };
    const r = parseLinks(a.value, linkRules(sql, plan, p));
    if (!r.links) return { ok: false as const, errors: r.errors };
    const want = new Map(r.links.map((l) => [l.date, l.questions]));
    const days = sql.all<{ id: number; on_date: IsoDate }>(
      "SELECT id, on_date FROM plan_days WHERE plan_id = ? LIMIT 2000",
      [plan.id],
    );
    let cleared = 0;
    for (const d of days) {
      if (isLocked(d.on_date, p)) continue;
      const ids = want.get(d.on_date) ?? [];
      if (!ids.length && sql.get("SELECT 1 FROM plan_day_questions WHERE day_id = ? LIMIT 1", [d.id])) cleared++;
      setDayLinks(sql, d.id, ids);
    }
    return {
      ok: true as const,
      days: r.days,
      questions: r.questions,
      cleared,
      warnings: [...a.warnings, ...r.warnings],
    };
  }),

  /** Unlink questions: removes the links of every open day of the plan. Locked days keep theirs (and their ticks). */
  "plan.unlinkAll": write(["plan_day_questions"], (sql, c: Clock) => {
    const plan = activePlan(sql);
    if (!plan) return { days: 0, links: 0, kept: 0 };
    const days = sql.all<{ id: number; on_date: IsoDate; n: number }>(
      `SELECT d.id, d.on_date, count(*) AS n FROM plan_days d JOIN plan_day_questions l ON l.day_id = d.id
       WHERE d.plan_id = ? GROUP BY d.id LIMIT 2000`,
      [plan.id],
    );
    let links = 0;
    let n = 0;
    let kept = 0;
    for (const d of days) {
      if (isLocked(d.on_date, c)) {
        kept++;
        continue;
      }
      links += sql.run("DELETE FROM plan_day_questions WHERE day_id = ?", [d.id]);
      n++;
    }
    return { days: n, links, kept };
  }),

  /** Unlink this day (planner): removes one open day's linked questions. A locked day is refused. Returns what it
   *  removed (links and their ticks), so Undo (`plan.relinkDay`) can put the day back exactly. */
  "plan.unlinkDay": write(["plan_day_questions"], (sql, p: Clock & { dayId: number }) => {
    const plan = activePlan(sql);
    const day = plan
      ? sql.get<{ on_date: IsoDate }>("SELECT on_date FROM plan_days WHERE id = ? AND plan_id = ?", [p.dayId, plan.id])
      : undefined;
    if (!day) return { ok: false as const, error: "That day isn't in your plan any more." };
    if (isLocked(day.on_date, p)) return { ok: false as const, error: "This day is locked, so its questions stay." };
    const links = sql.all<{ question_id: string; position: number }>(
      "SELECT question_id, position FROM plan_day_questions WHERE day_id = ? ORDER BY position LIMIT 1000",
      [p.dayId],
    );
    const ticks = sql.all<{ question_id: string; answer_id: number; done_at: number }>(
      "SELECT question_id, answer_id, done_at FROM plan_question_ticks WHERE day_id = ? LIMIT 1000",
      [p.dayId],
    );
    sql.run("DELETE FROM plan_day_questions WHERE day_id = ?", [p.dayId]); // ticks go with them (cascade)
    return { ok: true as const, dayId: p.dayId, links, ticks };
  }),

  /** Undo of Unlink this day: puts the links and their ticks back. Questions or answers deleted since are skipped. */
  "plan.relinkDay": write(
    ["plan_day_questions", "plan_question_ticks"],
    (
      sql,
      p: Clock & {
        dayId: number;
        links: { question_id: string; position: number }[];
        ticks: { question_id: string; answer_id: number; done_at: number }[];
      },
    ) => {
      const plan = activePlan(sql);
      const day = plan
        ? sql.get<{ on_date: IsoDate }>("SELECT on_date FROM plan_days WHERE id = ? AND plan_id = ?", [
            p.dayId,
            plan.id,
          ])
        : undefined;
      if (!day) return { ok: false as const, error: "That day isn't in your plan any more." };
      if (isLocked(day.on_date, p)) return { ok: false as const, error: "This day is locked now, so it can't change." };
      for (const l of p.links.slice(0, 1000))
        sql.run(
          `INSERT INTO plan_day_questions (day_id, question_id, position)
           SELECT ?, id, ? FROM questions WHERE id = ?
             AND NOT EXISTS (SELECT 1 FROM plan_day_questions WHERE day_id = ? AND question_id = ?)`,
          [p.dayId, l.position, l.question_id, p.dayId, l.question_id],
        );
      for (const t of p.ticks.slice(0, 1000))
        sql.run(
          `INSERT INTO plan_question_ticks (day_id, question_id, answer_id, done_at)
           SELECT ?, ?, a.id, ? FROM question_answers a
           WHERE a.id = ? AND EXISTS (SELECT 1 FROM plan_day_questions WHERE day_id = ? AND question_id = ?)
             AND NOT EXISTS (SELECT 1 FROM plan_question_ticks WHERE day_id = ? AND question_id = ?)`,
          [p.dayId, t.question_id, t.done_at, t.answer_id, p.dayId, t.question_id, p.dayId, t.question_id],
        );
      const links = sql.get<{ n: number }>("SELECT count(*) AS n FROM plan_day_questions WHERE day_id = ?", [
        p.dayId,
      ])!.n;
      return { ok: true as const, links };
    },
  ),

  /** Edit plan: the plan's details and every day with its task and question counts. null = no plan. */
  "plan.editDays": read(["plans", "plan_days", "plan_tasks", "plan_day_questions", "plan_bonus"], (sql) => {
    const plan = activePlan(sql);
    if (!plan) return null;
    const days = sql.all<{
      id: number;
      on_date: IsoDate;
      title: string | null;
      kind: PlanDayKind;
      hours: number | null;
      tasks: number;
      questions: number;
      bonus: number;
    }>(
      `SELECT d.id, d.on_date, d.title, d.kind, d.hours,
              (SELECT count(*) FROM plan_tasks t WHERE t.day_id = d.id) AS tasks,
              (SELECT count(*) FROM plan_day_questions q WHERE q.day_id = d.id) AS questions,
              (SELECT count(*) FROM plan_bonus b WHERE b.day_id = d.id) AS bonus
       FROM plan_days d WHERE d.plan_id = ? ORDER BY d.on_date LIMIT 2000`,
      [plan.id],
    );
    return { plan, days };
  }),

  /** Edit plan: one day as the editor needs it, with which tasks are ticked and which questions are done. */
  "plan.editDay": read(
    [
      "plan_days",
      "plan_tasks",
      "plan_task_ticks",
      "plan_day_questions",
      "plan_question_ticks",
      "plan_bonus",
      "questions",
      "topics",
    ],
    (sql, p: { dayId: number }) => {
      const day = sql.get<{
        id: number;
        on_date: IsoDate;
        title: string | null;
        kind: PlanDayKind;
        hours: number | null;
        note: string | null;
      }>("SELECT id, on_date, title, kind, hours, note FROM plan_days WHERE id = ?", [p.dayId]);
      if (!day) return null;
      const tasks = sql
        .all<{ id: number; body: string; done: number }>(
          `SELECT t.id, t.body, EXISTS (SELECT 1 FROM plan_task_ticks k WHERE k.task_id = t.id) AS done
           FROM plan_tasks t WHERE t.day_id = ? ORDER BY t.position, t.id LIMIT 100`,
          [p.dayId],
        )
        .map((t) => ({ ...t, done: !!t.done }));
      const questions = sql
        .all<{ id: string; stem: string | null; topic: string | null; done: number }>(
          `SELECT l.question_id AS id, substr(q.stem, 1, 300) AS stem, t.name AS topic,
                  EXISTS (SELECT 1 FROM plan_question_ticks k WHERE k.day_id = l.day_id AND k.question_id = l.question_id) AS done
           FROM plan_day_questions l LEFT JOIN questions q ON q.id = l.question_id LEFT JOIN topics t ON t.id = q.topic_id
           WHERE l.day_id = ? ORDER BY l.position LIMIT ${LIMITS.questions + 50}`,
          [p.dayId],
        )
        .map((q) => ({ ...q, done: !!q.done }));
      const plan = sql.get<{ id: string }>("SELECT plan_id AS id FROM plan_days WHERE id = ?", [p.dayId])!;
      const carried = carriedInto(sql, plan.id, day.on_date);
      const stems = new Map(
        sql
          .all<{ id: string; stem: string; topic: string | null }>(
            `SELECT q.id, substr(q.stem, 1, 300) AS stem, t.name AS topic FROM plan_bonus b
             JOIN questions q ON q.id = b.question_id LEFT JOIN topics t ON t.id = q.topic_id
             WHERE b.day_id = ? LIMIT 1200`,
            [p.dayId],
          )
          .map((q) => [q.id, q]),
      );
      const bonus = [
        ...carried.tasks.map((t) => ({ ...t, kind: "task" as const, stem: null, topic: null })),
        ...carried.questions.map((q) => ({
          ...q,
          kind: "question" as const,
          body: null,
          stem: stems.get(q.id)?.stem ?? null,
          topic: stems.get(q.id)?.topic ?? null,
        })),
      ];
      return { day, tasks, questions, bonus };
    },
  ),

  /** Edit plan: moves one bonus item to another planned day that isn't locked. Bonus work never counts toward the
   *  day it sits on, so it may be moved off any day, a locked one too. Returns where it was, for Undo. */
  "plan.moveBonus": write(["plan_bonus"], (sql, p: Clock & { bonusId: number; to: IsoDate }) => {
    const plan = activePlan(sql);
    const b = sql.get<BonusRef & { from: IsoDate }>(
      `SELECT b.id, b.day_id, b.from_day_id, b.task_id, b.question_id, f.on_date AS "from"
       FROM plan_bonus b JOIN plan_days f ON f.id = b.from_day_id WHERE b.id = ? AND f.plan_id = ?`,
      [p.bonusId, plan?.id ?? ""],
    );
    if (!plan || !b) return { ok: false as const, error: "That bonus item is gone. Reload the page." };
    const to = sql.get<{ id: number }>("SELECT id FROM plan_days WHERE plan_id = ? AND on_date = ?", [plan.id, p.to]);
    if (!to) return { ok: false as const, error: "That date isn't a planned day. Pick a day that is in your plan." };
    if (isLocked(p.to, p))
      return { ok: false as const, error: "That day is locked. Pick today (before it locks) or a later day." };
    if (p.to <= b.from) return { ok: false as const, error: "Bonus work goes on a day after the one it came from." };
    if (to.id === b.day_id) return { ok: false as const, error: "It is on that day already." };
    placeBonus(sql, to.id, itemOf(b));
    const back = sql.get<{ on_date: IsoDate }>("SELECT on_date FROM plan_days WHERE id = ?", [b.day_id])!.on_date;
    return { ok: true as const, bonusId: b.id, from: back, to: p.to };
  }),

  /** Undo of a move: puts a bonus item back on the day it sat on (any day, a locked one too). */
  "plan.unmoveBonus": write(["plan_bonus"], (sql, p: { bonusId: number; to: IsoDate }) => {
    const plan = activePlan(sql);
    const b = sql.get<BonusRef>("SELECT id, day_id, from_day_id, task_id, question_id FROM plan_bonus WHERE id = ?", [
      p.bonusId,
    ]);
    const to = plan
      ? sql.get<{ id: number }>("SELECT id FROM plan_days WHERE plan_id = ? AND on_date = ?", [plan.id, p.to])
      : undefined;
    if (!b || !to) return { ok: false as const, error: "That bonus item or its day is gone." };
    placeBonus(sql, to.id, itemOf(b));
    return { ok: true as const };
  }),

  /** Edit plan: removes one bonus item from the day it sits on (the item stays, unfinished, on its own day). Returns
   *  the row, for Undo (`plan.restoreBonus`). */
  "plan.removeBonus": write(["plan_bonus"], (sql, p: { bonusId: number }) => {
    const b = sql.get<BonusRef & { position: number }>(
      "SELECT id, day_id, position, from_day_id, task_id, question_id FROM plan_bonus WHERE id = ?",
      [p.bonusId],
    );
    if (!b) return { ok: false as const, error: "That bonus item is gone already." };
    sql.run("DELETE FROM plan_bonus WHERE id = ?", [b.id]);
    return { ok: true as const, row: b };
  }),

  /** Undo of Remove: puts the bonus row back (a new id: SQLite may have reused the old one), unless its item or day
   *  is gone or the item was placed again since. */
  "plan.restoreBonus": write(["plan_bonus"], (sql, p: { row: BonusRef & { position: number } }) => {
    const r = p.row;
    const n = sql.run(
      `INSERT INTO plan_bonus (day_id, position, from_day_id, task_id, question_id)
       SELECT ?, ?, ?, ?, ?
       WHERE EXISTS (SELECT 1 FROM plan_days WHERE id = ?)
         AND (? IS NULL OR EXISTS (SELECT 1 FROM plan_tasks WHERE id = ?))
         AND (? IS NULL OR EXISTS (SELECT 1 FROM plan_day_questions WHERE day_id = ? AND question_id = ?))
         AND NOT EXISTS (SELECT 1 FROM plan_bonus WHERE task_id = ? OR (from_day_id = ? AND question_id = ?))`,
      [
        r.day_id,
        r.position,
        r.from_day_id,
        r.task_id,
        r.question_id,
        r.day_id,
        r.task_id,
        r.task_id,
        r.question_id,
        r.from_day_id,
        r.question_id,
        r.task_id,
        r.from_day_id,
        r.question_id,
      ],
    );
    return n
      ? { ok: true as const }
      : { ok: false as const, error: "It can't go back: it was moved or deleted since." };
  }),

  /** Edit plan: practice questions to add to a day, found by id or text (`search`), or looked up by `ids`
   *  (pasted links). Only questions that can be linked: practice pool, not retired. */
  "plan.findQuestions": read(["questions", "topics"], (sql, p: { search: string; ids?: string[] }) => {
    const cols =
      "SELECT q.id, substr(q.stem, 1, 300) AS stem, t.name AS topic FROM questions q JOIN topics t ON t.id = q.topic_id";
    const base = "q.pool = 'practice' AND q.retired_at IS NULL";
    type Hit = { id: string; stem: string; topic: string };
    if (p.ids) {
      const ids = p.ids.slice(0, LIMITS.questions);
      if (!ids.length) return [];
      const found = sql.all<Hit>(
        `${cols} WHERE ${base} AND q.id IN (${ids.map(() => "?").join(",")}) LIMIT ${LIMITS.questions}`,
        ids,
      );
      const by = new Map(found.map((h) => [h.id, h]));
      return ids.flatMap((id) => by.get(id) ?? []);
    }
    const needle = p.search.trim().toLowerCase();
    if (!needle) return [];
    return sql.all<Hit>(
      `${cols} WHERE ${base} AND (instr(lower(q.id), ?) > 0 OR instr(lower(q.stem), ?) > 0 OR instr(lower(t.name), ?) > 0)
       ORDER BY lower(q.id) = ? DESC, t.position, q.created_at, q.rowid LIMIT ${FIND_LIMIT}`,
      [needle, needle, needle, needle],
    );
  }),

  /** Edit plan: saves one day (checked again with lib/planEdit.ts checkDay). Tasks keep their id, so ticks follow
   *  them; a removed task takes its tick with it. Locked days are refused. One transaction. */
  "plan.saveDay": write(
    ["plans", "plan_days", "plan_tasks", "plan_day_questions"],
    (sql, p: Clock & { dayId: number; form: DayForm }) => {
      const at = sql.get<{ on_date: IsoDate }>("SELECT on_date FROM plan_days WHERE id = ?", [p.dayId]);
      if (!at) return { ok: false as const, errors: ["That day is gone. Reload the page."] };
      if (isLocked(at.on_date, p))
        return { ok: false as const, errors: ["This day is locked, so it can't be changed any more."] };
      const { day, errors } = checkDay(p.form);
      if (!day) return { ok: false as const, errors };
      const own = new Set(
        sql.all<{ id: number }>("SELECT id FROM plan_tasks WHERE day_id = ? LIMIT 100", [p.dayId]).map((t) => t.id),
      );
      if (day.tasks.some((t) => t.id !== null && !own.has(t.id)))
        return { ok: false as const, errors: ["A task belongs to another day. Reload the page and try again."] };
      // links: only questions that can be linked, or ones this day links already (kept even if since retired)
      const linked = new Set(
        sql
          .all<{ q: string }>("SELECT question_id AS q FROM plan_day_questions WHERE day_id = ? LIMIT 1000", [p.dayId])
          .map((r) => r.q),
      );
      const questions = day.questions.filter(
        (id) =>
          linked.has(id) ||
          !!sql.get("SELECT 1 FROM questions WHERE id = ? AND pool = 'practice' AND retired_at IS NULL", [id]),
      );
      sql.run("UPDATE plan_days SET title = ?, kind = ?, hours = ?, note = ? WHERE id = ?", [
        day.title,
        day.kind,
        day.hours,
        day.note,
        p.dayId,
      ]);
      const keep = new Set(day.tasks.flatMap((t) => (t.id === null ? [] : [t.id])));
      for (const id of own) if (!keep.has(id)) sql.run("DELETE FROM plan_tasks WHERE id = ?", [id]);
      day.tasks.forEach((t, k) => {
        if (t.id === null)
          sql.run("INSERT INTO plan_tasks (day_id, position, body) VALUES (?, ?, ?)", [p.dayId, k + 1, t.body]);
        else sql.run("UPDATE plan_tasks SET position = ?, body = ? WHERE id = ?", [k + 1, t.body, t.id]);
      });
      setDayLinks(sql, p.dayId, questions);
      sql.run("UPDATE plans SET updated_at = ? WHERE id = (SELECT plan_id FROM plan_days WHERE id = ?)", [
        Date.now(),
        p.dayId,
      ]);
      return {
        ok: true as const,
        date: at.on_date,
        tasks: day.tasks.length,
        questions: questions.length,
        dropped: day.questions.length - questions.length,
      };
    },
  ),

  /** Edit plan: adds a day on a free date inside the plan (v1: titled "New day", with one task to edit). */
  "plan.addDay": write(["plan_days", "plan_tasks"], (sql, p: { date: IsoDate }) => {
    const plan = activePlan(sql);
    if (!plan) return { ok: false as const, error: "There is no plan to add a day to." };
    if (p.date < plan.starts_on || p.date > plan.ends_on)
      return { ok: false as const, error: "Pick a date inside the plan's dates." };
    if (sql.get("SELECT 1 FROM plan_days WHERE plan_id = ? AND on_date = ?", [plan.id, p.date]))
      return { ok: false as const, error: "That date is already in your plan. Open it in the list to edit it." };
    const dayId = sql.get<{ id: number }>(
      "INSERT INTO plan_days (plan_id, on_date, title, kind) VALUES (?, ?, 'New day', 'study') RETURNING id",
      [plan.id, p.date],
    )!.id;
    sql.run("INSERT INTO plan_tasks (day_id, position, body) VALUES (?, 1, 'New task')", [dayId]);
    return { ok: true as const, dayId };
  }),

  /** Edit plan: deletes a day with its tasks, links and ticks (cascade). Answers are kept. Locked days are refused. */
  "plan.deleteDay": write(["plan_days"], (sql, p: Clock & { dayId: number }) => {
    const at = sql.get<{ on_date: IsoDate }>("SELECT on_date FROM plan_days WHERE id = ?", [p.dayId]);
    if (!at) return { ok: false as const, error: "That day is gone already." };
    if (isLocked(at.on_date, p)) return { ok: false as const, error: "This day is locked, so it can't be deleted." };
    sql.run("DELETE FROM plan_days WHERE id = ?", [p.dayId]);
    return { ok: true as const, date: at.on_date };
  }),

  /** Edit plan: the plan's name and description (the words the Link questions prompt hands the AI). */
  "plan.saveDetails": write(["plans"], (sql, p: { name: string; description: string }) => {
    const name = p.name.trim();
    const description = p.description.trim();
    if (!name) return { ok: false as const, error: "Give the plan a name." };
    if (name.length > LIMITS.name)
      return { ok: false as const, error: `The name is longer than ${LIMITS.name} characters.` };
    if (description.length > LIMITS.description)
      return { ok: false as const, error: `The description is longer than ${LIMITS.description} characters.` };
    const n = sql.run("UPDATE plans SET name = ?, description = ?, updated_at = ? WHERE is_active = 1", [
      name,
      description || null,
      Date.now(),
    ]);
    return n ? { ok: true as const } : { ok: false as const, error: "There is no plan to rename." };
  }),
};
