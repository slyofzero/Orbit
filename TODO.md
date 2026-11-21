# TODO

Full checklist of the `rehaul` rebuild. Where it stands and how we work: `docs/HANDOFF.md`. Grep `useSoon` to find every button whose action is not built yet.

## Done

- [x] Schema as TS types plus `db/schema.sql` (`docs/STORAGE.md`)
- [x] SQLite WASM worker + OPFS, named queries, `useQuery` / `useMutation`, multi-tab, migrations (`docs/STORAGE.md`)
- [x] Plan rules: day status, streaks, carry-over rules, `orbit-plan` file format + importer + AI prompt (`docs/PLANS.md`)
- [x] Stats rules: answers log, timing, topic strength (`docs/STATS.md`; no stats page yet)
- [x] UI kit: atomic components, `/dev/components`, Tailwind v4 theme, light / dark (`docs/COMPONENTS.md`)
- [x] App frame: `NavRail`, compact theme pill, no rail before a plan
- [x] Dashboard UI (v1): greeting, quote banner, set-up card, Runway hero, calendar + agenda, last 7 days, mock scores, weakest topics, milestones, where you stand, settings & backup
- [x] Backdrop scenes, no-plan welcome and `LaunchWarp` launch sequence
- [x] Planner UI: tabs in the address, Next 3 days carousel, Full plan, Missed; ticking tasks and Tick all / Untick all (`plan.tickDay`); copy-day prompt
- [x] `orbit-questions` file + importer (`pack.import`) and its AI prompt per Practice tab
- [x] Practice shell + onboarding (`/practice?tab=`, `PracticeOnboarding`, canvas scenes per tab)
- [x] Routing guard: app pages redirect to `/onboarding` until a plan exists
- [x] Start fresh (`app.startFresh`: deletes every table, clears localStorage / cookies / caches, goes to `/onboarding`). Done 21 Nov 2026
- [x] Backup export (`backup.export`, Export progress button) and restore from `/onboarding` (`backup.import`, `RestoreBackup`; JSON, `lib/backup.ts`)
- [x] `glow` setting (low · medium · high) on `Card` and `Dialog`
- [x] Practice tabs: Topics, Programming and Mocks content (lists, filters, history). Done 21 Nov 2026
- [x] Import transition (`ImportCelebration`) after any question / mock import. Done 21 Nov 2026
- [x] Dev shortcuts: "add one sample question / programming question / mock" per empty Practice tab (`dev.addSampleQuestion`, `dev.addSampleCode`, `dev.addSampleMock`)

## Pending (by priority)

### Next up
- [ ] Topic practice screen: render questions with `components/question`, record `question_answers` per `docs/STATS.md` (Topics rows and "next on your plan" buttons are `useSoon`)
- [ ] Code editor screen for a programming question (rows are `useSoon`)
- [ ] Mock exam screen, attempt submit and attempt review (every Start is `useSoon`)
- [ ] Old links to `/practice/mocks` and `/practice/<topic>` (Agenda, Thirds, DayBody) 404: they are now `/practice?tab=…`
- [ ] `/day/<date>` page: the main event's "Practise these questions" link 404s until then
- [ ] Stats page (rail links 404 until then; rules are in `docs/STATS.md`)

### Planner actions (grep `useSoon` in `app/(app)/planner/page.tsx`, `components/planner/DayBody.tsx`)
- [ ] Improve plan (v1: AI prompt, then paste back the question links)
- [ ] Unlink questions (whole plan) and Unlink this day (only while the day isn't locked)
- [ ] Edit plan (v1 `/planner/edit`)
- [ ] Export plan (`orbit-plan` file)
- [ ] Upload plan (replaces the active plan; 🔴 confirm first)
- [ ] Carry-over (`docs/PLANS.md` §5) also feeds the planner's `BonusBlock`

### Dashboard functionality (grep `useSoon`, `components/dashboard/kit.ts`)
- [ ] Milestones: add / edit / remove, with Undo (toast action)
- [ ] Reset milestones to the plan's own (store the plan file's originals so they can be restored)
- [ ] Settings table (your name, used by the greeting)
- [ ] Dashboard **Import progress** button (same `backup.import`; 🔴 replaces everything, so confirm first) and, if wanted, the `.sqlite3` file version `docs/STORAGE.md` §6 describes
- [ ] Full v1 day prompt: question texts, milestones, topic feelings
- [ ] Carry-over (`docs/PLANS.md` §5): feeds `BonusBlock` and the main event's gold stretch; bonus tick / unlink
- [ ] Use `components/app/Page.tsx` for the dashboard's padding (it still has its own copy)

### Practice
- [ ] Rate a topic (know / shaky / no idea, `topic_ratings`); every topic shows as "No idea" until then
- [ ] "Manage pack" / "Manage mocks" buttons (`useSoon`): list packs, remove or re-import one
- [ ] Pictures inside a question file (`img:` references show as missing; the importer warns)
- [ ] v1 pack and plan converters (`temp/packs/*.json` are the old shape and are refused; `docs/PLANS.md` §5b)
- [ ] Code questions have no language column, so the language is only written in the question text
- [ ] Open decision: merge subjects `dsa`, `prog` and `code`, or keep them separate?

### Robustness (offered, not built)
- [ ] Show database errors instead of a blank page; a hung leader tab steps aside; a schema fingerprint check with a Reset button on `/dev/db`

### Small things
- [ ] Full plan: rows inside an open month start 38px in (v1: 14px). `Disclosure` now has `bodyClassName`; switching the planner to it needs the owner's OK
- [ ] Keyboard ← / → to step the planner carousel
- [ ] Give the other special pieces the `glow` setting if wanted: question frame, file drop zone while dragging, special button hover, quote banner, main event box
- [ ] `bun run check` fails about 1 run in 5: "search index: table subjects already exists" (temp file named after the process id lingers on Windows). Fix: delete the file before opening it (`scripts/checks/schema.ts`, "schema: search index")
