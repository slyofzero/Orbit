// Mock tests: building a short test, starting an attempt, saving responses as you go, warnings, submitting,
// ending, and loading an attempt (the exam and the review). Named queries (docs/STORAGE.md §2); how to write one:
// lib/db/queries/index.ts. The rules are in lib/exam.ts; what is recorded: docs/STATS.md §5.

import { read, write } from "@/lib/db/queries/core";
import { decode, insertSql } from "@/lib/db/codec";
import { DETAIL_TABLE } from "@/lib/db/queries/question";
import type { Sql } from "@/lib/db/sql";
import {
  BUILT_NAME,
  BUILT_SIZE,
  builtMinutes,
  cleanResponse,
  failsAfter,
  gradeResponse,
  outcomeOfGrade,
  pickQuestions,
  scoreOf,
  type AttemptData,
  type BuiltKind,
  type MockIntro,
} from "@/lib/exam";
import type { QuestionDetail } from "@/lib/questions";
import type { MockAttemptItemRow, MockAttemptRow, QuestionRow, QuestionType } from "@/types/tables";

/** The most questions one attempt holds. */
const ATTEMPT_MAX = 500;
const rid = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
const OPEN_ERROR = "Another test is still in progress. Finish it or end it first (Practice → Mocks).";

function attemptRow(sql: Sql, id: string): MockAttemptRow | null {
  const row = sql.get("SELECT * FROM mock_attempts WHERE id = ?", [id]);
  return row ? decode<MockAttemptRow>("mock_attempts", row) : null;
}

/** Every question of an attempt with its type row and saved response, in the attempt's order. */
function attemptItems(sql: Sql, attemptId: string): AttemptData["items"] {
  const rows = sql.all(`SELECT * FROM mock_attempt_items WHERE attempt_id = ? ORDER BY position LIMIT ${ATTEMPT_MAX}`, [
    attemptId,
  ]);
  const questions = new Map<string, QuestionRow>();
  for (const q of sql.all<QuestionRow>(
    `SELECT q.* FROM questions q JOIN mock_attempt_items i ON i.question_id = q.id WHERE i.attempt_id = ?
     LIMIT ${ATTEMPT_MAX}`,
    [attemptId],
  ))
    questions.set(q.id, q);
  const details = new Map<string, QuestionDetail>();
  for (const [type, table] of Object.entries(DETAIL_TABLE) as [QuestionType, string][])
    for (const d of sql.all<{ question_id: string }>(
      `SELECT d.* FROM ${table} d JOIN mock_attempt_items i ON i.question_id = d.question_id
       WHERE i.attempt_id = ? LIMIT ${ATTEMPT_MAX}`,
      [attemptId],
    ))
      if (questions.get(d.question_id)?.type === type)
        details.set(d.question_id, decode<QuestionDetail>(DETAIL_TABLE[type], d));
  const out: AttemptData["items"] = [];
  for (const r of rows) {
    const item = decode<MockAttemptItemRow>("mock_attempt_items", r);
    const question = questions.get(item.question_id);
    const detail = details.get(item.question_id);
    if (question && detail) out.push({ item, question, detail });
  }
  return out;
}

/** Writes the active time of each question (ms, from the exam screen's clock). */
function saveTimes(sql: Sql, attemptId: string, times: Record<string, number>) {
  for (const [questionId, ms] of Object.entries(times).slice(0, ATTEMPT_MAX))
    sql.run("UPDATE mock_attempt_items SET time_ms = ? WHERE attempt_id = ? AND question_id = ?", [
      Math.max(0, Math.round(ms)),
      attemptId,
      questionId,
    ]);
}

