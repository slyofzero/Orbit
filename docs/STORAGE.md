# Orbit storage: design and rules

The schema itself is [`db/schema.sql`](../db/schema.sql); every table also has a TypeScript type in `types/tables/` with the same columns (`bun run check` compares them). This file explains why it looks the way it does and the rules the app must follow so it **never freezes, even on a low-spec laptop**.

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
 Leader tab (holds the Web Lock)                         Worker thread (leader tab only)
 ───────────────────────────────                         ───────────────────────────────
 components ──► lib/db/client.ts ──postMessage──────────► lib/db/worker.ts
   useQuery("db.counts")            ◄── results ───────   opens SQLite (opfs-sahpool), migrates
   useMutation("plan.tickTask")                           runs NAMED queries (lib/db/queries/)
                    ▲ │                                   one transaction per write
   BroadcastChannel │ │ "changed" / results               reports every table a write changed
   "orbit-db:<profile>"
                    │ ▼
 Follower tabs: lib/db/client.ts sends calls to the leader; screens work exactly the same
```

| File | Job |
|---|---|
| `lib/db/client.ts` | `useQuery`, `useMutation`, `useDbStatus`, `dbCall`. Elects the leader tab and routes calls. |
| `lib/db/worker.ts` | Opens the database and runs named queries. The only code that touches SQLite. |
| `lib/db/queries/` | **The named queries**: every piece of SQL the app runs, one file per area (`plan.ts`, `practice.ts`, `backup.ts`…) joined in `index.ts`. |
| `lib/db/sql.ts` | The `Sql` interface queries are written against, `TABLES`, `transaction()`. |
| `lib/db/codec.ts` | Arrays ⇄ JSON text, booleans ⇄ 0/1, so screens get the `types/tables/` shapes. |
| `lib/db/effects.ts` | Works out from the schema which tables a write changes through triggers and cascades. |
| `lib/db/migrate.ts`, `migrations.ts` | Schema upgrades on open. |
| `app/dev/db` | Dev page to try it live in several tabs. |

- **Named queries, not SQL strings from the UI.** The registry in `lib/db/queries/` (`index.ts` joins one file per area) holds every query (`"db.counts"`, later `"practice.page"`, `"stats.topicStrength"`…). A screen sends a name and parameters and gets plain, typed objects back. The worker keeps each statement prepared after its first use.
- **Change notifications.** A write query lists the tables its own SQL writes. The worker adds every table its triggers and cascades reach (from the schema, `lib/db/effects.ts`) and announces them to every tab. `useQuery` re-runs only queries that read one of those tables. For example, an answer refreshes `question_stats` and `plan_day_progress` readers too.
- **The same queries run in tests.** `bun run check` (`scripts/checks/`) runs the real registry, migrations and change tracking on bun's SQLite.

### Several tabs
`opfs-sahpool` lets only one connection open the file, so the tabs elect a **leader**:
1. Every tab asks for the Web Lock `orbit-db:<profile>`. The tab that gets it starts the worker, opens the database and announces itself on the `BroadcastChannel`.
2. Other tabs are **followers**. They send their calls to the leader and get results back over the channel (well under 1 ms more per call).
3. After a write, the leader tells every tab which tables changed, so all tabs stay live.
4. When the leader tab closes, the browser frees the lock and the next tab takes over. It retries opening for a few seconds while the old tab's file handles are released. Then every tab re-sends the calls still waiting. The leader remembers answers for a minute, so a re-sent call that already ran is never run twice.

Checked in real Chrome (two and three tabs, a closed leader, a reload): every step works with no console errors.

---

## 3. Rules that keep the app from freezing

1. **No database work on the main thread. Ever.** No `localStorage` for app data, no `JSON.parse` of large data on the UI thread.
2. **Every list query has `LIMIT`.** Lists page with *keyset* pagination (`WHERE (sort, id) > (?, ?) LIMIT 50`), never `OFFSET` on large tables.
3. **Long lists are virtualised** (only visible rows are in the DOM). This matters for the question table, the admin editor and the stats tables.
4. **Results crossing the worker boundary stay small** (≤ a few hundred rows of plain data). Totals and charts are computed in SQL, not by sending raw rows to React.
5. **Every write is one transaction.** For example, submitting a mock writes the scores of all its items in one transaction (one disk flush, all-or-nothing).
6. **Big imports run in chunks** of about 200 questions per transaction, posting progress between chunks, so a 5,000-question pack shows a progress bar instead of hanging.
7. **Images never travel as base64.** The worker reads `images.bytes` → `Blob` → `URL.createObjectURL`; `<img loading="lazy" decoding="async">`; object URLs are revoked when the component unmounts.
8. **KaTeX and code highlighting are lazy**: render only when a card scrolls into view, and cache the rendered HTML per question (keyed by `updated_at`) in memory.
9. **Writes from typing are debounced** (mock answers being typed: 500 ms), never one write per keystroke.
10. **Errors are surfaced, never swallowed.** A failed write shows a toast with a "Back up now" action. (The old `catch {}` hid full-storage errors.)

### Low-spec settings
- `PRAGMA cache_size = -4000` (4 MB page cache) and `temp_store = MEMORY`. Total worker memory stays around 15–25 MB besides the WASM itself.
- Heavy stats come from `question_stats`, a summary table that triggers keep up to date, so the stats page reads about 5,000 small rows instead of every answer ever given.
- Measured on the real data (5,829 questions, 1,676 images, 91 plan days) plus 20,000 synthetic practice answers and 13 scored mocks, natively: every UI query below **12 ms**. Expect 2–3× in WASM on a slow laptop, still well under a frame budget because it happens off the main thread.

---

## 4. Schema at a glance

Folders are the ones in `types/tables/`. **Content** says what things *are*; re-importing a pack replaces it. **State** says what *you did*; content changes never touch it.

```
catalog/    subjects ─< topics ─< questions                 content
            topic_ratings                                   state: know / shaky / no idea
            tags, packs                                     content
            images (bytes last)                             content, shared

