# Orbit storage: design and rules

The schema itself is [`db/schema.sql`](../db/schema.sql). This file explains why it looks the way it does and the rules the app must follow so it **never freezes, even on a low-spec laptop**.

---

## 1. The decision

| | Choice | Why |
|---|---|---|
| Engine | **SQLite**, official WASM build (`@sqlite.org/sqlite-wasm`) | Real SQL (joins, `GROUP BY`, window functions) for a stats-heavy app; constraints and foreign keys keep data valid; FTS5 search built in; about 1 MB of WASM, loaded once and cached |
| Where the file lives | **OPFS** (Origin Private File System) through the **`opfs-sahpool`** VFS | Fast file storage inside the browser with a storage limit in the gigabytes; `opfs-sahpool` needs **no** special COOP/COEP headers, so hosting stays simple |
| Where it runs | **One dedicated Web Worker** | The UI thread **never** touches the database. A slow query can only make one panel load slower; it cannot freeze scrolling, typing or the exam timer |
| Files | **One database file per profile**: `orbit-<profileId>.sqlite3` | Profiles stay isolated; a backup is a single file; admin opens other profiles' files read-only |
| Still in localStorage | Only `orbit.profiles`, `orbit.activeProfile` and `orbit.theme` | They are tiny and needed **before** the worker boots (to avoid a theme flash) |

Why not IndexedDB (via Dexie)? It would also stay off the main thread for storage, but every statistic would be a JavaScript loop over all events, which is exactly the work that freezes slow machines. SQLite does that work in compiled C inside the worker, using indexes.

---

## 2. Architecture

```
 UI thread (React)                        Worker thread
 ──────────────────                       ─────────────────────────────────
 components ──► lib/db/client.ts  ──postMessage──►  lib/db/worker.ts
   useQuery(name, params)                 │  opens SQLite (opfs-sahpool)
   useMutation(name)                      │  runs NAMED queries only
   ◄── small JSON results ──────────────  │  one transaction per mutation
                                          │  imports in chunks + progress
   image: <img src={blobUrl}>  ◄─ Blob ── │  image_data.bytes → Blob
```

- **Named queries, not SQL strings from the UI.** The worker owns a registry (`"practice.page"`, `"stats.topicAccuracy"`, …). The UI sends a name and parameters and gets plain objects back. This keeps SQL in one place and lets the worker cache prepared statements.
- **Change notifications.** After each mutation the worker broadcasts the tables it touched (`{changed: ["practice_events", "question_stats"]}`); `useQuery` hooks re-run only if they read one of those tables. This replaces the old `gate-store` window events.

---

## 3. Rules that keep the app from freezing

1. **No database work on the main thread. Ever.** No `localStorage` for app data, no `JSON.parse` of large data on the UI thread.
2. **Every list query has `LIMIT`.** Lists page with *keyset* pagination (`WHERE (sort, id) > (?, ?) LIMIT 50`), never `OFFSET` on large tables.
3. **Long lists are virtualised** (only visible rows are in the DOM). This matters for the question table, the admin editor and the stats tables.
4. **Results crossing the worker boundary stay small** (≤ a few hundred rows of plain data). Totals and charts are computed in SQL, not by sending raw rows to React.
5. **Every write is one transaction.** For example, submitting a mock writes the scores of all its items in one transaction (one disk flush, all-or-nothing).
6. **Big imports run in chunks** of about 200 questions per transaction, posting progress between chunks, so a 5,000-question pack shows a progress bar instead of hanging.
7. **Images never travel as base64.** The worker reads `image_data.bytes` → `Blob` → `URL.createObjectURL`; `<img loading="lazy" decoding="async">`; object URLs are revoked when the component unmounts.
8. **KaTeX and code highlighting are lazy**: render only when a card scrolls into view, and cache the rendered HTML per question revision in memory.
9. **Writes from typing are debounced** (code drafts: 500 ms), never one write per keystroke.
10. **Errors are surfaced, never swallowed.** A failed write shows a toast with a "Back up now" action. (The old `catch {}` hid full-storage errors.)

### Low-spec settings
- `PRAGMA cache_size = -4000` (4 MB page cache) and `temp_store = MEMORY`. Total worker memory stays around 15–25 MB besides the WASM itself.
- Heavy stats come from `question_stats`, a summary table that triggers keep up to date, so the stats page reads about 5,000 small rows instead of every answer ever given.
- Measured on the real data (5,829 questions, 1,676 images, 91 plan days) plus 20,000 synthetic practice answers and 13 scored mocks, natively: every UI query below **12 ms**. Expect 2–3× in WASM on a slow laptop, still well under a frame budget because it happens off the main thread.

---

## 4. Schema at a glance

**Content** (what things *are*; re-importing content never touches state):

```
subjects ─< topics ─< questions ─< question_options        (mcq/msq choices)
                         │      ─< question_correct_options (mcq/msq: which choices are right)
                         │      ─< question_text_answers   (str: accepted answers)
                         │      ── code_specs ─< code_tests (code)
                         │      ─< question_tags >─ tags
                         │      ─< question_images >─ images ── image_data (BLOB)
                         │      ─< question_history         (old revisions)
mocks ─< mock_sections ─< mock_items >── questions          (references, never copies)
plans ─< plan_phases
      ─< milestones
      ─< plan_days ─< plan_tasks
                   ─< plan_day_questions >── questions
                   ─< plan_day_topics   >── topics
                   ── mock_id ──> mocks
```

**State** (what *you did*):

