# Handoff (`rehaul` branch, updated 21 Nov 2026)

Where the rebuild stands and what to know before picking it up. Read `AGENTS.md` first; details live in the docs it points to.

## How we work (owner's rules for this rebuild)
- **Small, reviewable steps.** One feature per step; the owner reviews the diff and commits. Never commit yourself.
- **Ask before adding or editing components.** New shared components (`components/ui`) or edits to existing ones need the owner's OK. Fewer than ~10 components touched per step.
- **v1 is the starting point.** Recreate v1's look with the shared components; the owner then asks for changes on top (the planner's carousel, for example). Reference: run v1 (`git worktree add <dir> main`, `bun install`, `bun --bun next dev -p 3200`), load `exports/gate-da-2027-plan.json` through its upload page, and screenshot `/`.
- **The owner checks visuals.** For a UI step, run `bunx tsc --noEmit`, `bun run check` and `bun run format:check`, then ask the owner to look (give the URL). Don't drive headless Chrome yourself unless asked.
- **Unfinished work is in `TODO.md`.** Add to it when something is parked or offered; tick items off when done.

## Done (newest last)
| Area | What exists | Read |
|---|---|---|
| Schema | Every table as a TS type (`types/tables/`: catalog, questions, mocks, plans incl. `milestones`, `plan_days.kind/hours`) and `db/schema.sql` matching it column for column (`bun run check` compares) | `STORAGE.md` |
| Database | SQLite WASM worker + OPFS, named queries (`lib/db/queries.ts`), `useQuery` / `useMutation`, multi-tab (one tab leads), migrations, change tracking from triggers | `STORAGE.md` |
| Plan rules | Day status, streaks, carry-over, the `orbit-plan` file format + importer (`lib/planFile.ts`, `plan.import`) and its AI prompt (`lib/prompts/planPrompt.ts`) | `PLANS.md` |
| Stats rules | Answers log, timing, topic strength (rules only; no stats page yet) | `STATS.md` |
| UI kit | Atomic components with demos at `/dev/components`; Tailwind v4, all CSS in `styles/` (animations one file per component); helpers in `components/utils/`, icons in `components/icons.tsx`, canvas scenes in `components/background/` | `COMPONENTS.md` |
| App frame | `AppFrame`: v1's `NavRail` + compact theme pill; no rail until a plan exists | `COMPONENTS.md` §6 |
| Dashboard (v1) | Greeting + `QuoteBanner` (shuffled quotes), "Set up your study space" card, hero `Runway` (countdown, day track, milestone flags, today ring, streak flame) | `lib/runway.ts` |
| Backdrop | One fixed background layer behind every app page (doesn't scroll); pages pick a scene with `useScene`. Only `welcome` (the solar system, no plan yet) exists; with a plan it is empty until we decide what goes there | `Backdrop.tsx` |
| No-plan welcome | `welcome` backdrop scene, 3 steps (copy AI prompt / peek dialog, save file, drop file), live validation, preview, **Launch** → `LaunchWarp` sequence (adjustable `duration`, `Infinity` for dev) | `PlanOnboarding.tsx` |
| Dashboard, rest of v1 (UI only) | Calendar + agenda (tasks, main event, bonus block, practice target, coming up, day lock), last 7 days, mock scores, weakest topics, milestones (with form), where you stand, settings & backup; read queries `dashboard.*`; rules in `lib/dashboard.ts`. **Actions not wired**: every `useSoon()` call (`components/dashboard/kit.ts`) shows a "coming in the next step" toast | `components/dashboard/` |
| Planner (v1, plus the owner's changes) | `/planner`: header (plan actions not wired, `useSoon`); tabs in the address (`?tab=` next · full_plan · missed, `components/utils/useTab.ts`, Back works), each tab's content pops in, staggered. **Next 3 days** is a carousel: today in the middle inside a flowing gradient ring (`glow` low), a smaller, dimmer day either side; the `‹ Today ›` stepper sits at the right end of the tabs row (fixed, whatever the cards' height) and slides the cards (`carouselDays`). **Full plan**: by month, then week (v1 grouped by phase, which plans don't have). **Missed**: past days left unfinished. Ticking tasks and **Tick all** (`plan.tickDay`) work. New components `DateTile`, `DayRow`, `DayStrip`; day pieces shared with the agenda are in `components/plan/DayParts.tsx`; page padding is `components/app/Page.tsx` | `lib/planner.ts`, `components/planner/` |
| Special glow | `glow` prop (low · medium (default) · high) on `Card` and `Dialog`; utilities `special-glow-*`, classes in `GLOW` (`Special.tsx`); follows warm | `COMPONENTS.md` §3 |

## Next
1. **Planner actions** and the **dashboard functionality**: both lists are in `TODO.md`.
2. **Question pack format + importer** (like the plan one) and the v1 → rebuild converters for old plan / pack files (rule 3; v1 shapes differ, see `PLANS.md` §5b).
3. Pages: Practice, Mocks, Stats (rail links 404 until then); wrap each in `components/app/Page.tsx`. Pages with tabs keep them in the address with `useTab`.
4. Robustness, offered but not built: show database errors instead of a blank page; a hung leader tab steps aside; a schema fingerprint check with a Reset button on `/dev/db`.
5. Open decision: merge subjects `dsa`, `prog` and `code`, or keep them separate?

## Gotchas
- **Schema changes are made in place** (`db/schema.sql`, still version 1) until the first release. An existing browser database then lacks the new columns ("table … has no column …"). Fix: DevTools → Application → **Clear site data** on `localhost:3000`. `/dev/db` "Delete all data" is not enough (it empties tables, it doesn't add columns). 🔴 Clearing wipes all local Orbit data.
- **After clearing data, close every Orbit tab first**, or a tab that was leading keeps a dead database and the others hang (blank page).
- **Firefox private windows have no OPFS**, so the database can't open there.
- **Second dev server / build:** never share `.next` with the owner's running server. Use `NEXT_DIST_DIR=.next-check bun --bun next dev -p 3100`, started from PowerShell with `Set-Location -LiteralPath 'C:\Users\...\Orbit'` (Git Bash gives a lowercase `c:\` path and every page 404s). Next adds `.next-check/types` to `tsconfig.json`: restore it and delete `.next-check` afterwards.
- **Browser checks:** headless Chrome (`--headless=new --remote-debugging-port`) driven by a small bun script over CDP; wait ~1.5 s after load before clicking (React isn't hydrated yet). Headless Firefox works over WebDriver BiDi.
- **`bun run check` is flaky** about 1 run in 5 ("search index: table subjects already exists", a leftover temp file on Windows). Run it again; the fix is in `TODO.md`.
- **Writing tests or LaTeX through shell heredocs** loses backslashes (`\b`, `\f` become control characters). Use the Write tool, or check files for control characters.
- **Tailwind:** class names must appear literally in source (no string building); our animation names must not clash with Tailwind's built-ins (`ping`, `spin`, `pulse`, `bounce`).
- **Sample data:** `temp/` (git-ignored). `bun temp/generate.ts` writes sample plans and packs dated around today; `temp/plans/orbit-8-weeks.json` is a valid `orbit-plan` file, `orbit-broken.json` must be refused. `/dev/db` → **Load a sample plan** fills a plan directly.
- **Older notes:** the v2 audit, the original storage decision and the pre-rehaul uncommitted patch (`../Orbit-rehaul-uncommitted-edits-2026-11-16.patch`) are in git history of this file.
