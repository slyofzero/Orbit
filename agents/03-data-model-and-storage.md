# 3. Data model and storage

## Where data lives
- **localStorage**: all JSON below. ~5 MB browser limit; the practice log and views are capped at 20,000 entries each (`LOG_MAX`).
- **IndexedDB** (one database per profile, `lib/imageStore.ts`): pictures used in questions, stored once by content hash (name starts with `h…`).
- Nothing leaves the browser except what the user exports or copies.

## Keys (`lib/store.ts` → `KEYS`)
| Key | Holds |
|---|---|
| `gate.settings` | `{ name, examDate }` |
| `gate.done` | `Record<"YYYY-MM-DD:taskIndex", true>`: ticked plan tasks |
| `gate.practice` | `Record<questionId, {correct, at, topic}>`: latest result per practice question |
| `gate.extra` | generated numeric question seeds per topic |
| `gate.attempts` | mock `Attempt[]` (questions, responses, timing, `failed?`) |
| `gate.fixed` | `Record<qid,true>`: mistakes solved again |
| `gate.milestones` | `Milestone[]` or `null` (null = use the plan's own) |
| `gate.quotes` | `{seen:number[], last:number}` |
| `gate.plan` | `PlanData` or `null` |
| `gate.pack` | `PackData` or `null` |
| `gate.plog` | `LogEntry[]`: every practice answer (right/wrong/skip legacy), the statistics source |
| `gate.drafts` | code you were writing, per question id (and `dir:<id>` working folder) |
| `gate.views` | `{q, at}[]`: every time a practice question was on screen |
| `gate.links` | `Record<date, {q: string[], mock?: string, note?: string}>` |
Also global (not per profile): `gate.profiles`, `gate.profile` (active id), `gate.theme`.

**Do not rename the `gate.` prefix**; existing users' data would vanish.

## Profiles (`lib/profiles.ts`)
`scope("gate.plan")` returns `gate.plan` for the first profile (`main`) and `gate.p.<id>.plan` for others. Always go through `usePersisted` or `scope()`. The **admin** profile (`id: "admin"`, created on first open) holds no data; it reads/writes other profiles' keys through `lib/adminData.ts` and `AdminGate` keeps it on `/admin`.

## Key types
- `Question`: `id, topic, subject?, difficulty?, tags?, type (mcq|msq|nat|str|code), marks (1|2), text, options?, answer, match?, caseSensitive?, explanation, code?`. Answer shapes: mcq index; msq index list; nat `{value, tol}`; str string or string list; code uses `code.tests`.
- `LogEntry`: `{q, topic, subject, tags?, type, marks, out: "right"|"wrong"|"skip", at, ms?, pick?}`. `pick` records chosen option(s) for MCQ/MSQ so repeated wrong picks can be found.
- `Day`: `{date, phase, kind, hours, title, topics[], tasks[], targetQs}`.
- `PlanData`: `{name, description?, days, phaseNames, milestones}`; `Milestone`: `{id, name, short, date, note?}`.
- `PackData`: `{name, subjects, topics, questions, mocks (old recipes), mockTests, useBuiltinGenerators}`.
- `Attempt`: a mock sitting; `failed` is set if the test ended for leaving full screen (not scored).

## Backup / restore / reset
- Dashboard **Export progress** (`exportAll`, async) writes every key of the current profile plus the pictures its pack and mock attempts use (`images`) and the theme to `orbit-progress-*.json` (`_backup: {app:"orbit", version:2}`); **Restore** (`importAll`, preceded by `inspectBackup`) loads it. `clearAll` wipes the profile's keys and its image database, then reloads.
- Plan export (`planToJson(plan, links)`) carries the question links. Pack export is `exportPack(pack)` in `lib/imageStore.ts`: it is `packToJson` plus the pictures in a top-level `images` object, so an exported pack re-uploads with its pictures.
- **Reset stats** (Stats tab, `components/stats/ResetStats.tsx`): requires typing `Reset Stats`; clears `plog`, `views`, `practice`, `fixed`, `attempts`; **keeps** plan, pack, ticks, links, milestones. Offers "Export to Excel first".
- `usePlan().install(plan, keepTicks, links?)` replaces the plan: resets milestones to the plan's, **replaces links with the given links (or none)**, clears ticks unless `keepTicks`. `update(next)` (small edits) keeps ticks, milestones and links. `remove()` clears plan, milestones, links, ticks.
- `usePack().install(...)` / `clearHistory()` handle pack replacement and history reset (clears practice, extra, fixed, plog, views).