```
topic_ratings      know / shaky / noidea per topic
task_ticks         per task ID
bonus_dismissals   carried-over items you removed
practice_events ─< practice_event_picks      one row per question shown; skip = outcome NULL
attempts ─< attempt_sections
         ─< attempt_items ─< attempt_item_picks   responses keyed by question_id
question_stats     summary cache (triggers)
code_drafts, settings
```

**Views:** `v_plan_days` (adds the phase), `v_answers` (practice + scored mocks in one shape), `v_question_mastery`, `v_mistakes`, `v_topic_accuracy`, `v_day_progress`, `v_traps`.

---

## 5. How each problem from the 16 Nov audit is fixed

| Problem in v2 | Fix in v1 schema |
|---|---|
| Images as base64 = 92% of export; pack text near the 5 MB localStorage cap; failed writes silent | Binary `image_data` BLOBs in OPFS (GB-scale limit), metadata split into `images`; write errors surface |
| `answer` had 5 shapes + `match` flag; code fields loose at top level | `question_correct_options`, `nat_value/nat_tol`, `question_text_answers`, `code_specs`/`code_tests`; `CHECK`s make half-filled questions impossible |
| Questions copied into mocks and into every attempt; responses keyed by index | `mock_items` and `attempt_items` reference `questions.id`; `question_rev` + `question_history` keep the as-taken version |
| IDs encode topic (`t20-4`); 5 ID schemes | Opaque IDs (`q_…`, `tp_…`, `mk_…`); old IDs kept in `legacy_id` for imports and AI links |
| Overlapping subjects `dsa` / `prog` / `code` | Still data, not schema: merge them during import (decision for you) |
| Self-rating stored inside the pack | `topic_ratings` (state) |
| Plan `questions` count disagreed with links on 65/77 days; links a parallel array; phase stored twice | Target = `COUNT(plan_day_questions)`; links live under the day; phase derived in `v_plan_days` |
| Days had no topics | `plan_day_topics` |
| Ticks keyed `date:index` | `task_ticks.task_id`; tasks use `REAL` positions so inserting never renumbers |
| `practice` and `fixed` maps duplicated the log | Derived: `question_stats`, `v_mistakes` |
| Log and views capped at 20k, skips inferred | `practice_events` has no cap; a skip is recorded directly (`outcome IS NULL`) |
| No duplicate detection | `content_hash` index (0 true duplicates in the current data) |

---

## 6. Operational notes

### Migrations
`PRAGMA user_version` holds the schema version (this file sets 1). The worker runs `db/migrations/NNN-*.sql` in order inside one transaction on open. **Never edit a shipped migration**; add a new one.

### Reset stats
```sql
DELETE FROM practice_events; DELETE FROM attempts; DELETE FROM question_stats;
```
Content, plan, ticks and ratings stay.

### Rebuild `question_stats` (after a migration, or if it is ever suspected to be wrong)
```sql
DELETE FROM question_stats;
INSERT INTO question_stats(question_id, answers, rights, streak, last_outcome, last_at, total_ms)
SELECT question_id, COUNT(*), SUM(outcome = 'right'),
       coalesce(MIN(CASE WHEN outcome = 'wrong' THEN rn END) - 1, COUNT(*)),
       MAX(CASE WHEN rn = 1 THEN outcome END), MAX(at), SUM(ms)
FROM (SELECT question_id, outcome, at, coalesce(ms, 0) AS ms,
             ROW_NUMBER() OVER (PARTITION BY question_id ORDER BY at DESC) AS rn
      FROM v_answers WHERE outcome IN ('right', 'wrong'))
GROUP BY question_id;
```
The triggers run this same statement, limited to the questions an insert, update or delete touched. So the triggers stay correct when answers are deleted (one event, one attempt) or arrive out of time order. `bun run check` checks that the triggers and this full rebuild produce identical rows.

### Backup and restore
- **Backup** = export the profile's database file (`orbit-<profile>-YYYY-MM-DD.sqlite3`). One file, includes images. It opens in any SQLite tool (DB Browser for SQLite, `sqlite3`), so your data is never locked inside Orbit.
- **Restore** = import that file into the pool, then run migrations.
- **Packs and plans** keep a JSON interchange format for sharing and AI round-trips (pack v3: questions in the new shape, images as a separate folder or zip). The importer also accepts v2 exports and maps old IDs through `legacy_id`.

### One tab at a time
`opfs-sahpool` allows a single open connection. The worker takes a Web Lock (`navigator.locks.request("orbit-db")`); a second tab shows *"Orbit is open in another tab"* with a **Use here** button that asks the first tab to close its connection.

### Migrating from v2 (localStorage)
One-time importer, run in the worker:
1. Pack → subjects, topics (+ `topic_ratings` from `status`), questions (new opaque IDs, `legacy_id` = old ID), options/answers, tags, images (base64 → BLOB), mocks (mock questions get `pool = 'mock'`).
2. Plan + links → plans, phases, milestones, days (+ notes, mock), tasks, day questions.
3. `gate.done` (`date:idx`) → `task_ticks` via the day's task at that position.
4. `gate.plog` → `practice_events` (`answered_at = at`, `shown_at = at - ms`) + picks mapped to option IDs; `gate.views` with no matching answer → unanswered events.
5. `gate.attempts` → attempts + items matched by legacy ID (embedded questions that no longer exist are inserted as retired).
6. Rebuild `question_stats`. Keep the old keys untouched until you confirm the new data looks right.
