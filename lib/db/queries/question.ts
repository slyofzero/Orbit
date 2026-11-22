// Questions to show and answers to record. Named queries (docs/STORAGE.md §2); how to write one:
// lib/db/queries/index.ts. Grading and the stats rules are in lib/grade.ts and docs/STATS.md.

import { read, write } from "@/lib/db/queries/core";
import { decode } from "@/lib/db/codec";
import type { Sql } from "@/lib/db/sql";
import { CODE_ORDER, CODE_Q } from "@/lib/db/queries/practice";
import { CARRY_TABLES, carriedInto } from "@/lib/db/queries/carry";
import { formatLong, type IsoDate } from "@/lib/dates";
import type { CodeQuestionData, DayQuestions, LoadedQuestion, QuestionDetail, TopicQuestions } from "@/lib/questions";
import type { AnswerOutcome, QuestionRow, QuestionType } from "@/types/tables";

/** The table that holds each question type's own fields. */
export const DETAIL_TABLE = {
  mcq: "question_mcq",
  msq: "question_msq",
  nat: "question_nat",
  str: "question_str",
  code: "question_code",
} as const satisfies Record<QuestionType, string>;

const OUTCOMES: readonly AnswerOutcome[] = ["correct", "incorrect", "skipped"];
/** The most questions one sitting loads. */
const SITTING_MAX = 500;

/** Loads the questions picked by `where` (with `params`), each with its type row and latest counted answer, in
 *  the order `order` (an ORDER BY clause). Questions whose type row is missing are left out. */
function load(sql: Sql, where: string, params: string[], order: string): LoadedQuestion[] {
  const rows = sql.all(
    `SELECT q.*,
            (SELECT outcome FROM question_answers WHERE question_id = q.id AND outcome <> 'skipped'
             ORDER BY recorded_at DESC, id DESC LIMIT 1) AS latest
     FROM questions q WHERE ${where} ${order} LIMIT ${SITTING_MAX}`,
    params,
  );
  const byId = new Map<string, QuestionDetail>();
  const types = new Set(rows.map((r) => (r as { type: QuestionType }).type));
  for (const type of types) for (const [id, d] of details(sql, type, where, params)) byId.set(id, d);
  const items: LoadedQuestion[] = [];
  for (const row of rows) {
    const { latest, ...q } = row as Record<string, unknown> & { latest: LoadedQuestion["latest"] };
    const question = q as unknown as QuestionRow;
    const detail = byId.get(question.id);
    if (detail) items.push({ question, detail, latest });
  }
  return items;
}

/** A plan day's sitting (/practice/day?date=): the questions linked to that day (in the day's order), then the
 *  bonus ones placed on it (plan_bonus, docs/PLANS.md §5), in their order. `bonus` maps each bonus
 *  question to the day it came from; a question that is also the day's own counts as its own. Every type, code
 *  too; retired ones are left out. Answering a bonus question ticks it on its own day (db/schema.sql). */
function daySitting(sql: Sql, date: IsoDate): DayQuestions {
  const plan = sql.get<{ id: string; name: string }>("SELECT id, name FROM plans WHERE is_active = 1");
  const day = plan
    ? sql.get<{ id: number }>("SELECT id FROM plan_days WHERE plan_id = ? AND on_date = ?", [plan.id, date])
    : undefined;
  if (!plan || !day) return { topic: null, items: [], bonus: {} };
  const own = sql
    .all<{
      id: string;
    }>(
      `SELECT question_id AS id FROM plan_day_questions WHERE day_id = ? ORDER BY position, question_id LIMIT ${SITTING_MAX}`,
      [day.id],
    )
    .map((r) => r.id);
  const mine = new Set(own);
  const bonus: Record<string, IsoDate> = {};
  for (const q of carriedInto(sql, plan.id, date).questions) if (!mine.has(q.id)) bonus[q.id] ??= q.from;
  const ids = [...own, ...Object.keys(bonus)].slice(0, SITTING_MAX);
  const topic = { id: date, name: `Questions for ${formatLong(date)}`, subject_name: plan.name };
  if (!ids.length) return { topic, items: [], bonus };
  const where = `q.id IN (${ids.map(() => "?").join(",")}) AND q.retired_at IS NULL`;
  const rank = new Map(ids.map((id, i) => [id, i]));
  const items = load(sql, where, ids, "").sort((a, b) => rank.get(a.question.id)! - rank.get(b.question.id)!);
  return { topic, items, bonus };
}

/** The type rows of the questions picked by `where` (a condition on `questions q`), by question id. */
function details(sql: Sql, type: QuestionType, where: string, params: string[]): Map<string, QuestionDetail> {
  const table = DETAIL_TABLE[type];
  const out = new Map<string, QuestionDetail>();
  for (const row of sql.all<{ question_id: string }>(
    `SELECT d.* FROM ${table} d JOIN questions q ON q.id = d.question_id WHERE ${where} LIMIT ${SITTING_MAX}`,
    params,
  ))
    out.set(row.question_id, decode<QuestionDetail>(table, row));
  return out;
}

