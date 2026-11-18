-- =============================================================================
-- Orbit storage schema, version 1
-- Engine: SQLite (official @sqlite.org/sqlite-wasm build), one database file per
-- profile, stored in the browser's Origin Private File System (OPFS) through the
-- "opfs-sahpool" VFS and opened ONLY inside a dedicated Web Worker.
-- See docs/STORAGE.md for the rules the app must follow.
--
-- Every table here has a TypeScript type in types/tables/ (one file per table, same
-- name, same columns). Change both together.
--
-- Conventions
--   * Every table is STRICT: a column only accepts its declared type.
--   * Times are INTEGER Unix milliseconds (UTC). Calendar dates are TEXT 'YYYY-MM-DD'
--     in IST.
--   * IDs are opaque TEXT ('q_8f2a1c0d9b'); they never encode a topic, subject or
--     position. Small internal tables use INTEGER ids.
--   * Arrays are TEXT holding a JSON array; booleans are INTEGER 0/1. The worker
--     converts them, so app code only sees the TypeScript types.
--   * position columns are REAL: inserting between 1 and 2 uses 1.5, never renumbers.
--   * legacy_id columns hold v2 IDs so old exports still import. Never shown in the UI.
--   * Content that anything refers to is never deleted; set retired_at.
--   * CONTENT tables say what things ARE (re-importing a pack replaces them).
--     STATE tables say what the USER DID; content changes never touch them.
--   * Summary tables (question_stats, plan_day_progress) are caches kept exact by
--     triggers in the same transaction; each has a rebuild query in this file.
--   * The worker runs on every connection:
--       PRAGMA foreign_keys = ON;
--       PRAGMA synchronous = NORMAL;
--       PRAGMA temp_store = MEMORY;
--       PRAGMA cache_size = -4000;   -- 4 MB page cache: fine on low-RAM machines
--     and uses PRAGMA user_version for migrations (this file = version 1).
-- =============================================================================

PRAGMA user_version = 1;

-- =============================================================================
-- CATALOG (types/tables/catalog/)
-- =============================================================================

CREATE TABLE subjects (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  position   REAL NOT NULL DEFAULT 0,
  legacy_id  TEXT UNIQUE
) STRICT;

CREATE TABLE topics (
  id          TEXT PRIMARY KEY,
  subject_id  TEXT NOT NULL REFERENCES subjects(id),
  name        TEXT NOT NULL,
  position    REAL NOT NULL DEFAULT 0,
  legacy_id   TEXT UNIQUE,
  retired_at  INTEGER,
  UNIQUE (subject_id, name)
) STRICT;
CREATE INDEX topics_by_subject ON topics(subject_id, position);

-- STATE: the user's own rating of a topic. No row = not rated.
CREATE TABLE topic_ratings (
  topic_id    TEXT PRIMARY KEY REFERENCES topics(id) ON DELETE CASCADE,
  rating      TEXT NOT NULL CHECK (rating IN ('know', 'shaky', 'no_idea')),
  updated_at  INTEGER NOT NULL
) STRICT;

CREATE TABLE tags (
  id    INTEGER PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE COLLATE NOCASE
) STRICT;

CREATE TABLE packs (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  file_name    TEXT,
  file_hash    TEXT,                       -- SHA-256 of the imported file
  imported_at  INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
) STRICT;
CREATE INDEX packs_by_file_hash ON packs(file_hash) WHERE file_hash IS NOT NULL;

-- Pictures, stored once by content hash. `bytes` is the LAST column on purpose: SQLite
-- reads a row's columns in order, so listing images (hash, mime, size…) never loads the
-- picture itself.
CREATE TABLE images (
  hash      TEXT PRIMARY KEY,              -- the name used in img:<hash> links
  mime      TEXT NOT NULL CHECK (mime LIKE 'image/%'),
  width     INTEGER CHECK (width > 0),
  height    INTEGER CHECK (height > 0),
  added_at  INTEGER NOT NULL,
  bytes     BLOB NOT NULL CHECK (length(bytes) > 0)
) STRICT;

