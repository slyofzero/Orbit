-- =============================================================================
-- Orbit storage schema, version 1
-- Engine: SQLite (official @sqlite.org/sqlite-wasm build), one database file per
-- profile, stored in the browser's Origin Private File System (OPFS) through the
-- "opfs-sahpool" VFS and opened ONLY inside a dedicated Web Worker.
-- See docs/STORAGE.md for the reasoning and the rules the app must follow.
--
-- Conventions
--   * Every table is STRICT: a column only accepts its declared type.
--   * Times are INTEGER Unix milliseconds (UTC). Calendar dates are TEXT 'YYYY-MM-DD'
--     in IST, the planner's day.
--   * Content IDs are opaque TEXT ('q_8f2a1c0d9b', 'tp_01h…'): they never encode a
--     topic, a subject or a position, so moving a question never changes its ID.
--   * Subject IDs stay short readable codes ('prob', 'la', …): there are few, and
--     they are referenced by humans and AI prompts.
--   * legacy_id columns hold the v2 (localStorage era) IDs so old exports, plan
--     links and AI answers still resolve. Never shown in the UI.
--   * Content is never hard-deleted once anything refers to it; set retired_at.
--   * The worker runs on every connection:
--       PRAGMA foreign_keys = ON;
--       PRAGMA synchronous = NORMAL;
--       PRAGMA temp_store = MEMORY;
--       PRAGMA cache_size = -4000;   -- 4 MB page cache: fine on low-RAM machines
--     and uses PRAGMA user_version for migrations (this file = version 1).
-- =============================================================================

PRAGMA user_version = 1;

-- -----------------------------------------------------------------------------
-- 0. Small settings (name, exam date, quote rotation, party state, …)
-- -----------------------------------------------------------------------------
CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL CHECK (json_valid(value)),   -- always JSON
  updated_at INTEGER NOT NULL
) STRICT;

-- =============================================================================
-- CONTENT: what the questions, mocks and plan ARE.
-- Replacing or re-importing content never touches the STATE tables further down.
-- =============================================================================

-- Where a batch of content came from (one row per imported pack file).
CREATE TABLE packs (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  imported_at   INTEGER NOT NULL,
  source_file   TEXT,
  source_sha256 TEXT
) STRICT;

CREATE TABLE subjects (
  id    TEXT PRIMARY KEY,                 -- 'prob', 'la', 'calc', …
  name  TEXT NOT NULL,
  sort  INTEGER NOT NULL DEFAULT 0
) STRICT;

CREATE TABLE topics (
  id          TEXT PRIMARY KEY,
  subject_id  TEXT NOT NULL REFERENCES subjects(id) ON UPDATE CASCADE,
  name        TEXT NOT NULL,
  sort        INTEGER NOT NULL DEFAULT 0,
  legacy_id   TEXT UNIQUE,
  retired_at  INTEGER
) STRICT;
CREATE INDEX topics_by_subject ON topics(subject_id, sort);

-- One row per question. The answer is NOT a polymorphic blob:
--   mcq / msq -> question_options + question_correct_options
--   nat       -> nat_value + nat_tol (columns below)
--   str       -> question_text_answers (one row per accepted answer) + str_* columns
--   code      -> code_specs + code_tests
-- CHECK constraints make a half-filled question impossible to save.
CREATE TABLE questions (
  n                   INTEGER PRIMARY KEY,  -- internal row number: stable across VACUUM, used only by the search index
  id                  TEXT NOT NULL UNIQUE, -- the real ID everything else refers to
  topic_id            TEXT NOT NULL REFERENCES topics(id),
  pack_id             TEXT REFERENCES packs(id) ON DELETE SET NULL,
  pool                TEXT NOT NULL DEFAULT 'practice'
                        CHECK (pool IN ('practice', 'mock')),   -- 'mock' = only appears inside mock tests
  type                TEXT NOT NULL CHECK (type IN ('mcq', 'msq', 'nat', 'str', 'code')),
  marks               REAL NOT NULL CHECK (marks > 0),            -- any positive value: 1, 2, 0.5, 4, …
  negative_marks      REAL NOT NULL DEFAULT 0 CHECK (negative_marks >= 0),  -- deducted for a wrong answer; 0 = no negative marking
  difficulty          TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  stem                TEXT NOT NULL,      -- markdown + $tex$; pictures as ![alt](img:<hash>)
  explanation         TEXT NOT NULL DEFAULT '',
  nat_value           REAL,
  nat_tol             REAL CHECK (nat_tol IS NULL OR nat_tol >= 0),
  str_match           TEXT CHECK (str_match IN ('exact', 'list', 'set')),
  str_case_sensitive  INTEGER CHECK (str_case_sensitive IN (0, 1)),
  content_hash        TEXT NOT NULL,      -- sha-256 of normalised stem + options + answer: finds true duplicates
  rev                 INTEGER NOT NULL DEFAULT 1,   -- +1 on every edit; old versions go to question_history
  legacy_id           TEXT UNIQUE,
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL,
  retired_at          INTEGER,            -- hidden from practice, kept for history
  CHECK ((type = 'nat') = (nat_value IS NOT NULL AND nat_tol IS NOT NULL)),
  CHECK ((type = 'str') = (str_match IS NOT NULL AND str_case_sensitive IS NOT NULL))
) STRICT;
CREATE INDEX questions_by_topic   ON questions(topic_id, pool, type, difficulty);
CREATE INDEX questions_by_pool    ON questions(pool, difficulty, marks);
CREATE INDEX questions_by_hash    ON questions(content_hash);
CREATE INDEX questions_by_pack    ON questions(pack_id);