export const questionQueries = {
  /** The practice questions of a topic (every type but code; not mock-only, not retired), oldest first (a file's
   *  questions share one time, so they keep the file's order: rowid is the order they were saved in), each
   *  with its type row and your latest counted answer. The order never depends on your answers, so it stays put
   *  while you work through them. `questionId` narrows it to that one question, and `topicId` may then be left
   *  out: it is the question's own (Manage pack opens a single question this way). */
  "question.topic": read(
    [
      "topics",
      "subjects",
      "questions",
      "question_mcq",
      "question_msq",
      "question_nat",
      "question_str",
      "question_code",
      "question_answers",
    ],
    (sql, p: { topicId?: string | null; questionId?: string | null }): TopicQuestions => {
      const topicId =
        p.topicId ??
        (p.questionId
          ? (sql.get<{ topic_id: string }>("SELECT topic_id FROM questions WHERE id = ?", [p.questionId])?.topic_id ??
            null)
          : null);
      if (!topicId) return { topic: null, items: [] };
      const topic =
        sql.get<{ id: string; name: string; subject_name: string }>(
          `SELECT t.id, t.name, s.name AS subject_name FROM topics t JOIN subjects s ON s.id = t.subject_id
           WHERE t.id = ? AND t.retired_at IS NULL`,
          [topicId],
        ) ?? null;
      if (!topic) return { topic: null, items: [] };

      const one = p.questionId ? " AND q.id = ?" : "";
      const where = `q.topic_id = ? AND q.type <> 'code' AND q.pool = 'practice' AND q.retired_at IS NULL${one}`;
      const args = p.questionId ? [topicId, p.questionId] : [topicId];
      const items = load(sql, where, args, "ORDER BY q.created_at, q.rowid");
      return { topic, items };
    },
  ),

  /** A plan day's linked questions, for /practice/day?date= (daySitting). */
  "question.day": read(
    [
      "plans",
      "questions",
      "question_mcq",
      "question_msq",
      "question_nat",
      "question_str",
      "question_code",
      "question_answers",
      ...CARRY_TABLES,
    ],
    (sql, p: { date: IsoDate; today: IsoDate }): DayQuestions => daySitting(sql, p.date),
  ),

  /** One code question for the Programming screen: the question, its starter code, your latest counted answer,
   *  and its neighbours in the Programming list (same order as `practice.programming`). */
  "question.code": read(
    ["questions", "question_code", "topics", "subjects", "question_answers"],
    (sql, p: { id: string }): CodeQuestionData => {
      const order = sql.all<{ id: string }>(
        `SELECT q.id FROM questions q JOIN topics t ON t.id = q.topic_id JOIN subjects s ON s.id = t.subject_id
         WHERE ${CODE_Q} ${CODE_ORDER} LIMIT 2000`,
      );
      const index = order.findIndex((r) => r.id === p.id);
      const empty = { item: null, topic: null, index: -1, total: order.length, prev: null, next: null };
      if (index < 0) return empty;
      const row = sql.get(
        `SELECT q.*, (SELECT outcome FROM question_answers WHERE question_id = q.id AND outcome <> 'skipped'
                      ORDER BY recorded_at DESC, id DESC LIMIT 1) AS latest
         FROM questions q WHERE q.id = ?`,
        [p.id],
      );
      const d = sql.get("SELECT * FROM question_code WHERE question_id = ?", [p.id]);
      if (!row || !d) return empty;
      const { latest, ...q } = row as Record<string, unknown> & { latest: LoadedQuestion["latest"] };
      const question = q as unknown as QuestionRow;
      const topic =
        sql.get<{ id: string; name: string; subject_name: string }>(
          `SELECT t.id, t.name, s.name AS subject_name FROM topics t JOIN subjects s ON s.id = t.subject_id
           WHERE t.id = ?`,
          [question.topic_id],
        ) ?? null;
      return {
        item: { question, detail: decode<QuestionDetail>("question_code", d), latest },
        topic,
        index,
        total: order.length,
        prev: order[index - 1]?.id ?? null,
        next: order[index + 1]?.id ?? null,
      };
    },
  ),

  /** Stores answers from a sitting: one row per question (`recorded_at` is now). `question_stats` follows by
   *  itself (a trigger). Practice answers have no attempt. */
  "question.record": write(
    ["question_answers"],
    (sql, p: { answers: { questionId: string; outcome: AnswerOutcome; timeMs: number }[] }): number => {
      let n = 0;
      for (const a of p.answers.slice(0, SITTING_MAX)) {
        if (!OUTCOMES.includes(a.outcome)) throw new Error(`question.record: unknown outcome "${a.outcome}"`);
        sql.run("INSERT INTO question_answers (question_id, recorded_at, outcome, time_ms) VALUES (?, ?, ?, ?)", [
          a.questionId,
          Date.now(),
          a.outcome,
          Math.max(0, Math.round(a.timeMs)),
        ]);
        n++;
      }
      return n;
    },
  ),
};
