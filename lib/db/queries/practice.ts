// Practice: counts and the Topics / Programming / Mocks tabs.
// Named queries (docs/STORAGE.md §2); how to write one: lib/db/queries/index.ts.

import { read } from "@/lib/db/queries/core";

import { type IsoDate } from "@/lib/dates";

import {
  codeState,
  type FacetRow,
  type MockCard,
  type MockHistoryRow,
  type PracticeCode,
  type PracticeCodeData,
  type PracticeCounts,
  type PracticeMocksData,
  type PracticeTopic,
  type PracticeTopicsData,
} from "@/lib/practice";

/** The questions topic practice uses: not code ones, not mock-only ones, not retired ones. */
const PRACTICE_Q = "q.type <> 'code' AND q.pool = 'practice' AND q.retired_at IS NULL";
/** Subjects then topics in the order the owner gave them. */
const TOPIC_ORDER = "ORDER BY s.position, s.name, t.position, t.name";
const tagIds = (csv: string) => (csv ? csv.split(",").map(Number) : []);

export const practiceQueries = {
  /** What is loaded: topic-practice questions, code questions, full-length mocks, mock-only questions. */
  "practice.counts": read(["questions", "mocks"], (sql): PracticeCounts => {
    const r = sql.get<PracticeCounts>(
      `SELECT
         (SELECT count(*) FROM questions q WHERE ${PRACTICE_Q}) AS practice,
         (SELECT count(*) FROM questions WHERE type = 'code' AND pool = 'practice' AND retired_at IS NULL) AS programming,
         (SELECT count(*) FROM mocks WHERE retired_at IS NULL) AS mocks,
         (SELECT count(*) FROM questions WHERE pool = 'mock' AND retired_at IS NULL) AS mockQuestions`,
    )!;
    return r;
  }),

  /** The Topics tab: every topic that has practice questions with how many you have tried / got right (by
   *  each question's latest counted answer), the facets the Filter pop-up counts, and the next planned day's
   *  topics (from the questions linked to that day). */
  "practice.topics": read(
    [
      "subjects",
      "topics",
      "topic_ratings",
      "questions",
      "question_answers",
      "question_tags",
      "tags",
      "plans",
      "plan_days",
      "plan_day_questions",
    ],
    (sql, p: { today: IsoDate }): PracticeTopicsData => {
      const topics = sql.all<PracticeTopic>(
        `SELECT t.id, t.name, t.subject_id, s.name AS subject_name, r.rating,
                count(q.id) AS total,
                coalesce(sum(l.outcome IS NOT NULL), 0) AS tried,
                coalesce(sum(l.outcome = 'correct'), 0) AS correct
         FROM topics t JOIN subjects s ON s.id = t.subject_id
         LEFT JOIN topic_ratings r ON r.topic_id = t.id
         LEFT JOIN questions q ON q.topic_id = t.id AND ${PRACTICE_Q}
         LEFT JOIN (SELECT question_id, outcome, max(recorded_at) FROM question_answers
                    WHERE outcome <> 'skipped' GROUP BY question_id) l ON l.question_id = q.id
         WHERE t.retired_at IS NULL
         GROUP BY t.id HAVING count(q.id) > 0
         ${TOPIC_ORDER} LIMIT 2000`,
      );
      const facets = sql
        .all<Omit<FacetRow, "tags"> & { tags: string }>(
          `SELECT q.topic_id, t.subject_id, q.difficulty, count(*) AS n,
                  coalesce((SELECT group_concat(tag_id) FROM (SELECT tag_id FROM question_tags
                            WHERE question_id = q.id ORDER BY tag_id)), '') AS tags
           FROM questions q JOIN topics t ON t.id = q.topic_id
           WHERE ${PRACTICE_Q} AND t.retired_at IS NULL
           GROUP BY q.topic_id, q.difficulty, tags LIMIT 20000`,
        )
        .map((f) => ({ ...f, tags: tagIds(f.tags) }));
      const tags = sql.all<{ id: number; name: string }>("SELECT id, name FROM tags ORDER BY name LIMIT 5000");
      const day = sql.get<{ id: number; on_date: string; title: string | null }>(
        `SELECT d.id, d.on_date, d.title FROM plan_days d JOIN plans p ON p.id = d.plan_id AND p.is_active = 1
         WHERE d.on_date >= ? AND EXISTS (SELECT 1 FROM plan_day_questions x WHERE x.day_id = d.id)
         ORDER BY d.on_date LIMIT 1`,
        [p.today],
      );
      const next = day
        ? {
            on_date: day.on_date,
            title: day.title,
            topics: sql.all<{ id: string; name: string; subject_id: string }>(
              `SELECT t.id, t.name, t.subject_id FROM plan_day_questions x
               JOIN questions q ON q.id = x.question_id JOIN topics t ON t.id = q.topic_id
               WHERE x.day_id = ? GROUP BY t.id ORDER BY min(x.position) LIMIT 20`,
              [day.id],
            ),
          }
        : null;
      return { topics, facets, tags, next };
    },
  ),

  /** The Programming tab: every code question with where you are with it (solved when its latest counted
   *  answer is right) and its tags. */
  "practice.programming": read(
    ["questions", "topics", "subjects", "question_tags", "tags", "question_answers"],
    (sql): PracticeCodeData => {
      const questions = sql
        .all<Omit<PracticeCode, "tags" | "state"> & { tags: string; latest: "correct" | "incorrect" | null }>(
          `SELECT q.id, substr(q.stem, 1, 600) AS stem, q.marks, q.difficulty, q.topic_id, t.name AS topic_name,
                  t.subject_id, s.name AS subject_name,
                  coalesce((SELECT group_concat(tag_id) FROM (SELECT tag_id FROM question_tags
                            WHERE question_id = q.id ORDER BY tag_id)), '') AS tags,
                  (SELECT outcome FROM question_answers WHERE question_id = q.id AND outcome <> 'skipped'
                   ORDER BY recorded_at DESC, id DESC LIMIT 1) AS latest
           FROM questions q JOIN topics t ON t.id = q.topic_id JOIN subjects s ON s.id = t.subject_id
           WHERE q.type = 'code' AND q.pool = 'practice' AND q.retired_at IS NULL
           ORDER BY s.position, s.name, t.position, t.name, q.created_at, q.id LIMIT 2000`,
        )
        .map(({ tags, latest, ...q }) => ({ ...q, tags: tagIds(tags), state: codeState(latest) }));
      const tags = sql.all<{ id: number; name: string }>("SELECT id, name FROM tags ORDER BY name LIMIT 5000");
      return { questions, tags };
    },
  ),

  /** The Mocks tab: the full-length mocks (with your best score), the history of every attempt, and the topics
   *  the subject / topic / weak-topics tests can draw from. */
  "practice.mocks": read(
    [
      "mocks",
      "mock_sections",
      "mock_items",
      "mock_attempts",
      "mock_attempt_items",
      "questions",
      "topics",
      "subjects",
      "topic_ratings",
    ],
    (sql): PracticeMocksData => ({
      mocks: sql.all<MockCard>(
        `SELECT m.id, m.name, m.instructions, m.minutes,
                (SELECT count(*) FROM mock_items i JOIN mock_sections s ON s.id = i.section_id
                 WHERE s.mock_id = m.id) AS questions,
                (SELECT coalesce(sum(q.marks), 0) FROM mock_items i JOIN mock_sections s ON s.id = i.section_id
                 JOIN questions q ON q.id = i.question_id WHERE s.mock_id = m.id) AS marks,
                (SELECT count(*) FROM mock_attempts a WHERE a.mock_id = m.id AND a.status = 'submitted') AS attempts,
                (SELECT max(a.score) FROM mock_attempts a WHERE a.mock_id = m.id AND a.status = 'submitted') AS best
         FROM mocks m WHERE m.retired_at IS NULL ORDER BY m.position, m.created_at, m.id LIMIT 200`,
      ),
      history: sql.all<MockHistoryRow>(
        `SELECT a.id, m.name, a.status, a.started_at, a.score, a.max_score,
                (SELECT count(*) FROM mock_attempt_items i WHERE i.attempt_id = a.id) AS questions
         FROM mock_attempts a JOIN mocks m ON m.id = a.mock_id ORDER BY a.started_at DESC, a.id LIMIT 100`,
      ),
      topics: sql.all<PracticeMocksData["topics"][number]>(
        `SELECT t.id, t.name, t.subject_id, s.name AS subject_name, r.rating
         FROM topics t JOIN subjects s ON s.id = t.subject_id LEFT JOIN topic_ratings r ON r.topic_id = t.id
         WHERE t.retired_at IS NULL
           AND EXISTS (SELECT 1 FROM questions q WHERE q.topic_id = t.id AND ${PRACTICE_Q})
         ${TOPIC_ORDER} LIMIT 2000`,
      ),
      practiceQuestions: sql.get<{ n: number }>(`SELECT count(*) AS n FROM questions q WHERE ${PRACTICE_Q}`)!.n,
    }),
  ),
};
