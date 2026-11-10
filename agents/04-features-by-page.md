# 4. Features by page

Sidebar (`components/Nav.tsx`): Today, Planner, Practice, Mocks, Stats, plus profile switcher, study buddy and theme toggle. The admin profile sees only Admin.

## Today (`app/(site)/page.tsx`)
- Greeting + a quote card in one row. A compact **runway** timeline (`Runway.tsx`) toward the next milestone, a calendar (`Calendar.tsx`) with milestone tags (labels truncate, full name in the tooltip).
- "Today" agenda: the day's title, tasks (tickable), a **Go to planner** button and **Copy AI prompt** (`CopyDayPrompt`).
- If the plan day has links: a **Main event** box shows the linked questions (answered/correct counts, the note), a **Practise these questions** button and **Unlink this day**.
- **Finished days**: when every task is ticked and every linked question answered (`dayFinished` in `lib/links.ts`), the agenda switches to tomorrow ("Tomorrow" + a "Today is done" pill + "Show today"), unless the person picked a day. The Main event box dims as soon as its linked questions are all answered (`linkedDone`, `.pl-main.is-done`). The planner moves its highlight (`.pl-card.now`) to tomorrow's card the same way.
- Countdown to milestones, settings (name, exam date), backup export/restore, wipe-all.
- Titles, tasks and notes render LaTeX through `Rich`.

## Planner (`planner/page.tsx`)
Tabs: **Next 3 days** (cards for today and the two after; **Prev / Today / Next** buttons below shift the window by one day, Today is disabled when already centred), **Full plan** (phases, each day expandable), **Missed** (past, incomplete, non-exam days). Header buttons: **Improve plan** (link questions with an AI, `ImprovePlan`), **Link questions / Unlink**, **Edit plan** (`PlanEdit`), **Upload plan** (`PlanImport`). Each day card: tasks to tick, practice target progress, linked-question box, **Copy AI prompt**, **Tick all**. See `06-plan-and-links.md`.

## Day page (`day/[date]/page.tsx`)
One day in detail: tasks and the linked questions answered inline with `QuestionCard`.

## Practice
- `practice/page.tsx`: pack upload prompt when empty; otherwise subjects → topics with progress; filters (`TagFilter`: subject/topic/tag/difficulty); tabs (`PracticeTabs`).
- `practice/[topic]/page.tsx`: the questions of one topic, instant feedback; topics with generators can give fresh numeric questions (GATE pack only).
  - **Resume**: progress is not a new stored key. The questions already in `gate.practice` when the topic opens are snapshotted into `seen` and hidden, so the list starts at the first unanswered question (numbers keep their place, e.g. Q41). An eye button in the title row (glows for about 3 s on arrival, tooltip says how many are hidden) toggles "view all". The seen / correct / wrong tiles and meter sit in the same row as the Filter button. The snapshot is taken once per visit, so a question you answer now stays on screen. The first frame renders nothing until the snapshot exists.
  - **Loading screen**: `components/PageLoading.tsx`, used instead of a plain "Loading…" line by every page (never write a bare "Loading…" paragraph; return `<PageLoading />`). Keep it mounted and flip `active`. It appears only if the wait lasts over 150 ms and stays at least 600 ms, sets `data-page-loading` on `<html>` (CSS blurs `.page-enter`, so the whole page including the first line is blurred) and shows a centred orbit animation with the word "Loading". The topic page shows 10 questions per page (`PAGE_SIZE`), with Prev / page picker / Next below the list.
  - **Leaving**: if you answered at least one question this visit (right or wrong, compared by `at >= openedAt`) the buddy gets `announce("progress")`; only if you answered none, and some are unanswered, `announce("quit")`.
- `practice/programming`: code questions list and `[id]` page. See `09`.
- Each question card shows type, marks, the **question ID** (copyable chip), negative-marking info, topic link, tags/difficulty.
- No Skip button. Viewing is tracked (`logView`); see `08`.

## Mocks (`mocks/page.tsx`, `exam/[id]`, `results/[id]`)
Fixed mock tests from the pack (`mockTests`), old-style recipes (`mocks`), and generated: **Subject test**, topic test, **Weak-topics test**, **Quick mixed test**. The exam screen copies a real CBT exam (see `09`). Results page reviews every question with marks, correctness, the ID, and explanation.

## Stats (`stats/page.tsx`)
Tabs: **Overview**, **Progress**, **Explore** (treemap), **Questions**, **Mistakes**. Export to Excel (many sheets), **Reset stats**. See `08`.

## Admin (`admin/`)
Pick a profile, then panels: Questions (add/edit/delete, search by id within a profile or across all), Mock tests (`MockDetail`), Topics, Plan (edit as JSON), Upload pack. The **question editor** (`components/admin/QuestionEditor.tsx`) runs the same checks as an upload, assigns ids automatically (`freeId`), previews LaTeX, inserts pictures, and has **Copy prompt** (OCR clean-up prompt) plus **Copy picture / Save** buttons for questions with pictures. Esc closes it.

## Pack and plan import screens
- `PackImport.tsx` (on Practice): get template/AI prompt, upload or paste, merge several files, "Add to my pack" vs replace, export-first modal.
- `PlanImport.tsx` (Planner → Upload plan): see `06`.

## Study buddy and quotes
`Companion.tsx` reacts to outcomes (`lib/outcome.ts` → `components/outcomes.ts`), shows quotes from `lib/quotes.ts`; mascots in `mascots.tsx`; admin has its own lines (`adminLines.ts`). Effects in `lib/fx.ts` respect reduced motion. The sky events (`Cosmos.tsx`, one every 15–25 minutes) and the buddies are documented in `13-cosmic-events.md` and `14-study-buddies.md`.

## Manage pack (`/practice/manage`)

Its own page, reached from the "Manage pack" button on Practice and Programming. `components/PackManager.tsx` renders it for the profile you are in. The section is the `tab` query: `?tab=questions` (default), `mock-tests`, `topics`, `plan`, `upload`; `&q=<question id>` opens that question's editor. The first four tabs reuse the panels in `components/admin/`; `upload` is `components/PackImport.tsx`. Every profile edits its own questions, so the separate Admin profile is no longer offered in the profile menu (the code stays for a profile that already exists). The Edit icon on a question card links to `/practice/manage?tab=questions&q=<id>`.
