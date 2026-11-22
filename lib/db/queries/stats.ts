// Stats: the Overview, Subjects & topics and Questions tabs of /stats.
// Named queries (docs/STORAGE.md §2); how to write one: lib/db/queries/index.ts. The rules (strength, streaks,
// the daily bars) are in lib/stats.ts and docs/STATS.md.

import { read, write } from "@/lib/db/queries/core";
import { addDays, type IsoDate } from "@/lib/dates";
import {
  MASTERED_STREAK,
  STATS_PAGE,
  addCounts,
  fillDays,
  rankStrength,
  streakOf,
  streaks,
  strengths,
  type HistoryEntry,
  type QuestionHistory,
  type AnswerCounts,
  type CountedAnswer,
  type DayActivity,
  type QuestionShow,
  type QuestionSort,
  type StatsQuestion,
  type StatsSubject,
  type StatsSummary,
  type StatsTopic,
} from "@/lib/stats";

const DAYS = 14;
/** The sums every count row needs, over `question_answers a`. */
const COUNTS = `count(*) AS shown, coalesce(sum(a.outcome = 'correct'), 0) AS correct,
  coalesce(sum(a.outcome = 'incorrect'), 0) AS incorrect, coalesce(sum(a.outcome = 'skipped'), 0) AS skipped,
  coalesce(sum(a.time_ms), 0) AS time_ms,
  coalesce(sum(CASE WHEN a.outcome <> 'skipped' THEN a.time_ms ELSE 0 END), 0) AS answered_ms,
  max(a.recorded_at) AS last_at`;
const ZERO: AnswerCounts = {
  shown: 0,
  correct: 0,
  incorrect: 0,
  skipped: 0,
  time_ms: 0,
  answered_ms: 0,
  last_at: null,
};

const SORT: Record<QuestionSort, string> = {
  recent: "agg.last_at DESC",
  time: "agg.time_ms DESC, agg.last_at DESC",
  wrong: "agg.incorrect DESC, agg.last_at DESC",
  // lowest accuracy first; questions never answered (only skipped) last
  accuracy:
    "(agg.correct + agg.incorrect) = 0, 1.0 * agg.correct / max(1, agg.correct + agg.incorrect), agg.incorrect DESC",
  shown: "agg.shown DESC, agg.last_at DESC",
};

