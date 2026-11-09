# 2. Architecture and files

## Stack
Next.js 15 (App Router) · React 19 · TypeScript (strict) · KaTeX (maths) · highlight.js (code colouring) · Bun for running/testing · fonts Bricolage Grotesque (display) and Atkinson Hyperlegible Next (body). No UI library, no state library, no CSS framework. Pyodide (Python) and a Web Worker (JavaScript) run code questions in the browser; Java/C/C++ run through the local API route.

## Folder map
- `app/`
  - `layout.tsx`: root layout, theme bootstrap script, KaTeX CSS import.
  - `site.css`: **the one big stylesheet** for the whole site (themes, components, pages). `arena.css`: the mock-exam screen only.
  - `(site)/`: pages inside the sidebar shell (`layout.tsx` = Nav + Ambient + Cosmos + AdminGate):
    `page.tsx` Dashboard (Today) · `planner/` · `practice/` (`[topic]`, `programming`, `programming/[id]`) · `mocks/` · `stats/` · `mistakes/` · `day/[date]/` · `results/[id]/` · `admin/`
  - `exam/[id]/`: the full-screen mock exam (outside the shell).
  - `api/run/route.ts`: runs a learner's program (localhost only; see `09`).
- `components/`: UI. Notable: `Rich` (text with maths/code/pictures), `QuestionCard`, `CodeQuestion`, `Exam`, `Calendar`, `Runway`, `Milestones`, `PlanImport`, `PlanEdit`, `PlanDescription`, `LinkPlan`, `ImprovePlan`, `LinkFiles`, `CopyDayPrompt`, `PackImport`, `ExportFirstModal`, `TagFilter`, `Companion` (+ `mascots`, `outcomes`, `adminLines`), `QuoteCard`, `ProfileSwitcher`, `stats/*`, `admin/*`.
- `lib/`: **all logic**, mostly pure functions. See table below.
- `scripts/`: `check.ts` (the test suite), `export-gate.ts` (GATE sample files into `exports/`), `export-*-packs.ts` (test packs), `embed-images.ts` (turn picture files into a pack), `check-runner.ts` (which languages can run on this machine).
- `exports/`: generated sample JSON (GATE plan/pack, test packs). Not loaded by the app.
- `agents/`, `AGENTS.md`, `CLAUDE.md`: this documentation.

## lib/ map
| File | Purpose |
|---|---|
| `types.ts` | `Question`, `QType`, `Attempt`, `Resp`, `Settings`, `LogEntry`, `Topic`, `Day`, `DayKind`, `CodeSpec` |
| `store.ts` | `KEYS`, `usePersisted`, `usePlan`, `usePack`, `useMilestones`, `logPractice`, `logView`, `exportAll/importAll/inspectBackup/clearAll` |
| `profiles.ts` | profiles list, `scope(key)`, admin profile helpers |
| `plan.ts` | date helpers (IST strings), `PlanData`, `Milestone`, `PLAN_DESCRIPTION_MAX`, labels |
| `customPlan.ts` | `parsePlan` (validate + normalise uploaded plan), `planToJson` (export, includes links), `templateJson`, `aiPrompt` |
| `packs.ts` | `PackData`, `parsePack` (validate), `packToJson`, `packTemplateJson`, `packPrompt`, `allQuestions`, `locate` |
| `packMerge.ts` | merge several pack files into one before checking |
| `packEdit.ts` | edit one question/mock/topic at a time (`upsertQuestion`, `freeId`, `checkQuestion`) |
| `links.ts` | plan↔question links: prompts, `parseLinks`, `checkImportedLinks`, two-file export (`planFile`, `bankFile`, `filesPrompt`), size limit |
| `dayPrompt.ts` | prompt for "how do I do this day" |
| `editPrompt.ts` | prompt for cleaning up one question (OCR fixes) |
| `setupPrompt.ts` | prompt that builds files/DB a programming question needs |
| `stats.ts`, `statsMore.ts`, `statsSheets.ts`, `xlsx.ts` | statistics and the Excel export |
| `scoring.ts`, `strMatch.ts`, `mock.ts` | marking, text-answer matching, mock building |
| `tex.ts`, `images.ts`, `imageStore.ts`, `imageClip.ts`, `highlight.ts` | LaTeX, pictures (IndexedDB), clipboard, code colouring |
| `runner.ts`, `judge.ts`, `browserRunner.ts`, `codeLanguages.ts` | running programs |
| `questionFilter.ts`, `bank.ts`, `topics.ts`, `typeBreakdown.ts`, `treemap.ts` | filters and helpers |
| `gateBank.ts`, `gatePlan.ts`, `generators.ts`, `questions/*` | GATE sample content and numeric generators (not loaded unless a pack sets `useBuiltinGenerators`) |
| `quotes.ts`, `fx.ts`, `outcome.ts`, `rng.ts`, `download.ts`, `adminData.ts` | small helpers |

## Patterns
- **Persisted state**: `const [x, setX, ready] = usePersisted<T>(KEYS.x, initial)`. Syncs across components/tabs through a `gate-store` window event. Wait for `ready` before showing empty states.
- **Pure first**: anything computed (stats, parsing, prompts, link checks) is a pure function in `lib/`, imported by the component and by `scripts/check.ts`.
- Pages are client components (`"use client"`); data is read from storage in the browser.
- Components defined inside page components (for example `DayCard` in the planner) re-mount on every render; keep them stateless.
