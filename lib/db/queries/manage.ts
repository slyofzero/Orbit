// Manage pack (/practice/manage, v1's PackManager): list, edit, add and remove questions, topics, subjects and
// packs, and export them. Named queries (docs/STORAGE.md §2); how to write one: lib/db/queries/index.ts.
// Rules (form ↔ file question, export) are in lib/manage.ts.
// Removing follows db/schema.sql: content that anything refers to (answers, mock attempts, ticked plan days) is
// retired (retired_at set, hidden everywhere), never deleted; content nothing refers to is deleted.

import { read, write } from "@/lib/db/queries/core";
import { decode, insertSql } from "@/lib/db/codec";
import type { Sql, TableName } from "@/lib/db/sql";
import { DETAIL_TABLE } from "@/lib/db/queries/question";
import {
  QUESTION_BANKS,
  checkForm,
  exportFile,
  type ExportMock,
  type ExportQuestion,
  type QuestionBank,
  type QuestionForm,
} from "@/lib/manage";
import { LIMITS, QUESTION_TYPES, questionHash, type FileQuestion } from "@/lib/questionFile";
import type { QuestionDetail } from "@/lib/questions";
import type { QuestionRow, QuestionType, TopicRating } from "@/types/tables";

const rid = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
const RATINGS: readonly TopicRating[] = ["know", "shaky", "no_idea"];
const DETAIL_TABLES = Object.values(DETAIL_TABLE) as TableName[];
/** The most rows any list here returns. */
const MAX_ROWS = 2000;
/** Subjects then topics in the order the owner gave them. */
const TOPIC_ORDER = "ORDER BY s.position, s.name, t.position, t.name";

type Fail = { ok: false; error: string };
const fail = (error: string): Fail => ({ ok: false, error });

function insert(sql: Sql, table: TableName, row: Record<string, unknown>) {
  const ins = insertSql(table, row);
  sql.run(ins.query, ins.params);
}

/** Writes a question's type row and tags (after removing the old ones). */
function writeDetailAndTags(sql: Sql, id: string, q: FileQuestion) {
  for (const t of DETAIL_TABLES) sql.run(`DELETE FROM ${t} WHERE question_id = ?`, [id]);
  if (q.type === "mcq") insert(sql, "question_mcq", { question_id: id, options: q.options, correct: q.correct });
  else if (q.type === "msq") insert(sql, "question_msq", { question_id: id, options: q.options, correct: q.correct });
  else if (q.type === "nat") insert(sql, "question_nat", { question_id: id, value: q.value, tolerance: q.tolerance });
  else if (q.type === "str")
    insert(sql, "question_str", {
      question_id: id,
      match: q.match,
      case_sensitive: q.case_sensitive,
      accepted: q.accepted,
    });
  else insert(sql, "question_code", { question_id: id, starter: q.starter });
  sql.run("DELETE FROM question_tags WHERE question_id = ?", [id]);
  for (const name of q.tags) {
    const tag =
      sql.get<{ id: number }>("SELECT id FROM tags WHERE name = ? LIMIT 1", [name])?.id ??
      sql.get<{ id: number }>("INSERT INTO tags (name) VALUES (?) RETURNING id", [name])!.id;
    sql.run("INSERT OR IGNORE INTO question_tags (question_id, tag_id) VALUES (?, ?)", [id, tag]);
  }
}

/** Where a question sits in a (not retired) mock: the first one, in the Mocks tab's order. */
function placeOf(sql: Sql, id: string) {
  return (
    sql.get<{ mockId: string; mockName: string; sectionId: number; sectionName: string }>(
      `SELECT m.id AS mockId, m.name AS mockName, ms.id AS sectionId, ms.name AS sectionName
       FROM mock_items i JOIN mock_sections ms ON ms.id = i.section_id JOIN mocks m ON m.id = ms.mock_id
       WHERE i.question_id = ? AND m.retired_at IS NULL ORDER BY m.position, m.created_at, ms.position LIMIT 1`,
      [id],
    ) ?? null
  );
}

/** Takes a question out of the bank: out of every mock, off every plan day it isn't ticked on yet, then deleted,
 *  or retired when its history (answers, attempts, ticked plan days) refers to it. Returns true when retired. */
