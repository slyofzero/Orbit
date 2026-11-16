# Orbit: instructions for AI agents

Read this first. Then read `docs/HANDOFF.md` (what is done and what is next) and `docs/STORAGE.md` (the storage design and its rules).

## What Orbit is
Orbit is a personal, **exam-agnostic study hub**: a day-by-day planner, topic-wise practice, mock tests that copy a real exam screen, a mistake log, rich statistics and an admin area. It is a Next.js 15 / React 19 / TypeScript app. There is no server database and no login: everything the user owns lives in the **browser**.

It started as a GATE DA 2027 prep tool, but the owner's standing rule is: **"Nothing in Orbit should be only for GATE."** The plan and the question pack are uploaded by the user; nothing is built in. Never write GATE-only wording, logic or prompts.

The `rehaul` branch is a rebuild. The old localStorage app is on `main` and in git history; look there for how a feature used to work.

## Commands
- `bun install`, then `bun run dev`, open http://localhost:3000
- `bunx tsc --noEmit`: type check (must be clean)
- `bun run check`: `scripts/check.ts`, the logic test suite. It must print `ALL OK`.
- `bun run build` / `bun run start`: production build

## Rules that always apply
1. **Storage follows `docs/STORAGE.md`.** SQLite WASM in one Web Worker, OPFS `opfs-sahpool`, one file per profile. The UI thread never touches the database; it uses named queries through `lib/db/client.ts`. Every list has a `LIMIT`; every write is one transaction.
2. **The schema is `db/schema.sql`; changes are migrations.** Never edit a shipped migration; add `db/migrations/NNN-*.sql` and bump `PRAGMA user_version`.
3. **Never break saved data.** Old v2 exports and localStorage data must still import (through `legacy_id`).
4. **Pure logic goes in `lib/` and gets a test in `scripts/check.ts`.** UI components stay thin. Run `bunx tsc --noEmit` and `bun run check` before you say you are done.
5. **Plans and question packs are user data.** Imports are validated first and refuse or warn; never save unchecked data.
6. **Any user-visible text that can hold maths is rendered as LaTeX** (question text, options, explanations, plan titles, tasks, notes).
7. **Dates are plain `YYYY-MM-DD` strings in IST.** Do not use `new Date()` for day logic.
8. **Styling is one file, `app/site.css`, with unique class prefixes and theme variables** (`--sheet --ink --accent …`). Support light and dark.
9. **Prompts the app hands to AI chats are product features.** If you change a data format, update every prompt that describes it and its test.
10. Do not delete, rename or reformat code you were not asked to touch.

## About the owner and how to work with them
The owner prefers: short, plain final replies; paste-ready code; the **problem explained first, then the code**; a big 🔴 CAUTION line for anything the user must NOT do (for example when a destructive action is possible). They copy and paste rather than read, so keep UI wording self-explanatory.