-- =============================================================================
-- QUESTIONS (types/tables/questions/)
-- =============================================================================

CREATE TABLE questions (
  id              TEXT PRIMARY KEY,
  type            TEXT NOT NULL CHECK (type IN ('mcq', 'msq', 'nat', 'str', 'code')),
  topic_id        TEXT NOT NULL REFERENCES topics(id),
  pack_id         TEXT REFERENCES packs(id) ON DELETE SET NULL,
  pool            TEXT NOT NULL DEFAULT 'practice' CHECK (pool IN ('practice', 'mock')),
  marks           REAL NOT NULL CHECK (marks > 0),
  negative_marks  REAL NOT NULL DEFAULT 0 CHECK (negative_marks >= 0),
  difficulty      TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  stem            TEXT NOT NULL,
  explanation     TEXT,
  content_hash    TEXT NOT NULL,
  legacy_id       TEXT UNIQUE,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  retired_at      INTEGER
) STRICT;
CREATE INDEX questions_by_topic ON questions(topic_id, difficulty);
CREATE INDEX questions_by_pack ON questions(pack_id) WHERE pack_id IS NOT NULL;
CREATE INDEX questions_by_hash ON questions(content_hash);

-- One table per type. Each row must belong to a question of that type (triggers below);
-- the importer writes the question and its type row in one transaction.
-- Deeper rules a CHECK can't express (msq indexes in range and unique) are checked by
-- the importer before saving (AGENTS.md rule 5).
CREATE TABLE question_mcq (
  question_id  TEXT PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
  options      TEXT NOT NULL CHECK (json_valid(options) AND json_type(options) = 'array'
                                    AND json_array_length(options) >= 2),
  correct      INTEGER NOT NULL CHECK (correct >= 0 AND correct < json_array_length(options))
) STRICT;

CREATE TABLE question_msq (
  question_id  TEXT PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
  options      TEXT NOT NULL CHECK (json_valid(options) AND json_type(options) = 'array'
                                    AND json_array_length(options) >= 2),
  correct      TEXT NOT NULL CHECK (json_valid(correct) AND json_type(correct) = 'array'
                                    AND json_array_length(correct) >= 1)
) STRICT;

CREATE TABLE question_nat (
  question_id  TEXT PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
  value        REAL NOT NULL,
  tolerance    REAL NOT NULL DEFAULT 0 CHECK (tolerance >= 0)
) STRICT;

CREATE TABLE question_str (
  question_id     TEXT PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
  match           TEXT NOT NULL DEFAULT 'exact' CHECK (match IN ('exact', 'list', 'set')),
  case_sensitive  INTEGER NOT NULL DEFAULT 0 CHECK (case_sensitive IN (0, 1)),
  accepted        TEXT NOT NULL CHECK (json_valid(accepted) AND json_type(accepted) = 'array'
                                       AND json_array_length(accepted) >= 1)
) STRICT;

CREATE TABLE question_code (
  question_id  TEXT PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
  starter      TEXT
) STRICT;

CREATE TRIGGER question_mcq_type BEFORE INSERT ON question_mcq
WHEN (SELECT type FROM questions WHERE id = new.question_id) IS NOT 'mcq' BEGIN
  SELECT RAISE(ABORT, 'question_mcq: the question is not an mcq');
END;
CREATE TRIGGER question_msq_type BEFORE INSERT ON question_msq
WHEN (SELECT type FROM questions WHERE id = new.question_id) IS NOT 'msq' BEGIN
  SELECT RAISE(ABORT, 'question_msq: the question is not an msq');
END;
CREATE TRIGGER question_nat_type BEFORE INSERT ON question_nat
WHEN (SELECT type FROM questions WHERE id = new.question_id) IS NOT 'nat' BEGIN
  SELECT RAISE(ABORT, 'question_nat: the question is not a nat');
END;
CREATE TRIGGER question_str_type BEFORE INSERT ON question_str
WHEN (SELECT type FROM questions WHERE id = new.question_id) IS NOT 'str' BEGIN
  SELECT RAISE(ABORT, 'question_str: the question is not a str');
