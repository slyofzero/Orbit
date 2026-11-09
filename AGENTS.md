# Orbit: instructions for AI agents

Read this first. It is the short version. The full context is in the `agents/` folder (index: `agents/README.md`). Read the topic file that matches your task before changing code.

## What Orbit is
Orbit is a personal, **exam-agnostic study hub**: a day-by-day planner, topic-wise practice, mock tests that copy a real exam screen, a mistake log, rich statistics and an admin area. It is a Next.js 15 / React 19 / TypeScript app. Everything the user owns (plan, question pack, progress) lives in the **browser** (localStorage + IndexedDB). There is no database and no login.

It started as a GATE DA 2027 prep tool, but the owner's standing rule is: **"Nothing in Orbit should be only for GATE."** The plan and the question pack are uploaded by the user as JSON; nothing is built in. Never write GATE-only wording, logic or prompts in new code.

## Commands
- `bun install`, then `bun --bun next dev` (alias `bun run dev`), open http://localhost:3000
- `npx tsc --noEmit`: type check (must be clean)
- `bun run check`: `scripts/check.ts`, the whole logic test suite. It must print `ALL OK`.
- `bun run build` / `bun run start`: production build
- `bun run export`: writes the built-in GATE DA plan and pack JSON into `exports/`

## Rules that always apply
1. **Pure logic goes in `lib/` and gets a test in `scripts/check.ts`.** UI components stay thin. Run `npx tsc --noEmit` and `bun run check` before you say you are done.
2. **Never break saved data.** Storage keys (`lib/store.ts` `KEYS`, prefix `gate.`) keep their names even though the app is no longer GATE-only. Do not rename them. Old saved data must still load.
3. **Everything is per profile.** Read and write through `usePersisted` / `scope()`; never touch `localStorage` with a raw `gate.*` key (see `agents/03-data-model-and-storage.md`).
4. **Plans and question packs are user data.** Imports are validated first (`parsePlan`, `parsePack`, `parseLinks`) and refuse or warn; never save unchecked data.
5. **LaTeX renders through `components/Rich.tsx` + `lib/tex.ts`.** Any user-visible text that can hold maths (question text, options, explanations, plan titles, tasks, notes, milestone notes) must be rendered with `<Rich text=… />`.
6. **Dates are plain `YYYY-MM-DD` strings in IST** (`todayIST()` in `lib/plan.ts`). Do not use `new Date()` for day logic.
7. **Styling is one file, `app/site.css`, with unique class prefixes and theme variables** (`--sheet --ink --accent …`). Support light and dark. See `agents/10-ui-and-styling.md`.
8. **Do not overwrite the owner's machine-specific `package.json`** (their copy differs from the repo's).
9. **Prompts the app hands to AI chats are product features.** If you change a data format, update every prompt that describes it (list in `agents/07-ai-prompts.md`) and its test.
10. Do not delete, rename or reformat code you were not asked to touch.

## About the owner and how to work with them
The owner prefers: short, plain final replies; paste-ready code; the **problem explained first, then the code**; a big 🔴 CAUTION line for anything the user must NOT do (for example when a destructive action is possible). They copy and paste rather than read, so keep UI wording self-explanatory. More in `agents/12-owner-and-history.md`.

## Map of the agents/ folder
| File | Read it when |
|---|---|
| `agents/README.md` | You need the index |
| `agents/01-overview-and-principles.md` | You are new to the project |
| `agents/02-architecture-and-files.md` | You need to find where something lives |
| `agents/03-data-model-and-storage.md` | You touch saved data, profiles, backups, images |
| `agents/04-features-by-page.md` | You change a page or want to know what a screen does |
| `agents/05-question-packs.md` | You touch questions, topics, tags, mock tests, the pack format |
| `agents/06-plan-and-links.md` | You touch the plan, milestones, descriptions or question links |
| `agents/07-ai-prompts.md` | You change anything that produces a prompt for an AI |
| `agents/08-statistics.md` | You touch stats, the view log or the Excel export |
| `agents/09-practice-exam-and-code.md` | You touch answering, marking, the exam arena or code questions |
| `agents/10-ui-and-styling.md` | You touch CSS, modals, buttons, themes, LaTeX rendering |
| `agents/11-testing-and-workflow.md` | You want to test, verify in a browser, or ship |
| `agents/12-owner-and-history.md` | You want the owner's preferences and the decisions made so far |
| `agents/13-cosmic-events.md` | You add, edit or retime the sky events (supernova, comet…) |
| `agents/14-study-buddies.md` | You add or edit a mascot, its lines, or its backdrop scene |