-- MCQ / MSQ choices. option ids are stable, so a recorded pick keeps pointing at the
-- same choice even if the wording is fixed later. Edit options in place; never
-- delete-and-reinsert options of a question that has been answered.
CREATE TABLE question_options (
  id           INTEGER PRIMARY KEY,
  question_id  TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  position     INTEGER NOT NULL,          -- 0 = A, 1 = B, …
  body         TEXT NOT NULL,
  UNIQUE (question_id, id)                -- target of the same-question FK below
) STRICT;
CREATE INDEX question_options_by_question ON question_options(question_id, position);

-- Which choices are correct. Kept on the question, not on the options.
-- The composite FK means a correct option must belong to the same question.
CREATE TABLE question_correct_options (
  question_id  TEXT NOT NULL,
  option_id    INTEGER NOT NULL,
  PRIMARY KEY (question_id, option_id),
  FOREIGN KEY (question_id, option_id) REFERENCES question_options(question_id, id) ON DELETE CASCADE
) STRICT, WITHOUT ROWID;

-- Accepted answers for 'str' questions (several rows = several accepted answers).
CREATE TABLE question_text_answers (
  question_id  TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  position     INTEGER NOT NULL,
  value        TEXT NOT NULL,             -- for str_match 'list'/'set': comma-separated items
  PRIMARY KEY (question_id, position)
) STRICT, WITHOUT ROWID;

CREATE TABLE code_specs (
  question_id    TEXT PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
  language       TEXT NOT NULL CHECK (language IN ('python', 'c', 'cpp', 'java', 'javascript')),
  starter        TEXT,
  solution       TEXT,
  setup          TEXT,                    -- files/folders/tables needed on the learner's machine
  time_limit_ms  INTEGER NOT NULL DEFAULT 3000 CHECK (time_limit_ms > 0)
) STRICT;

CREATE TABLE code_tests (
  question_id  TEXT NOT NULL REFERENCES code_specs(question_id) ON DELETE CASCADE,
  position     INTEGER NOT NULL,
  input        TEXT NOT NULL,
  expected     TEXT NOT NULL,
  hidden       INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1)),
  PRIMARY KEY (question_id, position)
) STRICT, WITHOUT ROWID;

CREATE TABLE tags (
  id    INTEGER PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE              -- 'conceptual', 'figure-based', …
) STRICT;

CREATE TABLE question_tags (
  question_id  TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  tag_id       INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (question_id, tag_id)
) STRICT, WITHOUT ROWID;
CREATE INDEX question_tags_by_tag ON question_tags(tag_id, question_id);

-- Old versions of edited questions, so a past mock review shows exactly what you saw.
CREATE TABLE question_history (
  question_id  TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  rev          INTEGER NOT NULL,
  snapshot     TEXT NOT NULL CHECK (json_valid(snapshot)),  -- full question incl. options/answers
  replaced_at  INTEGER NOT NULL,
  PRIMARY KEY (question_id, rev)
) STRICT, WITHOUT ROWID;