questions/  questions ─┬── question_mcq | _msq | _nat | _str | _code   (one row, by type)
                       ├─< question_tags >── tags
                       ├─< question_images >── images
                       ├─< question_answers                state: 1 row per question per sitting
                       └── question_stats                  state cache (triggers)
            questions_fts                                  search index (triggers)

mocks/      mocks ─< mock_sections ─< mock_items >── questions        content
            mock_attempts ─< mock_attempt_items                       state
                  └──< question_answers (attempt_id, written at submit)

plans/      plans ─< plan_days ─┬─< plan_tasks ── plan_task_ticks     content ── state
                                ├─< plan_day_questions ── plan_question_ticks
                                └── plan_day_progress                 state cache (triggers)
```

**Rules the database enforces itself** (so a bug in the app can't break the data):
- A type row (`question_mcq`…) must match its question's `type`, and a question's type can't change.
- Arrays are JSON and checked (`mcq` needs ≥ 2 options and an in-range answer; `str` ≥ 1 accepted answer).
- A question that anything points at can't be deleted (retire it).
- A question is in a mock at most once; only one mock attempt is in progress; a finished attempt stays finished; mock answers are only accepted once the attempt is submitted (and once per question).
- One active plan; plan days stay inside the plan's dates.
- Linked plan questions are ticked by a trigger when answered (rules: `docs/PLANS.md`).

**Views:** only `v_plan_day_progress` (the from-scratch version of `plan_day_progress`). Statistics are named queries in the worker (`docs/STATS.md`), not views.

---

## 5. How each problem from the 16 Nov audit is fixed

| Problem in v2 | Fix in the new schema |
|---|---|
| Images as base64 = 92% of export; pack text near the 5 MB localStorage cap; failed writes silent | Binary BLOBs in `images` in OPFS (GB-scale limit), stored once per hash; write errors surface |
| `answer` had 5 shapes + `match` flag; code fields loose at top level | One table per type (`question_mcq` … `question_code`) with checked columns; a type row must match its question |
| Questions copied into mocks and into every attempt; responses keyed by index | `mock_items` and `mock_attempt_items` reference `questions.id`; responses keyed by question. (No question history: editing a question changes old reviews, by choice.) |
| IDs encode topic (`t20-4`); 5 ID schemes | Opaque IDs (`q_…`, `tp_…`, `mk_…`); old IDs kept in `legacy_id` for imports and AI links |
| Overlapping subjects `dsa` / `prog` / `code` | Still data, not schema: merge them during import (decision for you) |
| Self-rating stored inside the pack | `topic_ratings` (state) |
| Plan `questions` count disagreed with links on 65/77 days; links a parallel array | Target = `COUNT(plan_day_questions)`; links live under the day |
| Ticks keyed `date:index` | `plan_task_ticks.task_id`; tasks use `REAL` positions so inserting never renumbers |
| `practice` and `fixed` maps duplicated the log | Derived from `question_answers`: `question_stats`, mistake log query |
| Log and views capped at 20k, skips inferred | `question_answers` has no cap; a skip is recorded directly (`outcome = 'skipped'`) |
| No duplicate detection | `content_hash` index (0 true duplicates in the current data) |

---

## 6. Operational notes

### Migrations
`PRAGMA user_version` holds the schema version (this file sets 1). The worker runs `db/migrations/NNN-*.sql` in order inside one transaction on open. **Never edit a shipped migration**; add a new one.

### Reset stats
```sql
DELETE FROM question_answers; DELETE FROM mock_attempts;
```
The triggers empty `question_stats` and remove plan question ticks with the answers. Content, task ticks and ratings stay.

### Rebuild the caches (after a migration, or if one is ever suspected to be wrong)
```sql
DELETE FROM question_stats;
INSERT INTO question_stats
  SELECT question_id, COUNT(*), SUM(outcome = 'correct'), SUM(outcome = 'incorrect')
  FROM question_answers GROUP BY question_id;

