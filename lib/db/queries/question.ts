// Questions to show and answers to record. Named queries (docs/STORAGE.md §2); how to write one:
// lib/db/queries/index.ts. Grading and the stats rules are in lib/grade.ts and docs/STATS.md.

import { read, write } from "@/lib/db/queries/core";
import { decode } from "@/lib/db/codec";
import type { Sql } from "@/lib/db/sql";
import type { LoadedQuestion, QuestionDetail, TopicQuestions } from "@/lib/questions";
import type { AnswerOutcome, QuestionRow, QuestionType } from "@/types/tables";

const DETAIL_TABLE = {
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
   *  while you work through them. */
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
    (sql, p: { topicId: string }): TopicQuestions => {
      const topic =
        sql.get<{ id: string; name: string; subject_name: string }>(
          `SELECT t.id, t.name, s.name AS subject_name FROM topics t JOIN subjects s ON s.id = t.subject_id
           WHERE t.id = ? AND t.retired_at IS NULL`,
          [p.topicId],
        ) ?? null;
      if (!topic) return { topic: null, items: [] };

      const where = "q.topic_id = ? AND q.type <> 'code' AND q.pool = 'practice' AND q.retired_at IS NULL";
      const rows = sql.all(
        `SELECT q.*,
                (SELECT outcome FROM question_answers WHERE question_id = q.id AND outcome <> 'skipped'
                 ORDER BY recorded_at DESC, id DESC LIMIT 1) AS latest
         FROM questions q WHERE ${where} ORDER BY q.created_at, q.rowid LIMIT ${SITTING_MAX}`,
        [p.topicId],
      );
      const byId = new Map<string, QuestionDetail>();
      for (const type of ["mcq", "msq", "nat", "str"] as const)
        for (const [id, d] of details(sql, type, where, [p.topicId])) byId.set(id, d);

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