-- Pictures: real binary, stored once by content hash. Metadata and bytes are split so
-- listing or checking images never drags megabytes of BLOB through memory.
CREATE TABLE images (
  hash        TEXT PRIMARY KEY,           -- the same 'h…' name used in img:<hash> links
  mime        TEXT NOT NULL CHECK (mime LIKE 'image/%'),
  byte_size   INTEGER NOT NULL CHECK (byte_size > 0),
  width       INTEGER,
  height      INTEGER,
  added_at    INTEGER NOT NULL
) STRICT;

CREATE TABLE image_data (
  hash   TEXT PRIMARY KEY REFERENCES images(hash) ON DELETE CASCADE,
  bytes  BLOB NOT NULL
) STRICT;

-- Which question uses which picture (filled when a question is saved by scanning its
-- stem, options and explanation). Makes "unused images" a single query.
CREATE TABLE question_images (
  question_id  TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  hash         TEXT NOT NULL REFERENCES images(hash),
  PRIMARY KEY (question_id, hash)
) STRICT, WITHOUT ROWID;
CREATE INDEX question_images_by_hash ON question_images(hash);

-- Full-text search over questions (admin editor, "find similar", search box).
-- Keyed on questions.n, an INTEGER PRIMARY KEY: VACUUM may renumber the hidden rowid of a
-- table without one, which would silently point search results at the wrong questions.
CREATE VIRTUAL TABLE questions_fts USING fts5(
  stem, explanation,
  content = 'questions', content_rowid = 'n',
  tokenize = 'unicode61 remove_diacritics 2'
);
CREATE TRIGGER questions_fts_ai AFTER INSERT ON questions BEGIN
  INSERT INTO questions_fts(rowid, stem, explanation) VALUES (new.n, new.stem, new.explanation);
END;
CREATE TRIGGER questions_fts_ad AFTER DELETE ON questions BEGIN
  INSERT INTO questions_fts(questions_fts, rowid, stem, explanation) VALUES ('delete', old.n, old.stem, old.explanation);
END;
CREATE TRIGGER questions_fts_au AFTER UPDATE OF stem, explanation ON questions BEGIN
  INSERT INTO questions_fts(questions_fts, rowid, stem, explanation) VALUES ('delete', old.n, old.stem, old.explanation);
  INSERT INTO questions_fts(rowid, stem, explanation) VALUES (new.n, new.stem, new.explanation);
END;

