// Question files: import a pack of questions and mocks.
// Named queries (docs/STORAGE.md §2); how to write one: lib/db/queries/index.ts.

import { read, write } from "@/lib/db/queries/core";

import { insertSql } from "@/lib/db/codec";

import { type Sql, type TableName } from "@/lib/db/sql";

import { bankRefErrors, parseQuestionFile, questionHash, type FileQuestion } from "@/lib/questionFile";

/** The most ids one `pack.missing` call checks (a file holds at most this many mock questions anyway). */
const MISSING_MAX = 5000;

/** Which of these question ids are not in the bank (deleted or retired ones count as missing). */
function missingFromBank(sql: Sql, ids: string[]): Set<string> {
  const out = new Set<string>();
  for (const id of new Set(ids))
    if (!sql.get("SELECT 1 FROM questions WHERE id = ? AND retired_at IS NULL", [id])) out.add(id);
  return out;
}

export const packQueries = {
  /** For the upload preview: the mock question ids of a file (`bankRefs`) that aren't in the bank. */
  "pack.missing": read(["questions"], (sql, p: { ids: string[] }) => [
    ...missingFromBank(sql, p.ids.slice(0, MISSING_MAX)),
  ]),

  /** Imports a question file (lib/questionFile.ts): subjects, topics, tags, questions and mocks, as one pack.
   *  The file is checked again here, so nothing unchecked is ever saved; on any error nothing is written.
   *  Subjects, topics and tags are matched by name (without case) and created when missing; a question that
   *  is already in the bank (same words, same answer) is not added twice, and mocks use the existing copy. A mock
   *  may also use questions already in the bank by their id; one found nowhere refuses the file. */
  "pack.import": write(
    [
      "packs",
      "subjects",
      "topics",
      "tags",
      "questions",
      "question_mcq",
      "question_msq",
      "question_nat",
      "question_str",
      "question_code",
      "question_tags",
      "mocks",
      "mock_sections",
      "mock_items",
    ],
    (sql, p: { text: string; fileName: string | null; fileHash: string | null }) => {
      const r = parseQuestionFile(p.text);
      if (!r.file) return { ok: false as const, errors: r.errors, warnings: r.warnings };
      const f = r.file;
      const missing = missingFromBank(
        sql,
        f.bankRefs.map((b) => b.id),
      );
      if (missing.size) return { ok: false as const, errors: bankRefErrors(f, missing), warnings: r.warnings };
      if (p.fileHash) {
        const same = sql.get<{ name: string }>("SELECT name FROM packs WHERE file_hash = ? LIMIT 1", [p.fileHash]);
        if (same)
          return {
            ok: false as const,
            errors: [`This exact file is already imported (as "${same.name}"). Nothing was changed.`],
            warnings: [],
          };
      }
      const now = Date.now();
      const rid = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
      const insert = (table: TableName, row: Record<string, unknown>) => {
        const ins = insertSql(table, row);
        sql.run(ins.query, ins.params);
      };
      const packId = rid("pk");
      insert("packs", {
        id: packId,
        name: f.name,
        file_name: p.fileName,
        file_hash: p.fileHash,
        imported_at: now,
        updated_at: now,
      });

      const subjects = new Map<string, string>(); // lower-case name → id
      const topics = new Map<string, string>(); // subject id + lower-case name → id
      const tags = new Map<string, number>();
      const subjectId = (name: string) => {
        const key = name.toLowerCase();
        let id = subjects.get(key);
        if (!id) {
          id = sql.get<{ id: string }>("SELECT id FROM subjects WHERE lower(name) = ? LIMIT 1", [key])?.id;
          if (!id) {
            id = rid("sb");
            const pos = sql.get<{ n: number }>("SELECT coalesce(max(position), 0) + 1 AS n FROM subjects")!.n;
            sql.run("INSERT INTO subjects (id, name, position) VALUES (?, ?, ?)", [id, name, pos]);
          }
          subjects.set(key, id);
        }
        return id;
      };
      const topicId = (subject: string, name: string) => {
        const sid = subjectId(subject);
        const key = `${sid}|${name.toLowerCase()}`;
        let id = topics.get(key);
        if (!id) {
          const old = sql.get<{ id: string }>(
            "SELECT id FROM topics WHERE subject_id = ? AND lower(name) = ? LIMIT 1",
            [sid, name.toLowerCase()],
          );
          if (old) {
            id = old.id;
            sql.run("UPDATE topics SET retired_at = NULL WHERE id = ? AND retired_at IS NOT NULL", [id]); // new questions bring it back
          } else {
            id = rid("tp");
            const pos = sql.get<{ n: number }>(
              "SELECT coalesce(max(position), 0) + 1 AS n FROM topics WHERE subject_id = ?",
              [sid],
            )!.n;
            sql.run("INSERT INTO topics (id, subject_id, name, position) VALUES (?, ?, ?, ?)", [id, sid, name, pos]);
          }
          topics.set(key, id);
        }
        return id;
      };
      const tagId = (name: string) => {
        const key = name.toLowerCase();
        let id = tags.get(key);
        if (id === undefined) {
          id =
            sql.get<{ id: number }>("SELECT id FROM tags WHERE name = ? LIMIT 1", [name])?.id ??
            sql.get<{ id: number }>("INSERT INTO tags (name) VALUES (?) RETURNING id", [name])!.id;
          tags.set(key, id);
        }
        return id;
      };

      const ids = new Map<string, string>(); // a question's file id → its id in the bank
      let existing = 0;
      const added = { total: 0, practice: 0, programming: 0, mockQuestions: 0 };
      const addOne = (q: FileQuestion): string => {
        const hash = questionHash(q);
        const old = sql.get<{ id: string }>(
          "SELECT id FROM questions WHERE content_hash = ? AND type = ? AND retired_at IS NULL LIMIT 1",
          [hash, q.type],
        );
        if (old) {
          existing++;
          return old.id;
        }
        const id = rid("q");
        insert("questions", {
          id,
          type: q.type,
          topic_id: topicId(q.subject, q.topic),
          pack_id: packId,
          pool: q.pool,
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
        if (q.type === "mcq") insert("question_mcq", { question_id: id, options: q.options, correct: q.correct });
        else if (q.type === "msq") insert("question_msq", { question_id: id, options: q.options, correct: q.correct });
        else if (q.type === "nat") insert("question_nat", { question_id: id, value: q.value, tolerance: q.tolerance });
        else if (q.type === "str")
          insert("question_str", {
            question_id: id,
            match: q.match,
            case_sensitive: q.case_sensitive,
            accepted: q.accepted,
          });
        else insert("question_code", { question_id: id, starter: q.starter });
        for (const t of q.tags)
          sql.run("INSERT OR IGNORE INTO question_tags (question_id, tag_id) VALUES (?, ?)", [id, tagId(t)]);
        added.total++;
        if (q.pool === "mock") added.mockQuestions++;
        else if (q.type === "code") added.programming++;
        else added.practice++;
        return id;
      };
      for (const q of f.questions) {
        const id = addOne(q);
        if (q.ref) ids.set(q.ref, id);
      }

      let mocks = 0;
      for (const m of f.mocks) {
        const mockId = rid("mk");
        const pos = sql.get<{ n: number }>("SELECT coalesce(max(position), 0) + 1 AS n FROM mocks")!.n;
        insert("mocks", {
          id: mockId,
          pack_id: packId,
          name: m.name,
          instructions: m.instructions,
          minutes: m.minutes,
          full_screen: m.full_screen,
          position: pos,
          legacy_id: null,
          created_at: now,
          updated_at: now,
          retired_at: null,
        });
        m.sections.forEach((s, k) => {
          const sectionId = sql.get<{ id: number }>(
            "INSERT INTO mock_sections (mock_id, name, position, minutes) VALUES (?, ?, ?, ?) RETURNING id",
            [mockId, s.name, k + 1, s.minutes],
          )!.id;
          s.questions.forEach((ref, j) =>
            sql.run("INSERT INTO mock_items (section_id, question_id, position) VALUES (?, ?, ?)", [
              sectionId,
              ids.get(ref) ?? ref, // not in this file: a question already in the bank (checked above)
              j + 1,
            ]),
          );
        });
        mocks++;
      }

      const warnings = [...r.warnings];
      if (existing) warnings.push(`${existing} question(s) were already in your bank, so they were not added again.`);
      return { ok: true as const, packId, name: f.name, ...added, existing, mocks, warnings };
    },
  ),
};