export const mockQueries = {
  /** The test in progress, if any (only one at a time): the Mocks tab offers to resume it. */
  "mock.open": read(["mock_attempts", "mocks"], (sql): { id: string; name: string } | null => {
    return (
      sql.get<{ id: string; name: string }>(
        `SELECT a.id, m.name FROM mock_attempts a JOIN mocks m ON m.id = a.mock_id
         WHERE a.status = 'in_progress' LIMIT 1`,
      ) ?? null
    );
  }),

  /** The instructions page: the mock, its sections with counts and marks, and any test already in progress. */
  "mock.intro": read(
    ["mocks", "mock_sections", "mock_items", "questions", "mock_attempts"],
    (sql, p: { mockId: string }): MockIntro => {
      const raw = sql.get("SELECT id, name, instructions, minutes, full_screen FROM mocks WHERE id = ?", [p.mockId]);
      const open =
        sql.get<{ id: string; name: string }>(
          `SELECT a.id, m.name FROM mock_attempts a JOIN mocks m ON m.id = a.mock_id
           WHERE a.status = 'in_progress' LIMIT 1`,
        ) ?? null;
      if (!raw) return { mock: null, sections: [], questions: 0, marks: 0, code: 0, open };
      const sections = sql.all<MockIntro["sections"][number]>(
        `SELECT s.name, s.minutes, count(q.id) AS questions,
                coalesce(sum(CASE WHEN q.type <> 'code' THEN q.marks END), 0) AS marks
         FROM mock_sections s LEFT JOIN mock_items i ON i.section_id = s.id
         LEFT JOIN questions q ON q.id = i.question_id
         WHERE s.mock_id = ? GROUP BY s.id ORDER BY s.position LIMIT 50`,
        [p.mockId],
      );
      const code = sql.get<{ n: number }>(
        `SELECT count(*) AS n FROM mock_items i JOIN mock_sections s ON s.id = i.section_id
         JOIN questions q ON q.id = i.question_id WHERE s.mock_id = ? AND q.type = 'code'`,
        [p.mockId],
      )!.n;
      return {
        mock: decode<NonNullable<MockIntro["mock"]>>("mocks", raw),
        sections,
        questions: sections.reduce((n, s) => n + s.questions, 0),
        marks: Math.round(sections.reduce((n, s) => n + s.marks, 0) * 100) / 100,
        code,
        open,
      };
    },
  ),

  /** Makes a short test from practice questions (not code, not mock-only): one subject, one topic, the topics you
   *  rate "No idea" / "Shaky", or a quick mix over every subject. Never-answered questions come first. It is saved
   *  as a hidden (retired) mock so its attempts have one. Returns the mock's id, or null when nothing matches. */
  "mock.build": write(
    ["mocks", "mock_sections", "mock_items"],
    (sql, p: { kind: BuiltKind; subjectId?: string; topicId?: string }): string | null => {
      const where = ["q.type <> 'code'", "q.pool = 'practice'", "q.retired_at IS NULL", "t.retired_at IS NULL"];
      const params: string[] = [];
      let label = "";
      if (p.kind === "subject") {
        where.push("t.subject_id = ?");
        params.push(p.subjectId ?? "");
        label = sql.get<{ name: string }>("SELECT name FROM subjects WHERE id = ?", [p.subjectId ?? ""])?.name ?? "";
      } else if (p.kind === "topic") {
        where.push("t.id = ?");
        params.push(p.topicId ?? "");
        label = sql.get<{ name: string }>("SELECT name FROM topics WHERE id = ?", [p.topicId ?? ""])?.name ?? "";
      } else if (p.kind === "weak") {
        where.push("coalesce((SELECT rating FROM topic_ratings r WHERE r.topic_id = t.id), 'no_idea') <> 'know'");
      }
      const pool = sql.all<{ id: string; marks: number; subject_id: string; seen: number }>(
        `SELECT q.id, q.marks, t.subject_id,
                EXISTS (SELECT 1 FROM question_answers a WHERE a.question_id = q.id AND a.outcome <> 'skipped') AS seen
         FROM questions q JOIN topics t ON t.id = q.topic_id WHERE ${where.join(" AND ")} LIMIT 5000`,
        params,
      );
      const picked = pickQuestions(
        pool.map((q) => ({ ...q, seen: q.seen === 1 })),
        BUILT_SIZE[p.kind],
        p.kind === "quick",
      );
      if (picked.length === 0) return null;

      const now = Date.now();
      const id = rid("mk");
      const name = label ? `${BUILT_NAME[p.kind]}: ${label}` : BUILT_NAME[p.kind];
      const ins = insertSql("mocks", {
        id,
        pack_id: null,
        name,
        instructions: null,
        minutes: builtMinutes(picked.reduce((n, q) => n + q.marks, 0)),
        full_screen: false,
        position: 0,
        legacy_id: null,
        created_at: now,
        updated_at: now,
        retired_at: now, // hidden from the full-length list; past attempts still find it
      });
      sql.run(ins.query, ins.params);
      const sectionId = sql.get<{ id: number }>(
        "INSERT INTO mock_sections (mock_id, name, position, minutes) VALUES (?, ?, 1, NULL) RETURNING id",
        [id, BUILT_NAME[p.kind]],
      )!.id;
      picked.forEach((q, i) =>
        sql.run("INSERT INTO mock_items (section_id, question_id, position) VALUES (?, ?, ?)", [
          sectionId,
          q.id,
          i + 1,
        ]),
      );
      return id;
    },
  ),

  /** Starts an attempt: copies the mock's sections and questions in, opens the first question, starts the clock.
   *  Refused while another test is in progress. Returns the attempt's id. */
  "mock.start": write(["mock_attempts", "mock_attempt_items"], (sql, p: { mockId: string }): string => {
    if (sql.get("SELECT 1 FROM mock_attempts WHERE status = 'in_progress'")) throw new Error(OPEN_ERROR);
    const mock = sql.get<{ minutes: number }>("SELECT minutes FROM mocks WHERE id = ?", [p.mockId]);
    if (!mock) throw new Error("That mock test isn't there any more.");
    const sections = sql.all<{ id: number; name: string; minutes: number | null }>(
      "SELECT id, name, minutes FROM mock_sections WHERE mock_id = ? ORDER BY position LIMIT 50",
      [p.mockId],
    );
    const items = sql.all<{ question_id: string; section_id: number }>(
      `SELECT i.question_id, i.section_id FROM mock_items i JOIN mock_sections s ON s.id = i.section_id
       JOIN questions q ON q.id = i.question_id
       WHERE s.mock_id = ? ORDER BY s.position, i.position LIMIT ${ATTEMPT_MAX}`,
      [p.mockId],
    );
    if (items.length === 0) throw new Error("This mock has no questions.");

    const id = rid("at");
    const ins = insertSql("mock_attempts", {
      id,
      mock_id: p.mockId,
      status: "in_progress",
      sections: sections.map((s) => ({ name: s.name, minutes: s.minutes })),
      minutes: mock.minutes,
      started_at: Date.now(),
      ended_at: null,
      current: 0,
      warnings: 0,
      failed_reason: null,
      score: null,
      max_score: null,
    });
    sql.run(ins.query, ins.params);
    const sectionIndex = new Map(sections.map((s, i) => [s.id, i]));
    items.forEach((it, position) =>
      sql.run(
        `INSERT INTO mock_attempt_items (attempt_id, question_id, section, position, visited)
         VALUES (?, ?, ?, ?, ?)`,
        [id, it.question_id, sectionIndex.get(it.section_id) ?? 0, position, position === 0 ? 1 : 0],
      ),
    );
    return id;
  }),

  /** One attempt with every question (the exam screen and the review). */
  "mock.attempt": read(
    [
      "mock_attempts",
      "mock_attempt_items",
      "mocks",
      "questions",
      "question_mcq",
      "question_msq",
      "question_nat",
      "question_str",
      "question_code",
    ],
    (sql, p: { attemptId: string }): AttemptData => {
      const attempt = attemptRow(sql, p.attemptId);
      if (!attempt) return { attempt: null, mock: null, items: [] };
      const m = sql.get("SELECT id, name, instructions, full_screen FROM mocks WHERE id = ?", [attempt.mock_id]);
      return {
        attempt,
        mock: m ? decode<NonNullable<AttemptData["mock"]>>("mocks", m) : null,
        items: attemptItems(sql, p.attemptId),
      };
    },
  ),

  /** Saves what changed while answering: the question on screen and, per question, any of its response, visited,
   *  marked and active time. Fields left out stay as they are. Ignored once the attempt has ended. */
  "mock.save": write(
    ["mock_attempts", "mock_attempt_items"],
    (
      sql,
      p: {
        attemptId: string;
        current?: number;
        items: {
          questionId: string;
          response?: { choice: number[] | null; typed: string | null };
          visited?: boolean;
          marked?: boolean;
          timeMs?: number;
        }[];
      },
    ): boolean => {
      const a = attemptRow(sql, p.attemptId);
      if (!a || a.status !== "in_progress") return false;
      if (p.current !== undefined)
        sql.run("UPDATE mock_attempts SET current = ? WHERE id = ?", [Math.max(0, p.current), p.attemptId]);
      for (const it of p.items.slice(0, ATTEMPT_MAX)) {
        const q = sql.get<{ type: QuestionType }>("SELECT type FROM questions WHERE id = ?", [it.questionId]);
        if (!q) continue;
        const where = [p.attemptId, it.questionId];
        if (it.response) {
          const r = cleanResponse(q.type, it.response);
          sql.run("UPDATE mock_attempt_items SET choice = ?, typed = ? WHERE attempt_id = ? AND question_id = ?", [
            r.choice ? JSON.stringify(r.choice) : null,
            r.typed,
            ...where,
          ]);
        }
        if (it.visited !== undefined)
          sql.run("UPDATE mock_attempt_items SET visited = ? WHERE attempt_id = ? AND question_id = ?", [
            it.visited ? 1 : 0,
            ...where,
          ]);
        if (it.marked !== undefined)
          sql.run("UPDATE mock_attempt_items SET marked = ? WHERE attempt_id = ? AND question_id = ?", [
            it.marked ? 1 : 0,
            ...where,
          ]);
        if (it.timeMs !== undefined) saveTimes(sql, p.attemptId, { [it.questionId]: it.timeMs });
      }
      return true;
    },
  ),

  /** Counts one exit from full screen. The first warns; one more fails the attempt (lib/exam.ts). */
  "mock.warn": write(
    ["mock_attempts", "mock_attempt_items"],
    (sql, p: { attemptId: string; times: Record<string, number> }): { warnings: number; failed: boolean } => {
      const a = attemptRow(sql, p.attemptId);
      if (!a || a.status !== "in_progress") return { warnings: a?.warnings ?? 0, failed: a?.status === "failed" };
      const warnings = a.warnings + 1;
      sql.run("UPDATE mock_attempts SET warnings = ? WHERE id = ?", [warnings, p.attemptId]);
      if (!failsAfter(warnings)) return { warnings, failed: false };
      saveTimes(sql, p.attemptId, p.times);
      sql.run("UPDATE mock_attempts SET status = 'failed', ended_at = ?, failed_reason = ? WHERE id = ?", [
        Date.now(),
        "Full screen was left a second time.",
        p.attemptId,
      ]);
      return { warnings, failed: true };
    },
  ),

  /** Submits: grades every question, stores the marks and the score, then writes one `question_answers` row per
   *  visited question (attempt set; code questions as skipped). Unvisited questions write nothing (docs/STATS.md
   *  §5). Submitting twice does nothing the second time. Returns the score. */
  "mock.submit": write(
    ["mock_attempts", "mock_attempt_items", "question_answers"],
    (sql, p: { attemptId: string; times: Record<string, number> }): { score: number; max: number } => {
      const a = attemptRow(sql, p.attemptId);
      if (!a) throw new Error("That attempt isn't there any more.");
      if (a.status !== "in_progress") return { score: a.score ?? 0, max: a.max_score ?? 0 };
      saveTimes(sql, p.attemptId, p.times);
      const items = attemptItems(sql, p.attemptId);
      const graded = items.map(({ item, question, detail }) => ({
        item,
        question,
        grade: gradeResponse(question, detail, item),
      }));
      for (const g of graded)
        sql.run("UPDATE mock_attempt_items SET marks = ? WHERE attempt_id = ? AND question_id = ?", [
          g.grade.marks,
          p.attemptId,
          g.item.question_id,
        ]);
      const { score, max } = scoreOf(
        graded.map((g) => ({ type: g.question.type, full: g.question.marks, marks: g.grade.marks })),
      );
      const now = Date.now();
      sql.run("UPDATE mock_attempts SET status = 'submitted', ended_at = ?, score = ?, max_score = ? WHERE id = ?", [
        now,
        score,
        max,
        p.attemptId,
      ]);
      for (const g of graded) {
        if (!g.item.visited) continue;
        sql.run(
          `INSERT INTO question_answers (question_id, recorded_at, outcome, time_ms, attempt_id)
           VALUES (?, ?, ?, ?, ?)`,
          [g.item.question_id, now, outcomeOfGrade(g.grade), g.item.time_ms, p.attemptId],
        );
      }
      return { score, max };
    },
  ),

  /** Ends an attempt without scoring it: you quit (abandoned) or broke a rule (failed, with the reason). Nothing is
   *  written to `question_answers`. */
  "mock.end": write(
    ["mock_attempts", "mock_attempt_items"],
    (
      sql,
      p: { attemptId: string; status: "abandoned" | "failed"; reason?: string; times: Record<string, number> },
    ): boolean => {
      const a = attemptRow(sql, p.attemptId);
      if (!a || a.status !== "in_progress") return false;
      saveTimes(sql, p.attemptId, p.times);
      sql.run("UPDATE mock_attempts SET status = ?, ended_at = ?, failed_reason = ? WHERE id = ?", [
        p.status,
        Date.now(),
        p.status === "failed" ? p.reason || "A rule of the test was broken." : null,
        p.attemptId,
      ]);
      return true;
    },
  ),
};
