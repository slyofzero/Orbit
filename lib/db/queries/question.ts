// Questions to show and answers to record. Named queries (docs/STORAGE.md §2); how to write one:
// lib/db/queries/index.ts. Grading and the stats rules are in lib/grade.ts and docs/STATS.md.

import { read, write } from "@/lib/db/queries/core";
import { decode } from "@/lib/db/codec";
import type { Sql } from "@/lib/db/sql";
import { CODE_ORDER, CODE_Q } from "@/lib/db/queries/practice";
import type { CodeQuestionData, LoadedQuestion, QuestionDetail, TopicQuestions } from "@/lib/questions";
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
      const rows = sql.all(
        `SELECT q.*,
                (SELECT outcome FROM question_answers WHERE question_id = q.id AND outcome <> 'skipped'
                 ORDER BY recorded_at DESC, id DESC LIMIT 1) AS latest
         FROM questions q WHERE ${where} ORDER BY q.created_at, q.rowid LIMIT ${SITTING_MAX}`,
        args,
      );
      const byId = new Map<string, QuestionDetail>();
      for (const type of ["mcq", "msq", "nat", "str"] as const)
        for (const [id, d] of details(sql, type, where, args)) byId.set(id, d);

      const items: LoadedQuestion[] = [];
      for (const row of rows) {
        const { latest, ...q } = row as Record<string, unknown> & { latest: LoadedQuestion["latest"] };
        const question = q as unknown as QuestionRow;
        const detail = byId.get(question.id);
        if (detail) items.push({ question, detail, latest });
      }
      return { topic, items };
    },
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
