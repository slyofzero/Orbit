# 1. Overview and principles

## What Orbit is
A personal study hub, run in the browser:
- **Planner**: a day-by-day plan the user uploads (JSON), with tasks per day, milestones, a calendar, missed-day tracking and linked practice questions.
- **Practice**: topic-wise questions (MCQ, MSQ, NAT, short text, programming) with instant feedback, filters by subject/topic/tag/difficulty.
- **Mocks**: full mock tests that copy a real computer-based exam screen (timer, palette, sections, calculator, negative marking), plus generated tests (subject, topic, weak-topics, quick).
- **Stats**: a large set of statistics, an interactive treemap, a Progress tab, a mistake log, and an Excel export with many sheets.
- **Admin profile**: manages every other profile's plan, questions, mock tests and topics.
- **Study buddy** (a mascot in the sidebar): reacts to outcomes, shows quotes.

It began as "GATE DA 2027 prep" (the owner's exam, February 2027). The GATE content survives only as optional sample data (`lib/gatePlan.ts`, `lib/gateBank.ts`, `exports/`), exported with `bun run export`. **The running app is exam-agnostic.**

## Principles (decisions the owner has made; follow them)
1. **Nothing is only for GATE.** No GATE wording in UI, prompts or logic. Plan and pack come from the user's uploads. The internal storage-key prefix `gate.` and the `useBuiltinGenerators` pack flag stay for backwards compatibility (do not rename them).
2. **No backend for user data.** localStorage (small JSON) and IndexedDB (pictures). The only server code is `app/api/run/route.ts`, which runs programs for code questions, and only when the app is opened on localhost.
3. **Validate everything that is imported**, and tell the user exactly what is wrong (plain language, with the offending id or date). A made-up question id or date must never reach saved data.
4. **AI is a helper, not a dependency.** The app never calls an AI. It builds prompts the user pastes into any AI chat, and parses the JSON that comes back. Prompts are therefore product features (see `07-ai-prompts.md`).
5. **Per-profile everything.** Like browser profiles: each has its own plan, pack, progress, links, mocks, milestones.
6. **Skips are derived, not recorded.** The old Skip button was removed. A question counts as skipped when it was viewed (on screen for a moment) and not answered. See `08-statistics.md`.
7. **Destructive actions are protected**: replace/remove of a plan or pack offers "export the old one first"; Reset stats needs the exact phrase `Reset Stats`; each has a red CAUTION line.
8. **Accessible and calm UI**: keyboard focus visible, Esc closes dialogs, reduced-motion respected, light and dark themes.

## Vocabulary
- **Pack / question pack**: the JSON that holds subjects, topics, practice questions, and mock tests. One per profile.
- **Practice bank**: `pack.questions`. **Mock bank**: questions inside `pack.mockTests[*].sections[*].questions`; each belongs to exactly one mock.
- **Plan**: the day list + phases + milestones + description. **Day kinds**: study, light, mock, crunch ("short day" in the UI), buffer, exam, taper.
- **Links**: per plan day, which practice questions (and optionally one mock test) to do that day, plus an optional note. Stored in `gate.links`.
- **Profile**: a separate saved world. First profile `main` uses the plain keys; others use `gate.p.<id>.*`.
- **Event (`Ev`)**: one answered/skipped question, used by every statistic.