END;
CREATE TRIGGER question_code_type BEFORE INSERT ON question_code
WHEN (SELECT type FROM questions WHERE id = new.question_id) IS NOT 'code' BEGIN
  SELECT RAISE(ABORT, 'question_code: the question is not a code question');
END;
-- Changing a question's type would orphan its type row: change it by deleting and re-adding.
CREATE TRIGGER questions_type_fixed BEFORE UPDATE OF type ON questions
WHEN new.type IS NOT old.type BEGIN
  SELECT RAISE(ABORT, 'questions: type can not change');
END;

CREATE TABLE question_tags (
  question_id  TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  tag_id       INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (question_id, tag_id)
) STRICT, WITHOUT ROWID;
CREATE INDEX question_tags_by_tag ON question_tags(tag_id, question_id);

-- Filled when a question is saved, by scanning its stem, options and explanation.
-- Makes "unused images" a single query.
CREATE TABLE question_images (
  question_id  TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  hash         TEXT NOT NULL REFERENCES images(hash),
  PRIMARY KEY (question_id, hash)
) STRICT, WITHOUT ROWID;
CREATE INDEX question_images_by_hash ON question_images(hash);

-- Full-text search over stems and explanations (search box, admin editor, duplicates).
-- A normal FTS5 table with its own copy of the text, keyed by question_id. Rows are found
-- by MATCHing question_id (an FTS index lookup), never by rowid: a TEXT-keyed table's rowid
-- can change on VACUUM. '_' is a token character, so 'q_8f2a' is one token.
-- Searches should limit themselves to the text columns: '{stem explanation} : word'.
CREATE VIRTUAL TABLE questions_fts USING fts5(
  question_id, stem, explanation,
  tokenize = "unicode61 remove_diacritics 2 tokenchars '_'"
);
CREATE TRIGGER questions_fts_ai AFTER INSERT ON questions BEGIN
  INSERT INTO questions_fts(question_id, stem, explanation) VALUES (new.id, new.stem, new.explanation);
END;
CREATE TRIGGER questions_fts_ad AFTER DELETE ON questions BEGIN
  DELETE FROM questions_fts WHERE rowid IN
    (SELECT rowid FROM questions_fts WHERE questions_fts MATCH 'question_id : "' || old.id || '"');
END;
CREATE TRIGGER questions_fts_au AFTER UPDATE OF id, stem, explanation ON questions BEGIN
  DELETE FROM questions_fts WHERE rowid IN
    (SELECT rowid FROM questions_fts WHERE questions_fts MATCH 'question_id : "' || old.id || '"');
  INSERT INTO questions_fts(question_id, stem, explanation) VALUES (new.id, new.stem, new.explanation);
END;

-- =============================================================================
-- MOCK TESTS (types/tables/mocks/)
-- =============================================================================

