# Orbit: study planner and mock tests

A personal study site: day-by-day planner (Nov 8, 2026 to Feb 7, 2027 (GATE day)), topic-wise practice, a mistake log, and a mock-test arena that copies the real GATE exam screen.

## Run it (Windows, macOS or Linux)

Needs Bun (https://bun.sh).

```
bun install
bun run dev
```

Open http://localhost:3000

For a faster, production-style run: `bun run build` then `bun run start`.

## What is where

| Page | What it does |
|---|---|
| Dashboard | Today's tasks, countdown, progress, weakest topics, settings, export/import |
| Day Planner | All 104 days with tasks, daily practice targets, "missed" tracking |
| Practice | 70 topics. Instant feedback. Topics marked ∞ also generate fresh random numeric questions |
| Mock Tests | Full 3-hour mock (65 Qs, 100 marks), 1-hour sectional, subject test, weak-topics test |
| Mistakes | Every wrong or skipped question (practice and mocks) until you solve it again |

## Exam arena rules (same as GATE)

- Palette click, Back and Next do NOT save an answer. Use **Save & Next** or **Mark for Review & Next**.
- MCQ negative marking: 1/3 for 1-mark, 2/3 for 2-mark. MSQ and NAT: no negative marking, no partial credit.
- Section tabs: General Aptitude (Q1-10), Data Science and AI (Q11-65). Virtual calculator and NAT keypad included.
- The timer uses the wall clock, so refreshing the page does not pause it.

## Your data

Everything is saved in your browser's localStorage. **Export progress from the Dashboard once a week**; clearing site data deletes it.

## Adding questions

Questions live in `lib/questions/*.ts`, one file per subject. Each one is a single line using a helper:

```ts
mcq("svm", 1, "Question text with $math$", ["A", "B", "C", "D"], 2, "Explanation")   // 2 = index of correct option
msq("svm", 1, "Select all that apply", ["A", "B", "C"], [0, 2], "Explanation")      // [0, 2] = correct options
nat("svm", 2, "Numerical answer?", 0.5, 0.01, "Explanation")                        // value, tolerance
```

The first argument is the topic id from `lib/topics.ts`; the second is marks (1 or 2). Always add new questions at the END of a file so existing ids stay stable. Math uses KaTeX (`$...$`); code blocks use triple backticks.

Random numeric generators live in `lib/generators.ts`.

## Changing your plan or gap list

- Plan days: `lib/plan.ts`
- Topic status (know / shaky / no idea): top of `lib/topics.ts`

## Sanity check

`bun run check` validates every question and generator, and builds sample mocks.


## Tags and statistics

Every question carries two mandatory tags, its **subject** and its **topic**, and optional extra tags (skill, difficulty, idea). Write them in the question pack:

```json
{ "subject": "maths", "topic": "algebra", "tags": ["factorising", "hard"], "type": "mcq", "marks": 1, "text": "…", "options": ["…"], "answer": 0, "explanation": "…" }
```

The **Stats** page (sidebar) turns every answer, skip and mock into numbers cut along those tags: strongest and weakest subject and topic, most and least encountered questions, accuracy per tag, streaks, speed, coverage and more. **Explore** is an interactive treemap (click a subject, then a topic, then a question). **Export to Excel** saves everything as an .xlsx file. Mistakes live in the Stats page too.

## Separate banks for practice and mock tests

A pack has two question banks. `questions` is the **practice bank**. `mockTests` is a list of complete mock tests, each with its own questions inside its sections, so a mock question belongs to exactly one mock and never shows up in Practice or in another mock. Ids must be unique across the whole file. The quick, subject and weak-topics tests still draw from the practice bank. Uploading a pack on top of an existing one ("Add to my pack") adds new mock tests whole, and puts new questions into a mock that has the same id.

## Admin profile

Open the profile menu and choose **Admin: manage all profiles**. The admin profile has no plan or questions of its own. It lists every profile, and picking one opens that profile's questions (practice and mock), mock tests, topics, plan and an upload box. You can add, edit and delete questions, find any question by id (inside one profile or across all of them), edit the plan as JSON and upload a pack.

Question ids are unique across Practice and every mock test. Uploading a pack with ids that already exist **replaces** those questions in place, which is also how you edit questions in bulk.
