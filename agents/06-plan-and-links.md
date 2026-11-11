# 6. Plan and links

## Plan JSON (`lib/customPlan.ts`)
Uploaded on Planner → Upload plan. `parsePlan(json)` returns `{plan, errors, warnings, links?}`; errors refuse the file, warnings do not.
Top-level: `name` (≤60), `description` (≤1500 chars, optional), `phases` `[{id, name, from?}]`, `milestones` `[{name, date, note?}]`, `days`, optional `links`.
Days (max 800): each entry is either a single `date` or a range `from`+`to` (optional `weekdays: [0-6]` to filter), with `title`, `kind` (study|crunch|light|mock|buffer|exam|taper), `hours`, optional `phase`, `topics` (topic ids), `tasks` (defaults generated per kind), `questions` (the day's practice target, stored as `targetQs`). Later entries override earlier ones for the same date. Exam days become milestones if none are given.
Text fields (titles, tasks, notes, description) may hold LaTeX between `$`; in JSON the backslashes must be doubled (`repairBackslashes` fixes tab/form-feed accidents with a warning).

`planToJson(plan, links)` is the reverse (export). `templateJson(start)` and `aiPrompt(start)` are what the "Download template / Copy AI prompt" buttons give.

## Plan description
`plan.description` is the owner's own words about what the plan is for. It is editable on the upload screen (`PlanDescription.tsx`, 0/1500 counter, Save button) and via JSON. **It is copied into every AI prompt that carries plan information**: link prompts, the two-file export (`plan.json` has `description`), and the per-day prompt. The plan-writing AI prompt asks the AI to write one.

## Milestones
`useMilestones()` returns the user's edited milestones or the plan's own. Edited in `Milestones.tsx`; notes render LaTeX.

## Question links
`Links = Record<"YYYY-MM-DD", {q: string[], mock?: string, note?: string}>`, stored in `gate.links`.
- **Creating links**: the user clicks "Link questions" (or "Improve plan" if links already exist). `ImprovePlan.tsx` / `LinkPlan.tsx` offer a single prompt (`linkPrompt`) to paste into any AI along with the answer box, or, when the prompt exceeds `PROMPT_LIMIT` (100,000 chars, `isTooLong`), a **two-file route** (`LinkFiles.tsx`): export `plan.json` + `question-bank.json` (`planFile`, `bankFile`, with `questionCount`) and paste a short prompt (`filesPrompt`). Both routes carry warnings: AIs may not read very large files fully, so the user should ask the AI how many questions it saw and compare with `questionCount`.
- **Parsing the AI's reply**: `readAnswer` (strips fences, repairs a cut-off reply) then `parseLinks(input, plan, pack)`: drops unknown dates, unknown ids, ids that belong to mock tests, unknown/duplicate mocks, with a plain-language warning each. It refuses if nothing valid remains.
- **Display**: `liveQuestionIds(link, pack)` filters ids that still exist. The Today and Planner cards show a **Main event** box; the day page shows the questions inline.
- **Unlink** removes links (all, or per day).

## Import / export of plan + links
- **Export** (`planToJson(plan, links)`): includes a `links` list `[{date, practice, mock?, note?}]` (same shape as an AI reply). Used by "Export this plan" and by the "export old plan first" step.
- **Import** (`PlanImport.tsx`): `parsePlan` returns raw `links`; `checkImportedLinks(raw, plan, pack)` verifies each against the **imported plan's dates** and the **current question bank** and returns `{total, working, broken, good}`. The screen then shows:
  - all links valid → they are imported with the plan (message says so);
  - some broken → a choice: **import the plan and the working links (default)** or **import only the plan, no links**;
  - none valid → no choice; says only the plan will be imported, not the links (also covers "no question bank loaded").
  Then `usePlan().install(plan, keepTicks, links?)`. Replacing a plan always replaces links (they come only from the file).
- Small edits in **Edit plan** (`PlanEdit.tsx`) use `update()` and keep links; the editor also has a per-day "Linked questions" area.

## Day prompt
`dayHelpPrompt(day, pack, link, planName, milestones, description)` in `lib/dayPrompt.ts`; button `CopyDayPrompt.tsx` (Today agenda and every planner card). Includes plan name and description, the day, the linked questions' text, milestones, subject pace (`examPace`). Generic (no exam name).

## Today is locked after 9 AM (IST)
`lib/lock.ts`: `isDayLocked(date)` is true for today's date from 09:00 IST. A locked day cannot be edited in **Edit plan** (the whole editor is a disabled fieldset, with a banner and a "Copy today's links" button), cannot be changed by **Update only the dates in this file** (it is skipped with a notice), and keeps its links when links are bulk-cleared or re-applied (`keepLockedLinks`). Ticking tasks and solving questions still work. Past days and future days stay editable, so missed work can be rescheduled. Not locked on purpose: **Replace my whole plan** on the Upload plan page.

## Bonus (carried-over work)
`lib/bonus.ts` `bonusFor(date, …)`: for every day that has started (today or earlier), its still-pending tasks and linked questions are spread over its next 3 plan days (exam days skipped) and shown there as **Bonus** (`BonusBlock.tsx` on Today and the Planner cards, plus a section at the bottom of `/day/<date>`). The split uses each item's fixed position (task number mod days, link order in thirds), not the pending count, so an item never changes day. Nothing is stored: ticking the original task or answering the question clears it everywhere. Bonus never counts towards `dayFinished`, so a day's green/red status is unchanged. Yesterday's leftovers keep showing on the days still inside their 3-day window.