DELETE FROM plan_day_progress;
INSERT INTO plan_day_progress(day_id, plan_id, on_date, tasks_total, tasks_done,
                              questions_total, questions_done, done_at)
  SELECT * FROM v_plan_day_progress;
```
The triggers run the same statements limited to the question or day that changed. They **recompute** instead of adding to counters, so they stay right when rows are deleted. `bun run check` checks that triggers and full rebuilds give identical rows.

**Trigger rule:** triggers never use `INSERT OR REPLACE` / `OR IGNORE`. SQLite lets an outer statement's `OR` clause override the ones inside the triggers it fires, which silently skipped cache updates in testing. Use `DELETE` + `INSERT` and `WHERE NOT EXISTS`.

### Backup and restore
- **Built so far: a JSON backup** (`lib/backup.ts`): `backup.export` writes every table as `orbit-backup-YYYY-MM-DD.json` (pictures as base64; the two caches are rebuilt by triggers), `backup.import` checks it, empties the database and puts the rows back in parent-first order, in one transaction. Start fresh is `app.startFresh`. The `.sqlite3` file backup below is not built.
- **Backup** (planned) = export the profile's database file (`orbit-<profile>-YYYY-MM-DD.sqlite3`). One file, includes images. It opens in any SQLite tool (DB Browser for SQLite, `sqlite3`), so your data is never locked inside Orbit.
- **Restore** = import that file into the pool, then run migrations.
- **Packs and plans** keep a JSON interchange format for sharing and AI round-trips (pack v3: questions in the new shape, images as a separate folder or zip). The importer also accepts v2 exports and maps old IDs through `legacy_id`.

### Tabs and mock tests
Any number of tabs can be open; one leads and the rest go through it (§2). Only one mock test can be in progress at a time across all tabs (the database refuses a second).

### Schema changes
New files get `db/schema.sql` (version 1). Every later change is a migration: `db/migrations/NNN-*.sql`, listed in `lib/db/migrations.ts`. Each runs once, in order, in its own transaction. A file saved by a newer Orbit is refused, never touched.

### Migrating from v2 (localStorage)
One-time importer, run in the worker:
1. Pack → subjects, topics (+ `topic_ratings` from `status`), questions (new opaque IDs, `legacy_id` = old ID) + their type rows, tags, images (base64 → BLOB), mocks (mock questions get `pool = 'mock'`).
2. Plan + links → plans, days (+ notes), tasks, day questions. (Phases, milestones and day mocks wait for their tables: `docs/PLANS.md` §6.)
3. `gate.done` (`date:idx`) → `plan_task_ticks` via the day's task at that position.
4. `gate.plog` → `question_answers` (`recorded_at = at`, `time_ms = ms`, `attempt_id` null); `gate.views` with no matching answer → `skipped` rows.
5. `gate.attempts` → `mock_attempts` + `mock_attempt_items` matched by legacy ID (embedded questions that no longer exist are inserted as retired); submitted ones also write their `question_answers`.
6. The triggers fill `question_stats`, plan ticks and `plan_day_progress` along the way. Keep the old keys untouched until you confirm the new data looks right.