CREATE TABLE mocks (
  id            TEXT PRIMARY KEY,
  pack_id       TEXT REFERENCES packs(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  instructions  TEXT,
  minutes       INTEGER NOT NULL CHECK (minutes > 0),
  full_screen   INTEGER NOT NULL DEFAULT 0 CHECK (full_screen IN (0, 1)),
  position      REAL NOT NULL DEFAULT 0,
  legacy_id     TEXT UNIQUE,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  retired_at    INTEGER
) STRICT;

CREATE TABLE mock_sections (
  id        INTEGER PRIMARY KEY,
  mock_id   TEXT NOT NULL REFERENCES mocks(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  position  REAL NOT NULL,
  minutes   INTEGER CHECK (minutes > 0)    -- NULL = shares the mock's clock
) STRICT;
CREATE INDEX mock_sections_by_mock ON mock_sections(mock_id, position);

CREATE TABLE mock_items (
  section_id   INTEGER NOT NULL REFERENCES mock_sections(id) ON DELETE CASCADE,
  question_id  TEXT NOT NULL REFERENCES questions(id),
  position     REAL NOT NULL,
  PRIMARY KEY (section_id, question_id)
) STRICT, WITHOUT ROWID;
CREATE INDEX mock_items_by_question ON mock_items(question_id);

-- The same question may not be in two sections of one mock.
CREATE TRIGGER mock_items_once_per_mock BEFORE INSERT ON mock_items
WHEN EXISTS (
  SELECT 1 FROM mock_items i JOIN mock_sections s ON s.id = i.section_id
  WHERE i.question_id = new.question_id
    AND s.mock_id = (SELECT mock_id FROM mock_sections WHERE id = new.section_id)
) BEGIN
  SELECT RAISE(ABORT, 'mock_items: the question is already in this mock');
END;

-- STATE: one row per time a mock is taken. Layout copied in at the start.
CREATE TABLE mock_attempts (
  id             TEXT PRIMARY KEY,
  mock_id        TEXT NOT NULL REFERENCES mocks(id),   -- mocks are retired, never deleted
  status         TEXT NOT NULL DEFAULT 'in_progress'
                 CHECK (status IN ('in_progress', 'submitted', 'abandoned', 'failed')),
  sections       TEXT NOT NULL CHECK (json_valid(sections) AND json_type(sections) = 'array'
                                      AND json_array_length(sections) >= 1),
  minutes        INTEGER NOT NULL CHECK (minutes > 0),
  started_at     INTEGER NOT NULL,
  ended_at       INTEGER,
  current        INTEGER NOT NULL DEFAULT 0 CHECK (current >= 0),
  warnings       INTEGER NOT NULL DEFAULT 0 CHECK (warnings >= 0),
  failed_reason  TEXT,
  score          REAL,
  max_score      REAL,
  CHECK ((status = 'in_progress') = (ended_at IS NULL)),
  CHECK ((status = 'failed') = (failed_reason IS NOT NULL)),
  CHECK ((status = 'submitted') = (score IS NOT NULL AND max_score IS NOT NULL))
) STRICT;
CREATE INDEX mock_attempts_by_mock ON mock_attempts(mock_id, started_at);
CREATE INDEX mock_attempts_by_time ON mock_attempts(started_at);
-- One test at a time: at most one attempt in progress.
CREATE UNIQUE INDEX mock_attempts_one_open ON mock_attempts(status) WHERE status = 'in_progress';

-- A finished attempt stays finished (its answers are already in the stats).
CREATE TRIGGER mock_attempts_final BEFORE UPDATE OF status ON mock_attempts
WHEN old.status IS NOT 'in_progress' AND new.status IS NOT old.status BEGIN
  SELECT RAISE(ABORT, 'mock_attempts: a finished attempt can not change status');
END;

CREATE TABLE mock_attempt_items (
  attempt_id   TEXT NOT NULL REFERENCES mock_attempts(id) ON DELETE CASCADE,
  question_id  TEXT NOT NULL REFERENCES questions(id),
  section      INTEGER NOT NULL CHECK (section >= 0),   -- index into mock_attempts.sections
  position     INTEGER NOT NULL CHECK (position >= 0),
  choice       TEXT CHECK (choice IS NULL OR (json_valid(choice) AND json_type(choice) = 'array')),
  typed        TEXT,
  visited      INTEGER NOT NULL DEFAULT 0 CHECK (visited IN (0, 1)),
  marked       INTEGER NOT NULL DEFAULT 0 CHECK (marked IN (0, 1)),
  time_ms      INTEGER NOT NULL DEFAULT 0 CHECK (time_ms >= 0),
  marks        REAL,
  PRIMARY KEY (attempt_id, question_id),
  UNIQUE (attempt_id, position),
  CHECK (choice IS NULL OR typed IS NULL)
) STRICT, WITHOUT ROWID;
CREATE INDEX mock_attempt_items_by_question ON mock_attempt_items(question_id);

-- =============================================================================
-- ANSWERS AND STATS (types/tables/questions/, docs/STATS.md)
-- =============================================================================

-- STATE: one row per question per sitting. Never edited after the sitting ends.
CREATE TABLE question_answers (
  id           INTEGER PRIMARY KEY,
  question_id  TEXT NOT NULL REFERENCES questions(id),
  recorded_at  INTEGER NOT NULL,
  outcome      TEXT NOT NULL CHECK (outcome IN ('correct', 'incorrect', 'skipped')),
  time_ms      INTEGER NOT NULL DEFAULT 0 CHECK (time_ms >= 0),
  attempt_id   TEXT REFERENCES mock_attempts(id) ON DELETE CASCADE   -- NULL = practice
) STRICT;
CREATE INDEX question_answers_by_question ON question_answers(question_id, recorded_at);
CREATE INDEX question_answers_by_time ON question_answers(recorded_at);
-- One row per question per attempt.
CREATE UNIQUE INDEX question_answers_by_attempt ON question_answers(attempt_id, question_id)
  WHERE attempt_id IS NOT NULL;

-- Mock answers are written only for a submitted attempt.
CREATE TRIGGER question_answers_submitted_only BEFORE INSERT ON question_answers
WHEN new.attempt_id IS NOT NULL
 AND (SELECT status FROM mock_attempts WHERE id = new.attempt_id) IS NOT 'submitted' BEGIN
  SELECT RAISE(ABORT, 'question_answers: the mock attempt is not submitted');
END;

-- STATE (cache): running totals per question. Rebuild:
--   DELETE FROM question_stats;
--   INSERT INTO question_stats SELECT question_id, COUNT(*), SUM(outcome = 'correct'),
--     SUM(outcome = 'incorrect') FROM question_answers GROUP BY question_id;
-- The triggers RECOMPUTE the touched question's row from its answers (a few rows through
-- an index) instead of adding to counters, so they stay right when answers are deleted.
CREATE TABLE question_stats (
  question_id  TEXT PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
  visited      INTEGER NOT NULL CHECK (visited >= 1),
  correct      INTEGER NOT NULL CHECK (correct >= 0),
  incorrect    INTEGER NOT NULL CHECK (incorrect >= 0),
  CHECK (correct + incorrect <= visited)
) STRICT, WITHOUT ROWID;

CREATE TRIGGER question_stats_ai AFTER INSERT ON question_answers BEGIN
  DELETE FROM question_stats WHERE question_id = new.question_id;
  INSERT INTO question_stats
    SELECT question_id, COUNT(*), SUM(outcome = 'correct'), SUM(outcome = 'incorrect')
    FROM question_answers WHERE question_id = new.question_id GROUP BY question_id;
END;
-- Also fires for every answer of a deleted attempt (ON DELETE CASCADE).
CREATE TRIGGER question_stats_ad AFTER DELETE ON question_answers BEGIN
  DELETE FROM question_stats WHERE question_id = old.question_id;
  INSERT INTO question_stats
    SELECT question_id, COUNT(*), SUM(outcome = 'correct'), SUM(outcome = 'incorrect')
    FROM question_answers WHERE question_id = old.question_id GROUP BY question_id;
END;
CREATE TRIGGER question_stats_au AFTER UPDATE OF question_id, outcome ON question_answers BEGIN
  DELETE FROM question_stats WHERE question_id IN (old.question_id, new.question_id);
  INSERT INTO question_stats
    SELECT question_id, COUNT(*), SUM(outcome = 'correct'), SUM(outcome = 'incorrect')
    FROM question_answers WHERE question_id IN (old.question_id, new.question_id) GROUP BY question_id;
END;

-- =============================================================================
-- STUDY PLANS (types/tables/plans/, docs/PLANS.md)
-- =============================================================================

CREATE TABLE plans (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT,
  starts_on    TEXT NOT NULL CHECK (starts_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  ends_on      TEXT NOT NULL CHECK (ends_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  is_active    INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  CHECK (ends_on >= starts_on)
) STRICT;
CREATE UNIQUE INDEX plans_one_active ON plans(is_active) WHERE is_active = 1;

CREATE TABLE plan_days (
  id       INTEGER PRIMARY KEY,
  plan_id  TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  on_date  TEXT NOT NULL CHECK (on_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  title    TEXT,
  note     TEXT,
  UNIQUE (plan_id, on_date)
) STRICT;

-- A day must fall inside its plan's dates, and a plan can't shrink past its days.
CREATE TRIGGER plan_days_in_range_ins BEFORE INSERT ON plan_days
WHEN NOT EXISTS (SELECT 1 FROM plans WHERE id = new.plan_id AND new.on_date BETWEEN starts_on AND ends_on) BEGIN
  SELECT RAISE(ABORT, 'plan_days: the date is outside the plan');
END;
CREATE TRIGGER plan_days_in_range_upd BEFORE UPDATE OF plan_id, on_date ON plan_days
WHEN NOT EXISTS (SELECT 1 FROM plans WHERE id = new.plan_id AND new.on_date BETWEEN starts_on AND ends_on) BEGIN
  SELECT RAISE(ABORT, 'plan_days: the date is outside the plan');
END;
CREATE TRIGGER plans_keep_days_in_range BEFORE UPDATE OF starts_on, ends_on ON plans
WHEN EXISTS (SELECT 1 FROM plan_days WHERE plan_id = new.id AND on_date NOT BETWEEN new.starts_on AND new.ends_on) BEGIN
  SELECT RAISE(ABORT, 'plans: some days would fall outside the new dates');
END;

CREATE TABLE plan_tasks (
  id        INTEGER PRIMARY KEY,
  day_id    INTEGER NOT NULL REFERENCES plan_days(id) ON DELETE CASCADE,
  position  REAL NOT NULL,
  body      TEXT NOT NULL
) STRICT;
CREATE INDEX plan_tasks_by_day ON plan_tasks(day_id, position);

CREATE TABLE plan_day_questions (
  day_id       INTEGER NOT NULL REFERENCES plan_days(id) ON DELETE CASCADE,
  question_id  TEXT NOT NULL REFERENCES questions(id),
  position     REAL NOT NULL,
  PRIMARY KEY (day_id, question_id)
) STRICT, WITHOUT ROWID;
CREATE INDEX plan_day_questions_by_question ON plan_day_questions(question_id);

-- STATE: ticked tasks. Unticking deletes the row.
CREATE TABLE plan_task_ticks (
  task_id  INTEGER PRIMARY KEY REFERENCES plan_tasks(id) ON DELETE CASCADE,
  done_at  INTEGER NOT NULL
) STRICT;

-- STATE: linked questions that got done. Written only by the trigger below. Deleting the
-- answer (e.g. deleting a mock attempt) removes its ticks.
CREATE TABLE plan_question_ticks (
  day_id       INTEGER NOT NULL,
  question_id  TEXT NOT NULL,
  answer_id    INTEGER NOT NULL REFERENCES question_answers(id) ON DELETE CASCADE,
  done_at      INTEGER NOT NULL,
  PRIMARY KEY (day_id, question_id),
  FOREIGN KEY (day_id, question_id) REFERENCES plan_day_questions(day_id, question_id) ON DELETE CASCADE
) STRICT, WITHOUT ROWID;
CREATE INDEX plan_question_ticks_by_answer ON plan_question_ticks(answer_id);

-- A correct or incorrect answer ticks every unticked link to that question on a day up to
-- and including the answer's IST date. Skipped answers and future days are left alone.
CREATE TRIGGER plan_question_ticks_from_answer AFTER INSERT ON question_answers
WHEN new.outcome IN ('correct', 'incorrect') BEGIN
  INSERT INTO plan_question_ticks(day_id, question_id, answer_id, done_at)
    SELECT l.day_id, l.question_id, new.id, new.recorded_at
    FROM plan_day_questions l JOIN plan_days d ON d.id = l.day_id
    WHERE l.question_id = new.question_id
      AND d.on_date <= date(new.recorded_at / 1000, 'unixepoch', '+330 minutes')
      AND NOT EXISTS (SELECT 1 FROM plan_question_ticks k WHERE k.day_id = l.day_id AND k.question_id = l.question_id);
END;

-- What plan_day_progress should hold, worked out from scratch. The triggers below copy one
-- day from here; rebuilding everything is:
--   DELETE FROM plan_day_progress;
--   INSERT INTO plan_day_progress(day_id, plan_id, on_date, tasks_total, tasks_done,
--     questions_total, questions_done, done_at) SELECT * FROM v_plan_day_progress;
CREATE VIEW v_plan_day_progress AS
SELECT c.*,
       CASE WHEN c.tasks_total + c.questions_total > 0
             AND c.tasks_done + c.questions_done = c.tasks_total + c.questions_total
            THEN (SELECT MAX(t) FROM (
                    SELECT MAX(k.done_at) AS t FROM plan_task_ticks k JOIN plan_tasks pt ON pt.id = k.task_id
                    WHERE pt.day_id = c.day_id
                    UNION ALL
                    SELECT MAX(done_at) FROM plan_question_ticks WHERE day_id = c.day_id))
       END AS done_at
FROM (
  SELECT d.id AS day_id, d.plan_id, d.on_date,
         (SELECT COUNT(*) FROM plan_tasks t WHERE t.day_id = d.id) AS tasks_total,
         (SELECT COUNT(*) FROM plan_tasks t JOIN plan_task_ticks k ON k.task_id = t.id
           WHERE t.day_id = d.id) AS tasks_done,
         (SELECT COUNT(*) FROM plan_day_questions q WHERE q.day_id = d.id) AS questions_total,
         (SELECT COUNT(*) FROM plan_question_ticks k JOIN plan_day_questions q
             ON q.day_id = k.day_id AND q.question_id = k.question_id
           WHERE k.day_id = d.id) AS questions_done
  FROM plan_days d
) c;

-- STATE (cache): counts and status per day; the calendar, history and streak read only
-- this table. status is generated from the counts, never written.
CREATE TABLE plan_day_progress (
  day_id           INTEGER PRIMARY KEY REFERENCES plan_days(id) ON DELETE CASCADE,
  plan_id          TEXT NOT NULL,
  on_date          TEXT NOT NULL,
  tasks_total      INTEGER NOT NULL DEFAULT 0 CHECK (tasks_total >= 0),
  tasks_done       INTEGER NOT NULL DEFAULT 0 CHECK (tasks_done BETWEEN 0 AND tasks_total),
  questions_total  INTEGER NOT NULL DEFAULT 0 CHECK (questions_total >= 0),
  questions_done   INTEGER NOT NULL DEFAULT 0 CHECK (questions_done BETWEEN 0 AND questions_total),
  status           TEXT GENERATED ALWAYS AS (
                     CASE WHEN tasks_total + questions_total = 0 THEN NULL
                          WHEN tasks_done + questions_done = tasks_total + questions_total THEN 'done'
                          WHEN tasks_done + questions_done > 0 THEN 'partial'
                          ELSE 'incomplete' END) VIRTUAL,
  done_at          INTEGER
) STRICT;
CREATE INDEX plan_day_progress_by_date ON plan_day_progress(plan_id, on_date);

-- Every change to a day's items or ticks recomputes that day's row (one indexed lookup).
-- Triggers here never use INSERT OR REPLACE / OR IGNORE: SQLite lets the outer statement's
-- OR clause override the ones inside triggers, which would silently skip updates.
CREATE TRIGGER plan_progress_day_ai AFTER INSERT ON plan_days BEGIN
  DELETE FROM plan_day_progress WHERE day_id = new.id;
  INSERT INTO plan_day_progress(day_id, plan_id, on_date, tasks_total, tasks_done, questions_total, questions_done, done_at)
    SELECT * FROM v_plan_day_progress WHERE day_id = new.id;
END;
CREATE TRIGGER plan_progress_day_au AFTER UPDATE OF plan_id, on_date ON plan_days BEGIN
  DELETE FROM plan_day_progress WHERE day_id = new.id;
  INSERT INTO plan_day_progress(day_id, plan_id, on_date, tasks_total, tasks_done, questions_total, questions_done, done_at)
    SELECT * FROM v_plan_day_progress WHERE day_id = new.id;
END;
CREATE TRIGGER plan_progress_task_ai AFTER INSERT ON plan_tasks BEGIN
  DELETE FROM plan_day_progress WHERE day_id = new.day_id;
  INSERT INTO plan_day_progress(day_id, plan_id, on_date, tasks_total, tasks_done, questions_total, questions_done, done_at)
    SELECT * FROM v_plan_day_progress WHERE day_id = new.day_id;
END;
CREATE TRIGGER plan_progress_task_ad AFTER DELETE ON plan_tasks BEGIN
  DELETE FROM plan_day_progress WHERE day_id = old.day_id;
  INSERT INTO plan_day_progress(day_id, plan_id, on_date, tasks_total, tasks_done, questions_total, questions_done, done_at)
    SELECT * FROM v_plan_day_progress WHERE day_id = old.day_id;
END;
CREATE TRIGGER plan_progress_task_au AFTER UPDATE OF day_id ON plan_tasks BEGIN
  DELETE FROM plan_day_progress WHERE day_id IN (old.day_id, new.day_id);
  INSERT INTO plan_day_progress(day_id, plan_id, on_date, tasks_total, tasks_done, questions_total, questions_done, done_at)
    SELECT * FROM v_plan_day_progress WHERE day_id IN (old.day_id, new.day_id);
END;
CREATE TRIGGER plan_progress_question_ai AFTER INSERT ON plan_day_questions BEGIN
  DELETE FROM plan_day_progress WHERE day_id = new.day_id;
  INSERT INTO plan_day_progress(day_id, plan_id, on_date, tasks_total, tasks_done, questions_total, questions_done, done_at)
    SELECT * FROM v_plan_day_progress WHERE day_id = new.day_id;
END;
CREATE TRIGGER plan_progress_question_ad AFTER DELETE ON plan_day_questions BEGIN
  DELETE FROM plan_day_progress WHERE day_id = old.day_id;
  INSERT INTO plan_day_progress(day_id, plan_id, on_date, tasks_total, tasks_done, questions_total, questions_done, done_at)
    SELECT * FROM v_plan_day_progress WHERE day_id = old.day_id;
END;
CREATE TRIGGER plan_progress_task_tick_ai AFTER INSERT ON plan_task_ticks BEGIN
  DELETE FROM plan_day_progress WHERE day_id = (SELECT day_id FROM plan_tasks WHERE id = new.task_id);
  INSERT INTO plan_day_progress(day_id, plan_id, on_date, tasks_total, tasks_done, questions_total, questions_done, done_at)
    SELECT * FROM v_plan_day_progress WHERE day_id = (SELECT day_id FROM plan_tasks WHERE id = new.task_id);
END;
CREATE TRIGGER plan_progress_task_tick_ad AFTER DELETE ON plan_task_ticks BEGIN
  DELETE FROM plan_day_progress WHERE day_id = (SELECT day_id FROM plan_tasks WHERE id = old.task_id);
  INSERT INTO plan_day_progress(day_id, plan_id, on_date, tasks_total, tasks_done, questions_total, questions_done, done_at)
    SELECT * FROM v_plan_day_progress WHERE day_id = (SELECT day_id FROM plan_tasks WHERE id = old.task_id);
END;
CREATE TRIGGER plan_progress_question_tick_ai AFTER INSERT ON plan_question_ticks BEGIN
  DELETE FROM plan_day_progress WHERE day_id = new.day_id;
  INSERT INTO plan_day_progress(day_id, plan_id, on_date, tasks_total, tasks_done, questions_total, questions_done, done_at)
    SELECT * FROM v_plan_day_progress WHERE day_id = new.day_id;
END;
CREATE TRIGGER plan_progress_question_tick_ad AFTER DELETE ON plan_question_ticks BEGIN
  DELETE FROM plan_day_progress WHERE day_id = old.day_id;
  INSERT INTO plan_day_progress(day_id, plan_id, on_date, tasks_total, tasks_done, questions_total, questions_done, done_at)
    SELECT * FROM v_plan_day_progress WHERE day_id = old.day_id;
END;
