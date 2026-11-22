# Plans: how they are stored and tracked

This is the plan for study plans. It covers **what is stored**, **when a day counts as done** and **how streaks work**. The tables are in `types/tables/plans/` (one file per table).

## 1. What is stored

| Table | Kind | One row per | Holds |
|---|---|---|---|
| `plans` | content | plan | name, description, `starts_on` → `ends_on`, `is_active` (one at a time) |
| `plan_days` | content | date that has something planned | `on_date`, optional `title` and `note` |
| `plan_tasks` | content | task on a day | `body` (markdown + LaTeX), `position` |
| `plan_day_questions` | content | question linked to a day | `question_id`, `position` |
| `plan_task_ticks` | state | ticked task | `done_at` |
| `plan_question_ticks` | state | linked question that got done | the `answer_id` that did it, `done_at` |
| `plan_bonus` | content | carried-over item placed on a later day | `day_id`, `from_day_id`, `task_id` or `question_id`, `position` (§5) |
| `plan_day_progress` | state (cache) | plan day | counts, `status`, `done_at` |

- **Content vs state.** Editing or re-importing a plan changes content tables only. Ticks survive edits because they point at a task's ID, never at its position.
- **Rest days take no space.** A date in the plan's range with no `plan_days` row has nothing to do. A 6-month plan with Sundays off is about 156 day rows, not 182.
- **Targets are never a separate number.** A day's task target is `COUNT(plan_tasks)` and its question target is `COUNT(plan_day_questions)`, so they can't disagree with what is linked (v2's bug: 65 of 77 days disagreed).
- **`position` is a REAL.** Inserting between 1 and 2 uses 1.5, so nothing is renumbered.

## 2. When a linked question counts as done

A tick is written automatically, in the same transaction as the answer:

- The question gets a **correct or incorrect** answer (a `question_answers` row). **Skipped doesn't count.**
- Every link to that question on a day **up to and including today** that isn't ticked yet gets ticked. Catching up on an older day works.
- **Future days are not ticked early.** Answering Friday's question on Wednesday doesn't tick Friday.
- A wrong answer still ticks. The plan tracks "did I do it"; whether you got it right belongs to the stats (`docs/STATS.md`).

## 3. Day status

`plan_day_progress` keeps four counts per day and derives `status` from them:

| Condition | `status` |
|---|---|
| nothing planned (0 tasks, 0 questions) | `null`: rest day |
| everything done | `done` |
| some done | `partial` |
| nothing done | `incomplete` |

Tasks and questions count equally: 3 tasks + 5 questions = 8 items, and doing 6 of 8 is `partial`.

- Every write that adds or removes a task, link or tick updates the day's row in the same transaction.
- **Future days are shown as "upcoming".** That comes from comparing `on_date` with today (IST), not from a stored value.
- **Late work still counts.** Finishing Monday on Tuesday makes Monday `done`. `done_at` (and each tick's `done_at`) shows it was late, if a screen wants to show that.
- The whole row can be rebuilt by counting the content and tick tables. The rebuild is needed after an import or if the row is ever suspected to be wrong.

## 4. Streaks

Streaks are **computed when read, never stored.** "Current streak" changes at midnight without any write happening, so a stored number would go stale.

**Current streak:** walk back from today through the active plan's `plan_day_progress`, newest first:

1. **Today** counts +1 if it is `done`. If it isn't done yet, skip it; today never ends a streak before it is over.
2. **Rest days** (no row, or `status` null) are skipped. A planned day off doesn't break a streak.
3. **`done`** adds 1.
4. Anything else (`partial`, `incomplete`) **ends the streak.**

**Best streak:** the same rule run over every past day of the plan, keeping the longest run.

**Cost:** one indexed read of `(plan_id, on_date)` of at most a few hundred small rows, which is under a millisecond. Nothing to keep in sync.

## 5. Carry-over: unfinished work spreads over the next 3 days

When a day ends with work left, its unfinished tasks and questions are shared out over the **next 3 planned days** as **bonus work**. Unlike streaks, this is **stored**: once per closed day it is written as `plan_bonus` rows, so bonus work is a permanent part of the plan. It is exported with the plan, and the user can move it to another day or remove it.

**What carries over.** A day is closed once its date is before today (IST). Its carried items are the ones that were still pending at the end of that day: no tick, or a tick whose `done_at` is after that day ended. Those items stay carried even after they are done later; they just show as done.

**Where they go.**
- Only to **planned days** (`plan_days` rows); rest days are skipped. If the plan has fewer than 3 days left, the split uses the ones there are.
- **Tasks and questions are split separately**, each in `position` order, into 3 back-to-back chunks. Earlier days get the extra item. For example, 5 tasks + 4 questions → day 1: 2 tasks + 2 questions; day 2: 2 tasks + 1 question; day 3: 1 task + 1 question.
- Back-to-back chunks (not dealing one item to each day in turn) keep related tasks together.

**Doing a carried item ticks the original**, because the tick points at the same `plan_tasks.id` or link. So:
- the **original day** goes to `done` (late) once everything carried from it is done;
- the **receiving day's** status counts only its own items, so carried work never makes a day `partial`;
- a linked question answered on a later day ticks the original link automatically (rule in §2).

**Carried items carry once.** A day's carry-over is only its own unfinished items, never items that were carried into it. Bonus work left undone stays on the day it sat on (and, unfinished, on its own day); it doesn't move on by itself.

**When it is written.** `plan.carry` (`writeCarry` in `lib/db/queries/carry.ts`) handles every planned day before today that is on or after `plans.carried_before`, then sets `carried_before` to today. `AppFrame` runs it when the app opens, then checks every minute and on coming back to the tab, and runs it again once the IST date changes. A second run the same day does nothing. NULL means it has never run, so every closed day is carried. An item placed already (by an earlier run, an imported file, or the user) is never placed again, and a removed one isn't brought back.

**The table.** `plan_bonus` has one row per placed item: `day_id` (the day it sits on), `from_day_id` (its own day), and `task_id` or `question_id`. Each item is placed at most once. Triggers keep it on a later day of the same plan. Deleting the original deletes the row (cascade). `plan_day_progress` never reads it, so bonus work never counts toward the receiving day.

**Moving and removing** (Edit plan, each day's **Bonus carried over** box): **Move** puts an item on another planned day that isn't locked (`plan.moveBonus`, Undo `plan.unmoveBonus`). **Remove** takes it off the day, and it stays unfinished on its own day (`plan.removeBonus`, Undo `plan.restoreBonus`). Bonus work never counts toward its day, so it can be moved off any day, a locked one too. That is how yesterday's undone bonus gets rescheduled.

**Where it lives.** The split rules are in `lib/carry.ts` (`carryChunks`, `pendingAtEnd`). The write and read are in `lib/db/queries/carry.ts` (`writeCarry`, `carriedInto`, `placeBonus`, `setDayBonus`, `findOriginal`, `bonusEntries`). `dashboard.day` returns the bonus as `carried`. Tests: `scripts/checks/carry.ts`. On screen:
- **Carried tasks** show in the bonus block (`components/plan/DayParts.tsx` `BonusBlock`) on the dashboard agenda and the planner, and ticking one ticks the original (`plan.tickTask`).
- **Carried questions** add to the main event's count (its gold stretch).
- **"Practise these questions"** opens `/practice/day?date=<date>` (`question.day`): the day's linked questions, then the bonus ones carried into it, every type, code questions too. Bonus questions sit in their own amber "Bonus" group in the palette, and each carries a "carried over from <day>" tag. Answering one ticks it on its own day.
- **Moving / removing** happens in Edit plan (above) or through a JSON patch (§5b); the dashboard and planner bonus block only ticks.

**In files.** Export plan writes each day's bonus work as `"bonus": [{ "from": "YYYY-MM-DD", "task": "text" } | { "from": …, "question": "id" }]` and the plan's `"carried_before"`. `plan.import` puts both back (`setDayBonus`): an entry matches the task with that text, or the linked question, on its `from` day. Entries that match nothing are skipped with a warning. In Edit plan's **Change days with JSON**, a day that lists `"bonus"` gets exactly that list. Items left out are removed, and items listed from another day move here. The `from` day must be over. A day without `"bonus"` keeps its bonus. The patch prompt (`lib/prompts/patchPrompt.ts`) shows each open day's bonus and the unfinished bonus stuck on locked days, so an AI chat can move it.


## 5b. The plan file (import)

Plans arrive as one JSON file, usually written by an AI chat from the prompt on the dashboard's welcome screen. The format is `"format": "orbit-plan"`, version 1, and it maps straight onto the plan tables:

- **Rules and checks:** `lib/planFile.ts` (`parsePlanFile`). Every rule refuses with a plain-English message naming the field (AGENTS.md rule 5). The `plan.import` query checks the file again inside the worker and writes everything in one transaction, so nothing unchecked is ever saved.
- **The AI prompt:** `lib/prompts/planPrompt.ts`. It asks the user about goal, dates, free time and topics first, then writes the file. Its example must pass the importer (`bun run check`), so **change both together** (rule 9).
- **Shape:** `name`, optional `description`, `starts_on` / `ends_on` (default: first / last day), `milestones` (`name`, `short`, `date`, `note`), `days`, and optional `carried_before`. A day is one `date` or a range `from` / `to` with optional `weekdays` (`"mon"`…`"sun"`), plus `title`, `kind`, `hours`, `tasks`, `note`, `questions` (question ids) and, on a single `date` only, `bonus` (§5). Export plan writes `bonus` and `carried_before`; the plan prompt tells an AI to leave them out.
- **Overlaps:** a single `date` beats any range; a later range beats an earlier one. Dates with no entry are rest days.
- **Forgiving where it's safe:** a missing `format` is only a warning; ``` fences around the JSON are removed; LaTeX backslashes that JSON broke (`rac` read as a form feed) are put back, with a warning.
- **Question links** whose ids aren't in the question bank yet are left out, with a warning (load the pack first to keep them).
- **v1 files** use a different shape (numbered weekdays, `phases`, `links`, a `questions` target count). They need their own converter (rule 3); not built yet.

## 5c. Linking questions to days (Manage plan)

- **Link questions** hands an AI chat the plan's open days (date, kind, hours, title, tasks), the topics with the user's ratings and every practice question (id, topic, type, marks, difficulty, tags, start of the text): `lib/planLinks.ts` `linkPrompt`. Past `PROMPT_LIMIT` characters it offers two files instead (`linkFiles`).
- **The reply** is `{ "days": [ { "date": "YYYY-MM-DD", "questions": ["question id", …] } ] }` (v1's `"practice"` is read too). `parseLinks` drops unknown ids, mock-only questions, dates outside the plan and locked days, each with a warning; nothing usable refuses. The prompt, the files and the checker change together (AGENTS.md rule 9).
- **Applying** replaces the links of every open day (an open day the reply leaves out loses its links). A link that stays is updated in place, so its tick survives.
- **Locked days** (`lib/dashboard.ts` `dayLock`: past days, and today after 9 AM IST) are never changed by Link, Unlink or Edit plan.
- v1 also linked a **mock test** and a short **note** per day; there is no column for either yet (§6), so the reply doesn't carry them.

## 5d. Milestones and Unlink this day (dashboard, planner)

- **Milestones** (`milestones`, the dates the plan counts down to) are added, edited and removed on the dashboard (`milestone.*`, `lib/db/queries/milestones.ts`; checks in `lib/milestones.ts`, using the plan file's limits so they export and import back). Editing keeps the short calendar label while the name stays the same and drops it when the name changes.
- **Undo.** Every milestone write returns what it replaced; the toast's Undo hands it back (`milestone.undo`, `milestone.restoreAll`), same ids. Rows put back are checked again first.
- **Reset milestones.** `plan.import` keeps the file's own milestones in `plans.original_milestones` (JSON); `milestone.reset` replaces the plan's milestones with them (with Undo). A plan loaded before this column existed has none kept, and Reset says so.
- **Unlink this day** (planner, open days only): `plan.unlinkDay` removes one day's links and returns them with their ticks; Undo (`plan.relinkDay`) puts both back, skipping questions or answers deleted since. Locked days are refused by both.
- **Your name** for the greeting is the `name` setting (`settings` table, `lib/settings.ts`).

## 6. Not in this design yet (add with a migration when needed)

- **Phases** (the v1 coloured stretches). Milestones exist now (§5d).
- **Day kinds** (study / light / mock…) and a mock test linked to a day.
- **Topics per day.** These can be derived from the linked questions' `topic_id`.