export const statsQueries = {
  /** Everything the Overview and Subjects & topics tabs show: totals, the last 14 days, every subject and topic
   *  with its counts, time and strength, and the strongest / weakest topics. Answers to retired questions still
   *  count (history is kept); the question totals (`total`, `tried`) count live PRACTICE questions only (what
   *  Practice shows: topic practice + Programming; mock-only questions are left out, though answers to them count). */
  "stats.summary": read(
    ["question_answers", "questions", "topics", "subjects"],
    (sql, p: { today: IsoDate }): StatsSummary => {
      const now = Date.now();
      const t = sql.get<AnswerCounts & { mock_answers: number }>(
        `SELECT ${COUNTS}, coalesce(sum(a.attempt_id IS NOT NULL AND a.outcome <> 'skipped'), 0) AS mock_answers
         FROM question_answers a`,
      )!;

      const from = Date.parse(`${addDays(p.today, -(DAYS - 1))}T00:00:00+05:30`);
      const to = Date.parse(`${p.today}T00:00:00+05:30`) + 86_400_000;
      const days = fillDays(
        sql.all<DayActivity>(
          `SELECT date(recorded_at / 1000, 'unixepoch', '+330 minutes') AS day, sum(outcome <> 'skipped') AS answered,
                  sum(outcome = 'correct') AS correct, sum(time_ms) AS time_ms
           FROM question_answers WHERE recorded_at >= ? AND recorded_at < ? GROUP BY day LIMIT ${DAYS + 2}`,
          [from, to],
        ),
        p.today,
        DAYS,
      );

      const topics = sql
        .all<Omit<StatsTopic, "strength">>(
          `WITH ans AS (SELECT q.topic_id, ${COUNTS} FROM question_answers a JOIN questions q ON q.id = a.question_id
                        GROUP BY q.topic_id),
                -- each live practice question with its latest counted answer and whether it was ever shown
                pq AS (SELECT q.topic_id, q.type,
                              (SELECT outcome FROM question_answers x WHERE x.question_id = q.id
                               AND x.outcome <> 'skipped' ORDER BY x.recorded_at DESC, x.id DESC LIMIT 1) AS latest,
                              EXISTS (SELECT 1 FROM question_answers x WHERE x.question_id = q.id) AS seen
                       FROM questions q WHERE q.retired_at IS NULL AND q.pool = 'practice'),
                qs AS (SELECT topic_id, count(*) AS total, sum(type <> 'code') AS practice,
                              sum(latest IS NOT NULL) AS tried, sum(latest = 'correct') AS q_right,
                              sum(latest = 'incorrect') AS q_wrong, sum(latest IS NULL AND seen) AS q_skipped
                       FROM pq GROUP BY topic_id)
           SELECT t.id, t.name, t.subject_id, s.name AS subject_name,
                  coalesce(qs.total, 0) AS total, coalesce(qs.practice, 0) AS practice, coalesce(qs.tried, 0) AS tried,
                  coalesce(qs.q_right, 0) AS q_right, coalesce(qs.q_wrong, 0) AS q_wrong,
                  coalesce(qs.q_skipped, 0) AS q_skipped,
                  coalesce(ans.shown, 0) AS shown, coalesce(ans.correct, 0) AS correct,
                  coalesce(ans.incorrect, 0) AS incorrect, coalesce(ans.skipped, 0) AS skipped,
                  coalesce(ans.time_ms, 0) AS time_ms, coalesce(ans.answered_ms, 0) AS answered_ms, ans.last_at
           FROM topics t JOIN subjects s ON s.id = t.subject_id
           LEFT JOIN qs ON qs.topic_id = t.id LEFT JOIN ans ON ans.topic_id = t.id
           WHERE t.retired_at IS NULL AND (qs.total > 0 OR ans.shown > 0)
           ORDER BY s.position, s.name, t.position, t.name LIMIT 2000`,
        )
        .map((x) => ({ ...x, strength: null as number | null }));

      // strength and streaks need every counted answer, with its question's topic, subject and difficulty
      const counted = sql.all<Omit<CountedAnswer, "group"> & { topic: string; subject: string; live: number }>(
        `SELECT a.question_id, q.topic_id AS topic, t.subject_id AS subject, q.difficulty, a.outcome, a.recorded_at,
                q.retired_at IS NULL AS live
         FROM question_answers a JOIN questions q ON q.id = a.question_id JOIN topics t ON t.id = q.topic_id
         WHERE a.outcome <> 'skipped' LIMIT 200000`,
      );
      const byTopic = strengths(
        counted.map((a) => ({ ...a, group: a.topic })),
        now,
      );
      const bySubject = strengths(
        counted.map((a) => ({ ...a, group: a.subject })),
        now,
      );
      for (const x of topics) x.strength = byTopic.by.get(x.id) ?? null;

      const subjects = new Map<string, StatsSubject>();
      for (const x of topics) {
        const s = subjects.get(x.subject_id) ?? {
          ...ZERO,
          id: x.subject_id,
          name: x.subject_name,
          total: 0,
          tried: 0,
          q_right: 0,
          q_wrong: 0,
          q_skipped: 0,
          strength: bySubject.by.get(x.subject_id) ?? null,
        };
        addCounts(s, x);
        s.total += x.total;
        s.tried += x.tried;
        s.q_right += x.q_right;
        s.q_wrong += x.q_wrong;
        s.q_skipped += x.q_skipped;
        subjects.set(x.subject_id, s);
      }

      const streak = streaks(counted.filter((a) => a.live));
      let mastered = 0;
      let mistakes = 0;
      for (const n of streak.values()) {
        if (n >= MASTERED_STREAK) mastered++;
        if (n === 0) mistakes++;
      }

      const ranked = rankStrength(
        topics.map((x) => ({ ...x, answered: x.correct + x.incorrect, coverage: x.total ? x.tried / x.total : 0 })),
      );
      return {
        totals: {
          ...t,
          total: topics.reduce((n, x) => n + x.total, 0),
          tried: topics.reduce((n, x) => n + x.tried, 0),
          mastered,
          mistakes,
        },
        overall: byTopic.overall,
        days,
        subjects: [...subjects.values()],
        topics,
        strongest: ranked.strongest,
        weakest: ranked.weakest,
      };
    },
  ),

  /** The Questions tab: one page of the live questions you have been shown, with their counts, time and latest
   *  counted answer. `show: "mistakes"` = the mistake log (latest counted answer wrong, docs/STATS.md §4).
   *  `matched` = how many rows all pages hold. */
  "stats.questions": read(
    ["question_answers", "questions", "topics", "subjects"],
    (
      sql,
      p: {
        subjectId?: string | null;
        topicId?: string | null;
        show?: QuestionShow;
        sort?: QuestionSort;
        limit?: number;
        offset?: number;
      },
    ): { rows: StatsQuestion[]; matched: number } => {
      const where = ["q.retired_at IS NULL"];
      const args: (string | number)[] = [];
      if (p.subjectId) {
        where.push("t.subject_id = ?");
        args.push(p.subjectId);
      }
      if (p.topicId) {
        where.push("q.topic_id = ?");
        args.push(p.topicId);
      }
      if (p.show === "mistakes") where.push("lat.outcome = 'incorrect'");
      const from = `FROM agg JOIN questions q ON q.id = agg.question_id JOIN topics t ON t.id = q.topic_id
         JOIN subjects s ON s.id = t.subject_id LEFT JOIN lat ON lat.question_id = q.id
         WHERE ${where.join(" AND ")}`;
      const ctes = `WITH agg AS (SELECT a.question_id, ${COUNTS} FROM question_answers a GROUP BY a.question_id),
         lat AS (SELECT question_id, outcome FROM (
                   SELECT question_id, outcome,
                          row_number() OVER (PARTITION BY question_id ORDER BY recorded_at DESC, id DESC) AS rn
                   FROM question_answers WHERE outcome <> 'skipped') WHERE rn = 1)`;
      const matched = sql.get<{ n: number }>(`${ctes} SELECT count(*) AS n ${from}`, args)!.n;
      const limit = Math.min(Math.max(1, Math.floor(p.limit ?? STATS_PAGE)), 200);
      const offset = Math.max(0, Math.floor(p.offset ?? 0));
      const rows = sql.all<StatsQuestion>(
        `${ctes}
         SELECT q.id, q.type, q.pool, substr(q.stem, 1, 600) AS stem, t.name AS topic_name, s.name AS subject_name,
                agg.shown, agg.correct, agg.incorrect, agg.skipped, agg.time_ms, agg.answered_ms, agg.last_at,
                lat.outcome AS latest
         ${from} ORDER BY ${SORT[p.sort ?? "recent"] ?? SORT.recent}, q.id LIMIT ${limit} OFFSET ${offset}`,
        args,
      );
      return { rows, matched };
    },
  ),

  /** "Clear stats": deletes every answer (practice and mock) and every finished mock attempt with its score.
   *  Through the schema's cascades, planned questions that were ticked by answering them are unticked, and
   *  `question_stats` empties (triggers). A mock still in progress, topic ratings, plan tasks and the questions
   *  themselves stay. Returns what went. */
  "stats.clear": write(["question_answers", "mock_attempts"], (sql): { answers: number; attempts: number } => {
    const answers = sql.get<{ n: number }>("SELECT count(*) AS n FROM question_answers")!.n;
    const attempts = sql.get<{ n: number }>("SELECT count(*) AS n FROM mock_attempts WHERE status <> 'in_progress'")!.n;
    sql.run("DELETE FROM question_answers");
    sql.run("DELETE FROM mock_attempts WHERE status <> 'in_progress'");
    return { answers, attempts };
  }),

  /** One question's history (the Questions tab's row dialog): the question with its totals, and every sitting it
   *  was shown in, newest first: right, wrong or unanswered, the time spent, practice or which mock. */
  "stats.history": read(
    ["question_answers", "questions", "topics", "subjects", "mock_attempts", "mocks"],
    (sql, p: { questionId: string }): QuestionHistory => {
      const question =
        sql.get<StatsQuestion>(
          `SELECT q.id, q.type, q.pool, q.stem, t.name AS topic_name, s.name AS subject_name, ${COUNTS},
                  (SELECT outcome FROM question_answers WHERE question_id = q.id AND outcome <> 'skipped'
                   ORDER BY recorded_at DESC, id DESC LIMIT 1) AS latest
           FROM questions q JOIN topics t ON t.id = q.topic_id JOIN subjects s ON s.id = t.subject_id
           LEFT JOIN question_answers a ON a.question_id = q.id
           WHERE q.id = ? GROUP BY q.id`,
          [p.questionId],
        ) ?? null;
      if (!question) return { question: null, entries: [], streak: 0 };
      const entries = sql.all<HistoryEntry>(
        `SELECT a.id, a.recorded_at, a.outcome, a.time_ms, a.attempt_id, m.name AS mock_name
         FROM question_answers a LEFT JOIN mock_attempts x ON x.id = a.attempt_id LEFT JOIN mocks m ON m.id = x.mock_id
         WHERE a.question_id = ? ORDER BY a.recorded_at DESC, a.id DESC LIMIT 500`,
        [p.questionId],
      );
      const counted = entries.filter((e) => e.outcome !== "skipped").map((e) => e.outcome as "correct" | "incorrect");
      // with no answers at all the LEFT JOIN still makes one row: count(*) = 1
      if (!entries.length) Object.assign(question, ZERO);
      return { question, entries, streak: streakOf(counted) };
    },
  ),
};