export function removeQuestion(sql: Sql, id: string, now: number): boolean {
  sql.run("DELETE FROM mock_items WHERE question_id = ?", [id]);
  sql.run(
    `DELETE FROM plan_day_questions WHERE question_id = ? AND NOT EXISTS (SELECT 1 FROM plan_question_ticks k
       WHERE k.day_id = plan_day_questions.day_id AND k.question_id = plan_day_questions.question_id)`,
    [id],
  );
  const kept = sql.get<{ n: number }>(
    `SELECT EXISTS (SELECT 1 FROM question_answers WHERE question_id = ?1)
         OR EXISTS (SELECT 1 FROM mock_attempt_items WHERE question_id = ?1)
         OR EXISTS (SELECT 1 FROM plan_day_questions WHERE question_id = ?1) AS n`,
    [id],
  )!.n;
  if (kept)
    sql.run("UPDATE questions SET retired_at = ?, updated_at = ? WHERE id = ? AND retired_at IS NULL", [now, now, id]);
  else sql.run("DELETE FROM questions WHERE id = ?", [id]);
  return kept === 1;
}

/** Takes a mock out: retired when it has attempts (their history refers to it), else deleted with its sections.
 *  Its mock-only questions that no other mock uses go too (they belonged to it). */
export function removeMock(sql: Sql, id: string, now: number): void {
  const own = sql
    .all<{ id: string }>(
      `SELECT DISTINCT q.id FROM mock_items i JOIN mock_sections ms ON ms.id = i.section_id
       JOIN questions q ON q.id = i.question_id WHERE ms.mock_id = ? AND q.pool = 'mock' LIMIT ${MAX_ROWS}`,
      [id],
    )
    .map((r) => r.id);
  if (sql.get("SELECT 1 FROM mock_attempts WHERE mock_id = ? LIMIT 1", [id])) {
    sql.run("UPDATE mocks SET retired_at = ?, updated_at = ? WHERE id = ? AND retired_at IS NULL", [now, now, id]);
    sql.run("DELETE FROM mock_items WHERE section_id IN (SELECT id FROM mock_sections WHERE mock_id = ?)", [id]);
  } else sql.run("DELETE FROM mocks WHERE id = ?", [id]);
  for (const q of own)
    if (
      !sql.get(
        `SELECT 1 FROM mock_items i JOIN mock_sections ms ON ms.id = i.section_id JOIN mocks m ON m.id = ms.mock_id
         WHERE i.question_id = ? AND m.retired_at IS NULL LIMIT 1`,
        [q],
      )
    )
      removeQuestion(sql, q, now);
}

/** Which questions each of the Questions tab's banks holds (lib/manage.ts QUESTION_BANKS). Every question is in
 *  exactly one: mock-only questions in Mock, code questions in Programming, the rest in Practice. */
const BANK_SQL: Record<QuestionBank, string> = {
  practice: "q.pool = 'practice' AND q.type <> 'code'",
  programming: "q.pool = 'practice' AND q.type = 'code'",
  mock: "q.pool = 'mock'",
};

/** The condition on `questions q` that picks what an export holds: one pack (its questions and every question
 *  its mocks use), or the whole bank. */
function exportWhere(packId: string | null): { where: string; params: string[] } {
  if (!packId) return { where: "q.retired_at IS NULL", params: [] };
  return {
    where: `q.retired_at IS NULL AND (q.pack_id = ?1 OR q.id IN (SELECT i.question_id FROM mock_items i
              JOIN mock_sections ms ON ms.id = i.section_id JOIN mocks m ON m.id = ms.mock_id
              WHERE m.pack_id = ?1 AND m.retired_at IS NULL))`,
    params: [packId],
  };
}

