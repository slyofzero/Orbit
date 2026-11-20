# Orbit: instructions for AI agents

Read this first. Then read `docs/HANDOFF.md` (what is done and what is next) and `docs/STORAGE.md` (the storage design and its rules). Read `docs/STATS.md` before touching anything that records answers or shows statistics. Read `docs/PLANS.md` before touching plans, day progress or streaks. Read `docs/COMPONENTS.md` before building or changing any screen (every shared component, the UI rules, and what the dev-only `/dev` route is for). Table shapes are in `types/tables/` (one file per table; subjects, topics, tags and packs in `catalog/`, question tables in `questions/` (per-type ones in `questions/question_types/`), mock tests in `mocks/`, plan tables in `plans/`). Import them from `@/types/tables`.

## What Orbit is
Orbit is a personal, **exam-agnostic study hub**: a day-by-day planner, topic-wise practice, mock tests that copy a real exam screen, a mistake log, rich statistics and an admin area. It is a Next.js 15 / React 19 / TypeScript app. There is no server database and no login: everything the user owns lives in the **browser**.

It started as a GATE DA 2027 prep tool, but the owner's standing rule is: **"Nothing in Orbit should be only for GATE."** The plan and the question pack are uploaded by the user; nothing is built in. Never write GATE-only wording, logic or prompts.

The `rehaul` branch is a rebuild. The old localStorage app is on `main` and in git history; look there for how a feature used to work.

## Commands
- `bun install`, then `bun run dev`, open http://localhost:3000
- `bunx tsc --noEmit`: type check (must be clean)
- `bun run check`: `scripts/check.ts`, the logic test suite. It must print `ALL OK`.
- `bun run format`: Prettier on every `.tsx` file (`.prettierrc.json`: 120 columns, double quotes, semicolons, trailing commas). `bun run format:check` must pass.
- `bun run build` / `bun run start`: production build
- http://localhost:3000/dev/db: the database worker live (connection, table counts, sample writes). Open it in two tabs to see them share one database.
- http://localhost:3000/dev/components: every shared UI component (`components/ui`) and question component (`components/question`), live, in both themes. **Dev mode only**: `app/dev/layout.tsx` returns 404 in production. When you add or change a shared component, add or update its demo there.

## Hosting: zero budget, Vercel free tier only
The owner has **no hosting budget**. Orbit is deployed on **Vercel's free (Hobby) plan** and nothing else.
- No paid services, no hosted database, no paid APIs, no third-party backends. All user data stays in the browser.
- Prefer static pages and client-side code. Only add serverless functions or edge middleware if there is no client-side way; they count against free-tier limits.
- Anything that needs custom response headers goes in `next.config.mjs` (or `vercel.json`), so it works on Vercel without extra setup.
- Large assets (e.g. WASM) are served as static files from `public/` or bundled; never fetched from a paid CDN.
- Before adding a dependency or feature, check it works on Vercel's free plan. If it would need a paid plan, stop and ask the owner.

## Rules that always apply
1. **Storage follows `docs/STORAGE.md`.** SQLite WASM in one Web Worker, OPFS `opfs-sahpool`, one file per profile. The UI thread never touches the database: screens call `useQuery` / `useMutation` (`lib/db/client.ts`) with a query NAME from `lib/db/queries.ts`, the only place SQL lives. Any number of tabs work (one leads, the rest go through it). Every list has a `LIMIT`; every write is one transaction.
2. **The schema is `db/schema.sql`; changes are migrations.** Never edit a shipped migration; add `db/migrations/NNN-*.sql` and bump `PRAGMA user_version`.
3. **Never break saved data.** Old v2 exports and localStorage data must still import (through `legacy_id`).
4. **Pure logic goes in `lib/` and gets a test in `scripts/check.ts`.** UI components stay thin. Run `bunx tsc --noEmit` and `bun run check` before you say you are done.
5. **Plans and question packs are user data.** Imports are validated first and refuse or warn; never save unchecked data.
6. **ALL user-visible text renders as markdown + LaTeX, everywhere** (headings, labels, table cells, tooltips, options, buttons, toasts…). Shared components in `components/ui` and `components/question` do this automatically for every string prop through `txt()` (`components/utils/txt.tsx`). In your own JSX, never print a user-facing string raw: use `<Rich text={…} />` (or `<Rich block …/>` for multi-paragraph text) or `txt(…)`. Syntax: `lib/markdown.ts`. Plain text skips parsing and results are cached, so it is cheap.
7. **Dates are plain `YYYY-MM-DD` strings in IST.** Do not use `new Date()` for day logic.
8. **Styling is Tailwind CSS v4 utility classes**, written in the components. Colours come ONLY from Orbit's theme tokens (`bg-sheet text-ink border-line bg-accent text-gray …`); Tailwind's own palette (`gray-500`, `blue-600`…) is switched off because it doesn't follow light / dark. All CSS is in the root `styles/` folder: `styles/site.css` holds the theme (`@theme`), custom utilities (`special-fill`, `special-text`, `special-border`, `warm`, `dot-grid`, `frosted`…) and base rules, and imports the rest: animations in `styles/animations/` (one file per component), `styles/code-editor.css`, `styles/theme-ripple.css`. Keep `site.css` small: don't add component CSS there; use utilities, add an `@utility` if a pattern repeats, and put a new animation in `styles/animations/<component>.css`. Support light and dark. See `docs/COMPONENTS.md` §3.
   **Build screens only from the shared components** in `components/ui` (index: `components/ui/index.ts`, all shown at `/dev/components`). No raw `<button>`, `<input>`, `<select>`, `<a>`, `<h1>`–`<h3>`, `<p>`, `<details>`, `<table>` or `<hr>` in pages: use `Button`/`IconButton`, `TextField`/`Dropdown`/`DatePicker`/`FileInput`, `Link`, `Heading`, `Text`, `Disclosure`, `Table`, `Divider`. There is deliberately no native `<select>`: its list can't be styled or show maths. If something is missing, add it to `components/ui` with a demo first.
9. **Prompts the app hands to AI chats are product features.** If you change a data format, update every prompt that describes it and its test.
10. **Imports always use the `@/` alias** (`@/components/ui`, `@/lib/grade`, `@/types/tables`), never relative paths like `./` or `../`, even inside the same folder. `@/` is the project root (`tsconfig.json` `paths`).
11. Do not delete, rename or reformat code you were not asked to touch.

## About the owner and how to work with them
The owner prefers: short, plain final replies; paste-ready code; the **problem explained first, then the code**; a big 🔴 CAUTION line for anything the user must NOT do (for example when a destructive action is possible). They copy and paste rather than read, so keep UI wording self-explanatory.