-- Mock tests point at questions; they never copy them.
CREATE TABLE mocks (
  id          TEXT PRIMARY KEY,
  pack_id     TEXT REFERENCES packs(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  minutes     INTEGER NOT NULL CHECK (minutes > 0),
  note        TEXT,
  sort        INTEGER NOT NULL DEFAULT 0,
  legacy_id   TEXT UNIQUE,
  retired_at  INTEGER
) STRICT;

CREATE TABLE mock_sections (
  id        INTEGER PRIMARY KEY,
  mock_id   TEXT NOT NULL REFERENCES mocks(id) ON DELETE CASCADE,
  position  INTEGER NOT NULL,
  name      TEXT NOT NULL,
  UNIQUE (mock_id, position)
) STRICT;

CREATE TABLE mock_items (
  section_id   INTEGER NOT NULL REFERENCES mock_sections(id) ON DELETE CASCADE,
  position     INTEGER NOT NULL,
  question_id  TEXT NOT NULL REFERENCES questions(id),
  PRIMARY KEY (section_id, position)
) STRICT, WITHOUT ROWID;
CREATE INDEX mock_items_by_question ON mock_items(question_id);

-- -----------------------------------------------------------------------------
-- Study plan
-- -----------------------------------------------------------------------------
CREATE TABLE plans (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT,
  is_active    INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
) STRICT;
CREATE UNIQUE INDEX plans_one_active ON plans(is_active) WHERE is_active = 1;

-- A phase runs from starts_on until the next phase starts. Days do NOT store their
-- phase (see v_plan_days), so the two can never disagree.
CREATE TABLE plan_phases (
  id         INTEGER PRIMARY KEY,
  plan_id    TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  code       TEXT NOT NULL,                -- 'A', 'B', …
  name       TEXT NOT NULL,
  starts_on  TEXT NOT NULL CHECK (starts_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  UNIQUE (plan_id, code),
  UNIQUE (plan_id, starts_on)
) STRICT;

CREATE TABLE milestones (
  id       INTEGER PRIMARY KEY,
  plan_id  TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  name     TEXT NOT NULL,
  short    TEXT,
  on_date  TEXT NOT NULL CHECK (on_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  note     TEXT
) STRICT;
CREATE INDEX milestones_by_date ON milestones(plan_id, on_date);

CREATE TABLE plan_days (
  id        INTEGER PRIMARY KEY,
  plan_id   TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  on_date   TEXT NOT NULL CHECK (on_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  kind      TEXT NOT NULL CHECK (kind IN ('study', 'light', 'mock', 'crunch', 'buffer', 'exam', 'taper')),
  title     TEXT NOT NULL,
  hours     REAL NOT NULL DEFAULT 0 CHECK (hours BETWEEN 0 AND 24),
  note      TEXT,                          -- the old links[date].note
  mock_id   TEXT REFERENCES mocks(id) ON DELETE SET NULL,
  UNIQUE (plan_id, on_date)
) STRICT;

-- Which topics a day works on (lets stats answer "how are my shaky topics this week?").
CREATE TABLE plan_day_topics (
  day_id    INTEGER NOT NULL REFERENCES plan_days(id) ON DELETE CASCADE,
  topic_id  TEXT NOT NULL REFERENCES topics(id),
  PRIMARY KEY (day_id, topic_id)
) STRICT, WITHOUT ROWID;
CREATE INDEX plan_day_topics_by_topic ON plan_day_topics(topic_id);

-- Tasks have their own IDs, so ticks survive adding, removing or reordering tasks.
CREATE TABLE plan_tasks (
  id        INTEGER PRIMARY KEY,
  day_id    INTEGER NOT NULL REFERENCES plan_days(id) ON DELETE CASCADE,
  position  REAL NOT NULL,                 -- REAL: insert between 1 and 2 as 1.5, no renumbering
  body      TEXT NOT NULL
) STRICT;
CREATE INDEX plan_tasks_by_day ON plan_tasks(day_id, position);

-- The questions linked to a day. A day's question target IS the number of rows here,
-- so there is no separate count that can disagree.
CREATE TABLE plan_day_questions (
  day_id       INTEGER NOT NULL REFERENCES plan_days(id) ON DELETE CASCADE,
  question_id  TEXT NOT NULL REFERENCES questions(id),
  position     INTEGER NOT NULL,
  PRIMARY KEY (day_id, question_id)        -- never the same question twice on one day
) STRICT, WITHOUT ROWID;
CREATE INDEX plan_day_questions_by_question ON plan_day_questions(question_id);

-- =============================================================================
-- STATE: what YOU did. Never stored inside content.
-- =============================================================================

-- Self-rating per topic (was topic.status inside the pack).
CREATE TABLE topic_ratings (
  topic_id    TEXT PRIMARY KEY REFERENCES topics(id) ON DELETE CASCADE,
  status      TEXT NOT NULL CHECK (status IN ('know', 'shaky', 'noidea')),
  updated_at  INTEGER NOT NULL
) STRICT;

CREATE TABLE task_ticks (
  task_id  INTEGER PRIMARY KEY REFERENCES plan_tasks(id) ON DELETE CASCADE,
  done_at  INTEGER NOT NULL
) STRICT;

-- Bonus items (carried-over work) the learner removed from a later day.
-- Exactly one of task_id / question_id is set.
CREATE TABLE bonus_dismissals (
  id           INTEGER PRIMARY KEY,
  from_day_id  INTEGER NOT NULL REFERENCES plan_days(id) ON DELETE CASCADE,
  task_id      INTEGER REFERENCES plan_tasks(id) ON DELETE CASCADE,
  question_id  TEXT REFERENCES questions(id),
  dismissed_at INTEGER NOT NULL,
  CHECK ((task_id IS NULL) <> (question_id IS NULL))
) STRICT;
-- Two partial indexes because UNIQUE treats NULLs as all different.
CREATE UNIQUE INDEX bonus_dismissals_task     ON bonus_dismissals(from_day_id, task_id)     WHERE task_id IS NOT NULL;
CREATE UNIQUE INDEX bonus_dismissals_question ON bonus_dismissals(from_day_id, question_id) WHERE question_id IS NOT NULL;

-- ONE row each time a practice question is shown. The row is updated when it is
-- answered. outcome NULL = seen but not answered = a real skip, recorded directly
-- (no more "views minus answers"). Re-opening a question makes a new row.
-- No size cap: history is never silently dropped.
CREATE TABLE practice_events (
  id            INTEGER PRIMARY KEY,
  question_id   TEXT NOT NULL REFERENCES questions(id),
  question_rev  INTEGER NOT NULL,
  shown_at      INTEGER NOT NULL,
  answered_at   INTEGER,
  outcome       TEXT CHECK (outcome IN ('right', 'wrong')),
  ms            INTEGER CHECK (ms IS NULL OR ms >= 0),   -- time spent before answering
  response      TEXT,                     -- typed NAT/str answer; code submissions keep only pass/fail
  day_id        INTEGER REFERENCES plan_days(id) ON DELETE SET NULL,  -- opened from this plan day
  CHECK ((outcome IS NULL) = (answered_at IS NULL)),
  CHECK (answered_at IS NULL OR answered_at >= shown_at)
) STRICT;
CREATE INDEX practice_events_by_question ON practice_events(question_id, shown_at);
CREATE INDEX practice_events_by_time     ON practice_events(shown_at);
CREATE INDEX practice_events_by_day      ON practice_events(day_id) WHERE day_id IS NOT NULL;

CREATE TABLE practice_event_picks (
  event_id   INTEGER NOT NULL REFERENCES practice_events(id) ON DELETE CASCADE,
  option_id  INTEGER NOT NULL REFERENCES question_options(id),
  PRIMARY KEY (event_id, option_id)
) STRICT, WITHOUT ROWID;
CREATE INDEX practice_event_picks_by_option ON practice_event_picks(option_id);

-- A sitting of a mock test (fixed mock, or one built from a recipe).
CREATE TABLE attempts (
  id             TEXT PRIMARY KEY,
  mock_id        TEXT REFERENCES mocks(id) ON DELETE SET NULL,  -- NULL = built from a recipe
  recipe         TEXT CHECK (recipe IS NULL OR json_valid(recipe)),
  title          TEXT NOT NULL,
  created_at     INTEGER NOT NULL,
  started_at     INTEGER,
  submitted_at   INTEGER,
  duration_sec   INTEGER NOT NULL CHECK (duration_sec > 0),
  failed_reason  TEXT,                     -- set = ended for leaving full screen; not scored
  warnings       TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(warnings)),
  score          REAL,                     -- cached at submit time
  max_score      REAL
) STRICT;
CREATE INDEX attempts_by_time ON attempts(submitted_at);

CREATE TABLE attempt_sections (
  attempt_id  TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  name        TEXT NOT NULL,
  PRIMARY KEY (attempt_id, position)
) STRICT, WITHOUT ROWID;

-- Responses are keyed by question_id, not by array index. question_rev + question_history
-- let the review screen show the question exactly as it was during the test.
CREATE TABLE attempt_items (
  attempt_id     TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  question_id    TEXT NOT NULL REFERENCES questions(id),
  position       INTEGER NOT NULL,
  section_pos    INTEGER NOT NULL,
  question_rev   INTEGER NOT NULL,
  response       TEXT,                     -- typed NAT/str answer (choices go in attempt_item_picks)
  visited        INTEGER NOT NULL DEFAULT 0 CHECK (visited IN (0, 1)),
  marked         INTEGER NOT NULL DEFAULT 0 CHECK (marked IN (0, 1)),
  ms             INTEGER CHECK (ms IS NULL OR ms >= 0),
  outcome        TEXT CHECK (outcome IN ('right', 'wrong', 'skip')),   -- set at submit
  marks_awarded  REAL,                     -- includes negative marking
  PRIMARY KEY (attempt_id, question_id),
  UNIQUE (attempt_id, position),
  FOREIGN KEY (attempt_id, section_pos) REFERENCES attempt_sections(attempt_id, position)
) STRICT, WITHOUT ROWID;
CREATE INDEX attempt_items_by_question ON attempt_items(question_id);

CREATE TABLE attempt_item_picks (
  attempt_id   TEXT NOT NULL,
  question_id  TEXT NOT NULL,
  option_id    INTEGER NOT NULL REFERENCES question_options(id),
  PRIMARY KEY (attempt_id, question_id, option_id),
  FOREIGN KEY (attempt_id, question_id) REFERENCES attempt_items(attempt_id, question_id) ON DELETE CASCADE
) STRICT, WITHOUT ROWID;

-- Running totals per question, kept up to date by the triggers below, so mastery,
-- mistakes and per-topic accuracy are instant lookups instead of scans of the whole
-- answer history (important on slow machines). It is a cache: "Reset stats" deletes it
-- with the events, and docs/STORAGE.md has the one query that rebuilds it.
--
-- The triggers do NOT add to running counters. Whenever an answer for a question is
-- added, changed or deleted (including a whole attempt being deleted or marked failed),
-- they RECOMPUTE that question's row from v_answers. This reads only that question's
-- answers (a few rows, through an index), and it stays correct when answers are deleted
-- or arrive out of time order. Every trigger uses the same statement pair:
--   DELETE FROM question_stats WHERE question_id IN (<ids>);
--   INSERT INTO question_stats ... SELECT ... FROM v_answers WHERE question_id IN (<ids>) ...;
-- (SQLite does not allow WITH inside triggers, hence the subquery form.)
CREATE TABLE question_stats (
  question_id   TEXT PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
  answers       INTEGER NOT NULL DEFAULT 0,
  rights        INTEGER NOT NULL DEFAULT 0,
  streak        INTEGER NOT NULL DEFAULT 0,      -- rights in a row, ending at the latest answer
  last_outcome  TEXT CHECK (last_outcome IN ('right', 'wrong')),
  last_at       INTEGER,
  total_ms      INTEGER NOT NULL DEFAULT 0
) STRICT;

-- Practice answer added (row inserted already answered).
CREATE TRIGGER question_stats_practice_ins AFTER INSERT ON practice_events
WHEN new.outcome IS NOT NULL BEGIN
  DELETE FROM question_stats WHERE question_id = new.question_id;
  INSERT INTO question_stats(question_id, answers, rights, streak, last_outcome, last_at, total_ms)
  SELECT question_id, COUNT(*), SUM(outcome = 'right'),
         coalesce(MIN(CASE WHEN outcome = 'wrong' THEN rn END) - 1, COUNT(*)),
         MAX(CASE WHEN rn = 1 THEN outcome END), MAX(at), SUM(ms)
  FROM (SELECT question_id, outcome, at, coalesce(ms, 0) AS ms,
               ROW_NUMBER() OVER (PARTITION BY question_id ORDER BY at DESC) AS rn
        FROM v_answers WHERE question_id = new.question_id AND outcome IN ('right', 'wrong'))
  GROUP BY question_id;
END;
-- Practice answer given, corrected or moved (a shown row gets answered, etc.).
CREATE TRIGGER question_stats_practice_upd AFTER UPDATE OF question_id, outcome, answered_at, ms ON practice_events
WHEN old.outcome IS NOT NULL OR new.outcome IS NOT NULL BEGIN
  DELETE FROM question_stats WHERE question_id IN (old.question_id, new.question_id);
  INSERT INTO question_stats(question_id, answers, rights, streak, last_outcome, last_at, total_ms)
  SELECT question_id, COUNT(*), SUM(outcome = 'right'),
         coalesce(MIN(CASE WHEN outcome = 'wrong' THEN rn END) - 1, COUNT(*)),
         MAX(CASE WHEN rn = 1 THEN outcome END), MAX(at), SUM(ms)
  FROM (SELECT question_id, outcome, at, coalesce(ms, 0) AS ms,
               ROW_NUMBER() OVER (PARTITION BY question_id ORDER BY at DESC) AS rn
        FROM v_answers WHERE question_id IN (old.question_id, new.question_id) AND outcome IN ('right', 'wrong'))
  GROUP BY question_id;
END;
-- Practice answer deleted.
CREATE TRIGGER question_stats_practice_del AFTER DELETE ON practice_events
WHEN old.outcome IS NOT NULL BEGIN
  DELETE FROM question_stats WHERE question_id = old.question_id;
  INSERT INTO question_stats(question_id, answers, rights, streak, last_outcome, last_at, total_ms)
  SELECT question_id, COUNT(*), SUM(outcome = 'right'),
         coalesce(MIN(CASE WHEN outcome = 'wrong' THEN rn END) - 1, COUNT(*)),
         MAX(CASE WHEN rn = 1 THEN outcome END), MAX(at), SUM(ms)
  FROM (SELECT question_id, outcome, at, coalesce(ms, 0) AS ms,
               ROW_NUMBER() OVER (PARTITION BY question_id ORDER BY at DESC) AS rn
        FROM v_answers WHERE question_id = old.question_id AND outcome IN ('right', 'wrong'))
  GROUP BY question_id;
END;
-- Mock item scored or rescored (outcomes are written at submit; during the exam outcome
-- stays NULL, so the frequent ms/visited updates never fire this).
CREATE TRIGGER question_stats_mock_upd AFTER UPDATE OF outcome, ms ON attempt_items
WHEN old.outcome IS NOT NULL OR new.outcome IS NOT NULL BEGIN
  DELETE FROM question_stats WHERE question_id = new.question_id;
  INSERT INTO question_stats(question_id, answers, rights, streak, last_outcome, last_at, total_ms)
  SELECT question_id, COUNT(*), SUM(outcome = 'right'),
         coalesce(MIN(CASE WHEN outcome = 'wrong' THEN rn END) - 1, COUNT(*)),
         MAX(CASE WHEN rn = 1 THEN outcome END), MAX(at), SUM(ms)
  FROM (SELECT question_id, outcome, at, coalesce(ms, 0) AS ms,
               ROW_NUMBER() OVER (PARTITION BY question_id ORDER BY at DESC) AS rn
        FROM v_answers WHERE question_id = new.question_id AND outcome IN ('right', 'wrong'))
  GROUP BY question_id;
END;
-- Mock item deleted (also fires for each item when a whole attempt is deleted, via CASCADE).
CREATE TRIGGER question_stats_mock_del AFTER DELETE ON attempt_items
WHEN old.outcome IN ('right', 'wrong') BEGIN
  DELETE FROM question_stats WHERE question_id = old.question_id;
  INSERT INTO question_stats(question_id, answers, rights, streak, last_outcome, last_at, total_ms)
  SELECT question_id, COUNT(*), SUM(outcome = 'right'),
         coalesce(MIN(CASE WHEN outcome = 'wrong' THEN rn END) - 1, COUNT(*)),
         MAX(CASE WHEN rn = 1 THEN outcome END), MAX(at), SUM(ms)
  FROM (SELECT question_id, outcome, at, coalesce(ms, 0) AS ms,
               ROW_NUMBER() OVER (PARTITION BY question_id ORDER BY at DESC) AS rn
        FROM v_answers WHERE question_id = old.question_id AND outcome IN ('right', 'wrong'))
  GROUP BY question_id;
END;
-- An attempt's submit time or failed status changes: recompute all of its questions.
CREATE TRIGGER question_stats_attempt_upd AFTER UPDATE OF submitted_at, failed_reason ON attempts BEGIN
  DELETE FROM question_stats WHERE question_id IN (SELECT question_id FROM attempt_items WHERE attempt_id = new.id);
  INSERT INTO question_stats(question_id, answers, rights, streak, last_outcome, last_at, total_ms)
  SELECT question_id, COUNT(*), SUM(outcome = 'right'),
         coalesce(MIN(CASE WHEN outcome = 'wrong' THEN rn END) - 1, COUNT(*)),
         MAX(CASE WHEN rn = 1 THEN outcome END), MAX(at), SUM(ms)
  FROM (SELECT question_id, outcome, at, coalesce(ms, 0) AS ms,
               ROW_NUMBER() OVER (PARTITION BY question_id ORDER BY at DESC) AS rn
        FROM v_answers
        WHERE question_id IN (SELECT question_id FROM attempt_items WHERE attempt_id = new.id)
          AND outcome IN ('right', 'wrong'))
  GROUP BY question_id;
END;
-- Outcomes may only be written for a submitted, non-failed attempt.
CREATE TRIGGER attempt_items_only_scored BEFORE UPDATE OF outcome ON attempt_items
WHEN new.outcome IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM attempts WHERE id = new.attempt_id AND submitted_at IS NOT NULL AND failed_reason IS NULL)
BEGIN SELECT RAISE(ABORT, 'outcome on an unsubmitted or failed attempt'); END;

-- Code being written, autosaved (debounced) per question.
CREATE TABLE code_drafts (
  question_id  TEXT PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
  language     TEXT NOT NULL,
  body         TEXT NOT NULL,
  work_dir     TEXT,
  updated_at   INTEGER NOT NULL
) STRICT;

-- =============================================================================
-- VIEWS: statistics computed by SQLite inside the worker, not by React.
-- =============================================================================

-- Plan days with their phase worked out from plan_phases.
CREATE VIEW v_plan_days AS
SELECT d.*,
       (SELECT p.code FROM plan_phases p
         WHERE p.plan_id = d.plan_id AND p.starts_on <= d.on_date
         ORDER BY p.starts_on DESC LIMIT 1) AS phase_code
FROM plan_days d;

-- Every answer from practice and from scored mocks, in one shape. Stats start here.
CREATE VIEW v_answers AS
SELECT 'practice' AS source, e.question_id, e.answered_at AS at, e.outcome, e.ms, NULL AS attempt_id
FROM practice_events e
WHERE e.answered_at IS NOT NULL
UNION ALL
SELECT 'mock', i.question_id, a.submitted_at, i.outcome, i.ms, a.id
FROM attempt_items i
JOIN attempts a ON a.id = i.attempt_id
WHERE a.submitted_at IS NOT NULL AND a.failed_reason IS NULL;

-- Mastery state per answered question (mastered = right the last 3 times in a row).
CREATE VIEW v_question_mastery AS
SELECT question_id, last_outcome, last_at, answers, rights, streak,
       CASE
         WHEN streak >= 3              THEN 'mastered'
         WHEN last_outcome = 'right'   THEN 'learning'
         WHEN rights > 0               THEN 'slipped'
         ELSE 'struggling'
       END AS mastery
FROM question_stats;

-- Mistakes = questions whose latest answer is wrong ("fixed" is no longer stored:
-- a mistake is fixed the moment its latest answer is right).
CREATE VIEW v_mistakes AS
SELECT q.id AS question_id, q.topic_id, m.last_at
FROM v_question_mastery m JOIN questions q ON q.id = m.question_id
WHERE m.last_outcome = 'wrong' AND q.retired_at IS NULL;

-- Accuracy per topic (practice + mocks).
CREATE VIEW v_topic_accuracy AS
SELECT t.id AS topic_id, t.subject_id, t.name,
       coalesce(SUM(s.answers), 0)              AS answered,
       coalesce(SUM(s.rights), 0)               AS rights,
       ROUND(1.0 * SUM(s.rights) / NULLIF(SUM(s.answers), 0), 3) AS accuracy,
       r.status                                 AS self_rating
FROM topics t
LEFT JOIN questions q      ON q.topic_id = t.id
LEFT JOIN question_stats s ON s.question_id = q.id
LEFT JOIN topic_ratings r  ON r.topic_id = t.id
GROUP BY t.id;

-- Per plan day: tasks ticked and linked questions answered (on any date).
CREATE VIEW v_day_progress AS
SELECT d.id AS day_id, d.plan_id, d.on_date,
       (SELECT COUNT(*) FROM plan_tasks k WHERE k.day_id = d.id)                                    AS tasks,
       (SELECT COUNT(*) FROM plan_tasks k JOIN task_ticks x ON x.task_id = k.id WHERE k.day_id = d.id) AS tasks_done,
       (SELECT COUNT(*) FROM plan_day_questions l WHERE l.day_id = d.id)                            AS questions,
       (SELECT COUNT(*) FROM plan_day_questions l
          WHERE l.day_id = d.id
            AND EXISTS (SELECT 1 FROM practice_events e
                        WHERE e.question_id = l.question_id AND e.answered_at IS NOT NULL))         AS questions_answered
FROM plan_days d;

-- Repeated wrong picks ("traps"): the same wrong option chosen at least twice.
CREATE VIEW v_traps AS
SELECT o.question_id, o.id AS option_id, o.position, COUNT(*) AS times_picked
FROM practice_event_picks p
JOIN question_options o ON o.id = p.option_id
WHERE NOT EXISTS (SELECT 1 FROM question_correct_options c
                  WHERE c.question_id = o.question_id AND c.option_id = o.id)
GROUP BY o.id HAVING COUNT(*) >= 2;