export const manageQueries = {
  /** The header and pickers of Manage pack: counts, subjects, topics (with how many questions use each and
   *  your rating) and the mocks with their sections (for the editor's Bank picker and the Bank filter). */
  "manage.overview": read(
    ["subjects", "topics", "topic_ratings", "questions", "mocks", "mock_sections", "mock_items", "packs"],
    (sql) => {
      const counts = sql.get<{
        practice: number;
        programming: number;
        mockQuestions: number;
        mocks: number;
        packs: number;
        total: number;
      }>(
        `SELECT
           (SELECT count(*) FROM questions WHERE pool = 'practice' AND type <> 'code' AND retired_at IS NULL) AS practice,
           (SELECT count(*) FROM questions WHERE pool = 'practice' AND type = 'code' AND retired_at IS NULL) AS programming,
           (SELECT count(*) FROM questions WHERE pool = 'mock' AND retired_at IS NULL) AS mockQuestions,
           (SELECT count(*) FROM mocks WHERE retired_at IS NULL) AS mocks,
           (SELECT count(*) FROM packs) AS packs,
           (SELECT count(*) FROM questions WHERE retired_at IS NULL) AS total`,
      )!;
      const subjects = sql.all<{ id: string; name: string }>(
        `SELECT s.id, s.name FROM subjects s
         WHERE EXISTS (SELECT 1 FROM topics t WHERE t.subject_id = s.id AND t.retired_at IS NULL)
         ORDER BY s.position, s.name LIMIT ${MAX_ROWS}`,
      );
      const topics = sql.all<{
        id: string;
        name: string;
        subject_id: string;
        subject_name: string;
        rating: TopicRating | null;
        questions: number;
      }>(
        `SELECT t.id, t.name, t.subject_id, s.name AS subject_name, r.rating,
                (SELECT count(*) FROM questions q WHERE q.topic_id = t.id AND q.retired_at IS NULL) AS questions
         FROM topics t JOIN subjects s ON s.id = t.subject_id LEFT JOIN topic_ratings r ON r.topic_id = t.id
         WHERE t.retired_at IS NULL ${TOPIC_ORDER} LIMIT ${MAX_ROWS}`,
      );
      const mocks = sql.all<{ id: string; name: string }>(
        `SELECT id, name FROM mocks WHERE retired_at IS NULL ORDER BY position, created_at, id LIMIT 200`,
      );
      const sections = sql.all<{ id: number; mock_id: string; name: string; questions: number }>(
        `SELECT ms.id, ms.mock_id, ms.name, (SELECT count(*) FROM mock_items i WHERE i.section_id = ms.id) AS questions
         FROM mock_sections ms JOIN mocks m ON m.id = ms.mock_id WHERE m.retired_at IS NULL
         ORDER BY ms.position, ms.id LIMIT ${MAX_ROWS}`,
      );
      return {
        counts: { ...counts, topics: topics.length },
        subjects,
        topics,
        mocks: mocks.map((m) => ({ ...m, sections: sections.filter((s) => s.mock_id === m.id) })),
      };
    },
  ),

  /** The Questions tab's table: questions (not retired) of one bank (practice · programming · mock; in Mock,
   *  optionally one mock) matching the search (in the id or the text) and the topic; an exact id first, then in the Topics tab's order. One page:
   *  `limit` rows after skipping `offset` (lib/manage.ts MANAGE_PAGE); `matched` counts every match, `total`
   *  every question of the bank. */
  "manage.questions": read(
    ["questions", "topics", "subjects", "mocks", "mock_sections", "mock_items"],
    (
      sql,
      p: {
        search: string;
        bank: QuestionBank;
        mockId: string | null;
        topicId: string | null;
        limit: number;
        offset: number;
      },
    ) => {
      if (!QUESTION_BANKS.includes(p.bank)) throw new Error(`manage.questions: unknown bank "${p.bank}"`);
      const needle = p.search.trim().toLowerCase();
      const conds = ["q.retired_at IS NULL", BANK_SQL[p.bank]];
      const params: string[] = [];
      if (p.bank === "mock" && p.mockId) {
        conds.push(`q.id IN (SELECT i.question_id FROM mock_items i JOIN mock_sections ms ON ms.id = i.section_id
                             WHERE ms.mock_id = ?)`);
        params.push(p.mockId);
      }
      if (p.topicId) {
        conds.push("q.topic_id = ?");
        params.push(p.topicId);
      }
      if (needle) {
        conds.push("(instr(lower(q.id), ?) > 0 OR instr(lower(q.stem), ?) > 0)");
        params.push(needle, needle);
      }
      const where = conds.join(" AND ");
      const from = "FROM questions q JOIN topics t ON t.id = q.topic_id JOIN subjects s ON s.id = t.subject_id";
      const limit = Math.max(1, Math.min(MAX_ROWS, Math.floor(p.limit) || 1));
      const offset = Math.max(0, Math.floor(p.offset) || 0);
      const rows = sql.all<{
        id: string;
        type: QuestionType;
        marks: number;
        negative_marks: number;
        difficulty: QuestionRow["difficulty"];
        stem: string;
        pool: QuestionRow["pool"];
        topic_name: string;
        subject_name: string;
        place: string | null;
      }>(
        `SELECT q.id, q.type, q.marks, q.negative_marks, q.difficulty, substr(q.stem, 1, 400) AS stem, q.pool,
                t.name AS topic_name, s.name AS subject_name,
                (SELECT m.name || ' · ' || ms.name FROM mock_items i JOIN mock_sections ms ON ms.id = i.section_id
                 JOIN mocks m ON m.id = ms.mock_id WHERE i.question_id = q.id AND m.retired_at IS NULL
                 ORDER BY m.position, m.created_at, ms.position LIMIT 1) AS place
         ${from} WHERE ${where}
         ORDER BY lower(q.id) = ? DESC, s.position, s.name, t.position, t.name, q.created_at, q.rowid LIMIT ${limit} OFFSET ${offset}`,
        [...params, needle],
      );
      const matched = sql.get<{ n: number }>(`SELECT count(*) AS n ${from} WHERE ${where}`, params)!.n;
      const total = sql.get<{ n: number }>(
        `SELECT count(*) AS n FROM questions q WHERE q.retired_at IS NULL AND ${BANK_SQL[p.bank]}`,
      )!.n;
      return { rows, matched, total };
    },
  ),

  /** One question for the editor: its row, type row, tags, where it sits in a mock, and how often it was
   *  answered. null when it is gone (deleted or retired). */
  "manage.question": read(
    [
      "questions",
      "question_mcq",
      "question_msq",
      "question_nat",
      "question_str",
      "question_code",
      "question_tags",
      "tags",
      "mocks",
      "mock_sections",
      "mock_items",
      "question_answers",
    ],
    (sql, p: { id: string }) => {
      const question = sql.get<QuestionRow>("SELECT * FROM questions WHERE id = ? AND retired_at IS NULL", [p.id]);
      if (!question) return null;
      const d = sql.get(`SELECT * FROM ${DETAIL_TABLE[question.type]} WHERE question_id = ?`, [p.id]);
      if (!d) return null;
      const tags = sql
        .all<{
          name: string;
        }>(
          "SELECT t.name FROM question_tags qt JOIN tags t ON t.id = qt.tag_id WHERE qt.question_id = ? ORDER BY t.name LIMIT 20",
          [p.id],
        )
        .map((t) => t.name);
      const answers = sql.get<{ n: number }>("SELECT count(*) AS n FROM question_answers WHERE question_id = ?", [
        p.id,
      ])!.n;
      return {
        question,
        detail: decode<QuestionDetail>(DETAIL_TABLE[question.type], d),
        tags,
        place: placeOf(sql, p.id),
        answers,
      };
    },
  ),

  /** Adds (id null) or saves a question from the editor (lib/manage.ts QuestionForm). Checked exactly like an
   *  import; on any problem nothing is written. `target` = a mock section (an existing one, or a new one by
   *  name) makes it a mock question there; null = Practice. Moving out of the mock it was shown in takes it out
   *  of that mock; a practice question that is also in a mock stays there when saved as Practice. */
  "manage.saveQuestion": write(
    ["questions", ...DETAIL_TABLES, "question_tags", "tags", "mocks", "mock_sections", "mock_items"],
    (
      sql,
      p: {
        id: string | null;
        form: QuestionForm;
        target: { mockId: string; sectionId: number | null; newSection: string } | null;
      },
    ): { ok: true; id: string } | { ok: false; errors: string[] } => {
      const no = (e: string) => ({ ok: false as const, errors: [e] });
      if (!QUESTION_TYPES.includes(p.form.type)) return no("Pick a question type.");
      const topic = sql.get<{ name: string; subject: string }>(
        `SELECT t.name, s.name AS subject FROM topics t JOIN subjects s ON s.id = t.subject_id
         WHERE t.id = ? AND t.retired_at IS NULL`,
        [p.form.topicId],
      );
      if (!topic) return no("Pick a topic.");
      const pool = p.target ? "mock" : "practice";
      const r = checkForm(p.form, topic.subject, topic.name, pool);
      if (!r.question) return { ok: false, errors: r.errors };
      const q = r.question;

      // the mock section it goes to
      let sectionId: number | null = null;
      let newSection: string | null = null;
      if (p.target) {
        const mock = sql.get<{ id: string }>("SELECT id FROM mocks WHERE id = ? AND retired_at IS NULL", [
          p.target.mockId,
        ]);
        if (!mock) return no("That mock test is gone. Pick another bank.");
        if (p.target.sectionId !== null) {
          sectionId =
            sql.get<{ id: number }>("SELECT id FROM mock_sections WHERE id = ? AND mock_id = ?", [
              p.target.sectionId,
              mock.id,
            ])?.id ?? null;
          if (sectionId === null) return no("That section is gone. Pick another one.");
        } else {
          newSection = p.target.newSection.trim();
          if (!newSection) return no("Give the mock section a name.");
          if (newSection.length > LIMITS.mockName)
            return no(`The section name is longer than ${LIMITS.mockName} characters.`);
          if (
            sql.get("SELECT 1 FROM mock_sections WHERE mock_id = ? AND lower(name) = lower(?)", [mock.id, newSection])
          )
            return no(`This mock already has a section called "${newSection}". Pick it from the list.`);
          const n = sql.get<{ n: number }>("SELECT count(*) AS n FROM mock_sections WHERE mock_id = ?", [mock.id])!.n;
          if (n >= LIMITS.sections) return no(`A mock can have at most ${LIMITS.sections} sections.`);
        }
      }

      const hash = questionHash(q);
      const same = sql.get<{ id: string }>(
        "SELECT id FROM questions WHERE content_hash = ? AND type = ? AND retired_at IS NULL AND id IS NOT ? LIMIT 1",
        [hash, q.type, p.id],
      );
      if (same) return no(`The same question (same words, same answer) is already in your bank: ${same.id}.`);

      const now = Date.now();
      let id: string;
      let wasMock = false;
      if (p.id === null) {
        id = rid("q");
        insert(sql, "questions", {
          id,
          type: q.type,
          topic_id: p.form.topicId,
          pack_id: null,
          pool,
          marks: q.marks,
          negative_marks: q.negative_marks,
          difficulty: q.difficulty,
          stem: q.stem,
          explanation: q.explanation,
          content_hash: hash,
          legacy_id: null,
          created_at: now,
          updated_at: now,
          retired_at: null,
        });
      } else {
        const old = sql.get<{ type: QuestionType; pool: string }>(
          "SELECT type, pool FROM questions WHERE id = ? AND retired_at IS NULL",
          [p.id],
        );
        if (!old) return no("This question is gone (deleted in another tab?). Close the editor.");
        if (old.type !== q.type)
          return no("A saved question keeps its type. To change it, add a new question and delete this one.");
        id = p.id;
        wasMock = old.pool === "mock";
        sql.run(
          `UPDATE questions SET topic_id = ?, pool = ?, marks = ?, negative_marks = ?, difficulty = ?, stem = ?,
             explanation = ?, content_hash = ?, updated_at = ? WHERE id = ?`,
          [p.form.topicId, pool, q.marks, q.negative_marks, q.difficulty, q.stem, q.explanation, hash, now, id],
        );
      }
      writeDetailAndTags(sql, id, q);

      // where it sits
      const from = p.id === null ? null : placeOf(sql, id);
      if (p.target) {
        if (newSection !== null) {
          const pos = sql.get<{ n: number }>(
            "SELECT coalesce(max(position), 0) + 1 AS n FROM mock_sections WHERE mock_id = ?",
            [p.target.mockId],
          )!.n;
          sectionId = sql.get<{ id: number }>(
            "INSERT INTO mock_sections (mock_id, name, position) VALUES (?, ?, ?) RETURNING id",
            [p.target.mockId, newSection, pos],
          )!.id;
        }
        const inMock = sql.get<{ section_id: number }>(
          `SELECT i.section_id FROM mock_items i JOIN mock_sections ms ON ms.id = i.section_id
           WHERE i.question_id = ? AND ms.mock_id = ?`,
          [id, p.target.mockId],
        );
        if (inMock?.section_id !== sectionId) {
          if (inMock)
            sql.run("DELETE FROM mock_items WHERE question_id = ? AND section_id = ?", [id, inMock.section_id]);
          else if (wasMock && from)
            sql.run("DELETE FROM mock_items WHERE question_id = ? AND section_id = ?", [id, from.sectionId]); // moved to another mock
          const pos = sql.get<{ n: number }>(
            "SELECT coalesce(max(position), 0) + 1 AS n FROM mock_items WHERE section_id = ?",
            [sectionId],
          )!.n;
          sql.run("INSERT INTO mock_items (section_id, question_id, position) VALUES (?, ?, ?)", [sectionId, id, pos]);
        }
        sql.run("UPDATE mocks SET updated_at = ? WHERE id = ?", [now, p.target.mockId]);
      } else if (wasMock && from) {
        sql.run("DELETE FROM mock_items WHERE question_id = ? AND section_id = ?", [id, from.sectionId]); // back to Practice
      }
      return { ok: true, id };
    },
  ),

  /** Deletes a question (v1's Delete), or retires it when its history needs it (see removeQuestion). */
  "manage.removeQuestion": write(["questions", "mock_items", "plan_day_questions"], (sql, p: { id: string }) => ({
    retired: removeQuestion(sql, p.id, Date.now()),
  })),

  /** Renames a subject. Names are unique (without case). */
  "manage.renameSubject": write(["subjects"], (sql, p: { id: string; name: string }): { ok: true } | Fail => {
    const name = p.name.trim();
    if (!name) return fail("Give the subject a name.");
    if (name.length > LIMITS.subject) return fail(`A subject name is at most ${LIMITS.subject} characters.`);
    if (sql.get("SELECT 1 FROM subjects WHERE lower(name) = lower(?) AND id <> ?", [name, p.id]))
      return fail(`There is already a subject called "${name}".`);
    sql.run("UPDATE subjects SET name = ? WHERE id = ?", [name, p.id]);
    return { ok: true };
  }),

  /** Adds a topic to a subject, or to a new subject (`subjectId` null, `newSubject` its name). A topic of the
   *  same name that was removed earlier comes back instead of a second one. */
  "manage.addTopic": write(
    ["subjects", "topics"],
    (sql, p: { subjectId: string | null; newSubject: string; name: string }): { ok: true; id: string } | Fail => {
      const name = p.name.trim();
      if (!name) return fail("Give the topic a name.");
      if (name.length > LIMITS.topic) return fail(`A topic name is at most ${LIMITS.topic} characters.`);
      let sid = p.subjectId;
      if (sid === null) {
        const sname = p.newSubject.trim();
        if (!sname) return fail("Pick a subject, or type a name for a new one.");
        if (sname.length > LIMITS.subject) return fail(`A subject name is at most ${LIMITS.subject} characters.`);
        sid =
          sql.get<{ id: string }>("SELECT id FROM subjects WHERE lower(name) = lower(?) LIMIT 1", [sname])?.id ?? null;
        if (sid === null) {
          sid = rid("sb");
          const pos = sql.get<{ n: number }>("SELECT coalesce(max(position), 0) + 1 AS n FROM subjects")!.n;
          sql.run("INSERT INTO subjects (id, name, position) VALUES (?, ?, ?)", [sid, sname, pos]);
        }
      } else if (!sql.get("SELECT 1 FROM subjects WHERE id = ?", [sid])) return fail("That subject is gone.");
      const old = sql.get<{ id: string; retired_at: number | null }>(
        "SELECT id, retired_at FROM topics WHERE subject_id = ? AND lower(name) = lower(?) LIMIT 1",
        [sid, name],
      );
      if (old && old.retired_at === null) return fail(`This subject already has a topic called "${name}".`);
      if (old) {
        sql.run("UPDATE topics SET retired_at = NULL, name = ? WHERE id = ?", [name, old.id]);
        return { ok: true, id: old.id };
      }
      const id = rid("tp");
      const pos = sql.get<{ n: number }>(
        "SELECT coalesce(max(position), 0) + 1 AS n FROM topics WHERE subject_id = ?",
        [sid],
      )!.n;
      sql.run("INSERT INTO topics (id, subject_id, name, position) VALUES (?, ?, ?, ?)", [id, sid, name, pos]);
      return { ok: true, id };
    },
  ),

  /** Renames a topic. Names are unique inside a subject (without case). */
  "manage.renameTopic": write(["topics"], (sql, p: { id: string; name: string }): { ok: true } | Fail => {
    const name = p.name.trim();
    if (!name) return fail("Give the topic a name.");
    if (name.length > LIMITS.topic) return fail(`A topic name is at most ${LIMITS.topic} characters.`);
    const t = sql.get<{ subject_id: string }>("SELECT subject_id FROM topics WHERE id = ?", [p.id]);
    if (!t) return fail("That topic is gone.");
    if (
      sql.get("SELECT 1 FROM topics WHERE subject_id = ? AND lower(name) = lower(?) AND id <> ?", [
        t.subject_id,
        name,
        p.id,
      ])
    )
      return fail(`This subject already has a topic called "${name}".`);
    sql.run("UPDATE topics SET name = ? WHERE id = ?", [name, p.id]);
    return { ok: true };
  }),

  /** Your rating of a topic (v1's Status: I know it · Shaky · No idea). */
  "manage.rateTopic": write(["topic_ratings"], (sql, p: { id: string; rating: TopicRating }) => {
    if (!RATINGS.includes(p.rating)) throw new Error(`manage.rateTopic: unknown rating "${p.rating}"`);
    sql.run(
      `INSERT INTO topic_ratings (topic_id, rating, updated_at) VALUES (?, ?, ?)
       ON CONFLICT (topic_id) DO UPDATE SET rating = excluded.rating, updated_at = excluded.updated_at`,
      [p.id, p.rating, Date.now()],
    );
    return p.rating;
  }),

  /** Removes a topic no question uses (v1: "A topic can only be deleted when no question uses it"). Retired
   *  when old (retired) questions still name it. */
  "manage.removeTopic": write(["topics"], (sql, p: { id: string }): { ok: true } | Fail => {
    if (sql.get("SELECT 1 FROM questions WHERE topic_id = ? AND retired_at IS NULL LIMIT 1", [p.id]))
      return fail("Questions still use this topic. Move or delete them first.");
    if (sql.get("SELECT 1 FROM questions WHERE topic_id = ? LIMIT 1", [p.id]))
      sql.run("UPDATE topics SET retired_at = ? WHERE id = ?", [Date.now(), p.id]);
    else sql.run("DELETE FROM topics WHERE id = ?", [p.id]);
    return { ok: true };
  }),

  /** Every imported pack, newest first, with what of it is still in the bank. */
  "manage.packs": read(["packs", "questions", "mocks"], (sql) =>
    sql.all<{
      id: string;
      name: string;
      file_name: string | null;
      imported_at: number;
      questions: number;
      mocks: number;
    }>(
      `SELECT p.id, p.name, p.file_name, p.imported_at,
              (SELECT count(*) FROM questions q WHERE q.pack_id = p.id AND q.retired_at IS NULL) AS questions,
              (SELECT count(*) FROM mocks m WHERE m.pack_id = p.id AND m.retired_at IS NULL) AS mocks
       FROM packs p ORDER BY p.imported_at DESC, p.id LIMIT 500`,
    ),
  ),

  /** Renames a pack. */
  "manage.renamePack": write(["packs"], (sql, p: { id: string; name: string }): { ok: true } | Fail => {
    const name = p.name.trim();
    if (!name) return fail("Give the pack a name.");
    if (name.length > LIMITS.name) return fail(`A pack name is at most ${LIMITS.name} characters.`);
    sql.run("UPDATE packs SET name = ?, updated_at = ? WHERE id = ?", [name, Date.now(), p.id]);
    return { ok: true };
  }),

  /** Manage pack's "Delete pack": empties the whole question bank in one go. Every pack, question, picture, mock,
   *  subject, topic, tag and rating is deleted, and with them all their history (answers, stats, mock attempts)
   *  and the questions linked to plan days. The plan itself (days, tasks, ticked tasks, milestones) stays.
   *  Returns what was deleted. 🔴 Can't be undone; the screen makes you type "delete pack" first. */
  "manage.deleteAll": write(
    [
      "question_answers",
      "mock_attempts",
      "plan_day_questions",
      "mocks",
      "questions",
      "images",
      "topic_ratings",
      "topics",
      "subjects",
      "tags",
      "packs",
    ],
    (sql) => {
      const n = (table: string) => sql.get<{ n: number }>(`SELECT count(*) AS n FROM ${table}`)!.n;
      const gone = { questions: n("questions"), mocks: n("mocks"), packs: n("packs") };
      // history first (it points at the questions), then content, children before parents
      sql.run("DELETE FROM question_answers");
      sql.run("DELETE FROM mock_attempts");
      sql.run("DELETE FROM plan_day_questions");
      sql.run("DELETE FROM mocks");
      sql.run("DELETE FROM questions");
      sql.run("DELETE FROM images");
      sql.run("DELETE FROM topic_ratings");
      sql.run("DELETE FROM topics");
      sql.run("DELETE FROM subjects");
      sql.run("DELETE FROM tags");
      sql.run("DELETE FROM packs");
      return gone;
    },
  ),

  /** Empties one bank of the Questions tab (its "Empty" button): every question in it is removed like a single
   *  Delete (deleted, or retired when answers, mock attempts or ticked plan days refer to it, so your stats and
   *  mock results stay). Emptying Mock also removes every mock test. Packs left with nothing are deleted, so their
   *  files can be imported again. Returns how many questions and mocks went. */
  "manage.emptyBank": write(
    ["questions", "mocks", "mock_items", "plan_day_questions", "packs"],
    (sql, p: { bank: QuestionBank }) => {
      if (!QUESTION_BANKS.includes(p.bank)) throw new Error(`manage.emptyBank: unknown bank "${p.bank}"`);
      const now = Date.now();
      // listed first: removing a mock already takes its own questions with it
      const qs = sql.all<{ id: string }>(
        `SELECT q.id FROM questions q WHERE q.retired_at IS NULL AND ${BANK_SQL[p.bank]} LIMIT 100000`,
      );
      let mocks = 0;
      if (p.bank === "mock")
        for (const m of sql.all<{ id: string }>("SELECT id FROM mocks WHERE retired_at IS NULL LIMIT 1000")) {
          removeMock(sql, m.id, now);
          mocks++;
        }
      for (const q of qs) removeQuestion(sql, q.id, now); // a no-op for one already gone
      sql.run(
        `DELETE FROM packs WHERE NOT EXISTS (SELECT 1 FROM questions q WHERE q.pack_id = packs.id AND q.retired_at IS NULL)
           AND NOT EXISTS (SELECT 1 FROM mocks m WHERE m.pack_id = packs.id AND m.retired_at IS NULL)`,
      );
      return { questions: qs.length, mocks };
    },
  ),

  /** Removes a pack: its questions and mocks (each deleted, or retired when history needs it), then the pack
   *  itself, so the same file can be imported again. Your answers and attempts stay. */
  "manage.removePack": write(
    ["packs", "questions", "mocks", "mock_items", "plan_day_questions"],
    (sql, p: { id: string }) => {
      const now = Date.now();
      const mocks = sql.all<{ id: string }>("SELECT id FROM mocks WHERE pack_id = ? AND retired_at IS NULL LIMIT 200", [
        p.id,
      ]);
      for (const m of mocks) removeMock(sql, m.id, now);
      const qs = sql.all<{ id: string }>(
        `SELECT id FROM questions WHERE pack_id = ? AND retired_at IS NULL LIMIT ${LIMITS.questions * 10}`,
        [p.id],
      );
      for (const q of qs) removeQuestion(sql, q.id, now);
      sql.run("DELETE FROM packs WHERE id = ?", [p.id]);
      return { questions: qs.length, mocks: mocks.length };
    },
  ),

  /** One pack (or the whole bank, packId null) as an "orbit-questions" file that imports again (lib/manage.ts
   *  exportFile). `tooBig` = more questions than one file may hold: the importer would refuse it whole. */
  "manage.export": read(
    [
      "packs",
      "subjects",
      "topics",
      "questions",
      "question_mcq",
      "question_msq",
      "question_nat",
      "question_str",
      "question_code",
      "question_tags",
      "tags",
      "mocks",
      "mock_sections",
      "mock_items",
    ],
    (sql, p: { packId: string | null }) => {
      const pack = p.packId ? sql.get<{ name: string }>("SELECT name FROM packs WHERE id = ?", [p.packId]) : null;
      if (p.packId && !pack) return null;
      const { where, params } = exportWhere(p.packId);
      const cap = LIMITS.questions * 10;
      const rows = sql.all<QuestionRow & { subject: string; topic: string }>(
        `SELECT q.*, s.name AS subject, t.name AS topic
         FROM questions q JOIN topics t ON t.id = q.topic_id JOIN subjects s ON s.id = t.subject_id
         WHERE ${where} ORDER BY s.position, s.name, t.position, t.name, q.created_at, q.rowid LIMIT ${cap}`,
        params,
      );
      const details = new Map<string, QuestionDetail>();
      for (const type of QUESTION_TYPES) {
        const table = DETAIL_TABLE[type];
        for (const d of sql.all<{ question_id: string }>(
          `SELECT d.* FROM ${table} d JOIN questions q ON q.id = d.question_id WHERE ${where} LIMIT ${cap}`,
          params,
        ))
          details.set(d.question_id, decode<QuestionDetail>(table, d));
      }
      const tags = new Map<string, string[]>();
      for (const t of sql.all<{ question_id: string; name: string }>(
        `SELECT qt.question_id, g.name FROM question_tags qt JOIN tags g ON g.id = qt.tag_id
         JOIN questions q ON q.id = qt.question_id WHERE ${where} ORDER BY g.name LIMIT ${cap * 8}`,
        params,
      ))
        tags.set(t.question_id, [...(tags.get(t.question_id) ?? []), t.name]);
      const questions: ExportQuestion[] = rows
        .filter((r) => details.has(r.id))
        .map((r) => ({
          id: r.id,
          subject: r.subject,
          topic: r.topic,
          question: r,
          detail: details.get(r.id)!,
          tags: tags.get(r.id) ?? [],
        }));

      const mockRows = sql.all<{
        id: string;
        name: string;
        instructions: string | null;
        minutes: number;
        full_screen: number;
      }>(
        `SELECT id, name, instructions, minutes, full_screen FROM mocks
         WHERE retired_at IS NULL ${p.packId ? "AND pack_id = ?" : ""} ORDER BY position, created_at, id LIMIT 200`,
        p.packId ? [p.packId] : [],
      );
      const mocks: ExportMock[] = mockRows.map((m) => ({
        name: m.name,
        instructions: m.instructions,
        minutes: m.minutes,
        full_screen: m.full_screen === 1,
        sections: sql
          .all<{
            id: number;
            name: string;
            minutes: number | null;
          }>("SELECT id, name, minutes FROM mock_sections WHERE mock_id = ? ORDER BY position, id LIMIT 50", [m.id])
          .map((s) => ({
            name: s.name,
            minutes: s.minutes,
            questions: sql
              .all<{
                question_id: string;
              }>("SELECT question_id FROM mock_items WHERE section_id = ? ORDER BY position LIMIT 1000", [s.id])
              .map((x) => x.question_id),
          })),
      }));
      return {
        file: exportFile(pack?.name ?? "Orbit question bank", questions, mocks),
        questions: questions.length,
        mocks: mocks.length,
        tooBig: questions.length > LIMITS.questions,
      };
    },
  ),
};
