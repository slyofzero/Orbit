# 8. Statistics

All pure functions; tested in `scripts/check.ts`; shown in `app/(site)/stats/page.tsx` and `components/stats/*`; exported by `lib/statsSheets.ts`.

## Events (`lib/stats.ts` → `buildEvents`)
Every statistic starts from a list of `Ev` (`q, topic, subject, tags, type, marks, out: right|wrong|skip, at, ms?, src: practice|mock, got?, mock?, pick?`). Sources: the practice log (`gate.plog`), older answers saved before the log existed (`gate.practice`), **derived skips**, and every question of every finished, non-failed mock (`gate.attempts`; an unanswered mock question is a skip).

## View tracking and skips (important)
- There is **no Skip button**. `QuestionCard` / `CodeQuestion` log a **view** (`logView(q.id)` → `gate.views`) once a card has been ≥50% visible (IntersectionObserver) for ~1 second.
- **Skips = views − answers** per question. `buildEvents` creates skip events from the latest view timestamps. Re-opening an answered question adds a view, so it counts as a skip unless answered again (known approximation).
- Reset stats clears `views` along with the log.

## Metrics (`metrics`, `M`)
attempts, right/wrong/skip, accuracy, time (`ms`), speed, coverage vs bank size, streaks, "guess" detection (`GUESS_MS` = 10 s answers), marks with negative marking (`netMarks`: MCQ −1/3 or −2/3; none for MSQ/NAT/str).

## statsMore.ts
- `questionDetails(pack, evs, views)` → `QDetail` per question: attempts, streak, last result, mastery state, next review date.
- **Mastery states**: mastered (right last 3 in a row) · learning (right last 1–2) · slipped (right before, latest wrong) · struggling (wrong every time) · unanswered (seen, never answered) · unseen.
- `reviewGapDays(streak)`: 1 / 3 / 7 / 14 / 30 days (a wrong answer means tomorrow); `revisionQueue` lists due questions.
- `traps(details, min=2)`: questions with repeating wrong picks (uses `pick`).
- `headline`, `groupStats`, `byDifficulty/byType/byMarks/bySource`, `weekly`, `byHour/byWeekday` (IST), `masteryByTopic`, `examPace(pack)` (minutes per mark from the pack's mock tests), `planAdherence/adherenceSummary` (plan days vs ticks, linked questions and answers), `linkProgress/linkTotals` (per-day linked question counts: answered, correct, still to do; linked mocks are not included).

## Stats page tabs
Overview (headline numbers, insights, best/worst subject and topic, mock scores) · Progress (mastery bars per topic, revision queue, difficulty/type/marks, weekly trend, time of day, plan adherence, linked questions; styles `.sp-*`) · Explore (squarified treemap, `lib/treemap.ts`: subject → topic → question) · Questions (table) · Mistakes (`MistakesPanel`, re-solve until fixed, `gate.fixed`). Filters: days, source, type, tag (`applyFilters`).

## Excel export (`lib/statsSheets.ts`, `lib/xlsx.ts`)
Sheets: Summary, Subjects, Topics, Questions, Tags, Daily activity, Mocks, Question detail, Mastery by topic, Revision queue, Difficulty/type/marks, Weekly trend, Time of day, Linked questions, Plan adherence (the last two only when a plan exists). `xlsx.ts` is a dependency-free writer (stored-zip, bold frozen header, filters, widths, pct/dec formats). Adding a statistic = compute in `statsMore.ts`, show in `Progress.tsx`, add a sheet in `statsSheets.ts`, test in `check.ts`.

## Reset
`ResetStats.tsx`: type `Reset Stats` exactly; clears `plog, views, practice, fixed, attempts`; keeps plan/pack/ticks/links; wipes mock attempts too (disclosed in the dialog); offers "Export to Excel first".
