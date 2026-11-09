# 9. Practice, exam and code questions

## Answering and marking (`lib/scoring.ts`)
- `isAttempted`, `isCorrect`, `marksFor`. **MCQ**: negative marking 1/3 (1 mark) or 2/3 (2 marks). **MSQ**: exact set match, no partial credit, no negative. **NAT**: |answer − value| ≤ tolerance, no negative. **str**: `strCorrect` (`lib/strMatch.ts`). **code**: all tests must pass.
- Practice shows instant feedback and the explanation. `QuestionCard` logs the answer with `logPractice` (including `pick` for mcq/msq and time `ms`) and updates `gate.practice`; wrong answers become mistakes until solved again (`gate.fixed`).
- Question IDs are visible on every card (chip `.qid`, click selects it).

## Mock exam arena (`components/Exam.tsx`, `app/exam/[id]`, `app/arena.css`)
Copies a real computer-based exam: instructions page, timer from the wall clock (refresh does not pause), question palette with statuses, **Save & Next** and **Mark for Review & Next** (palette clicks, Back and Next do **not** save), sections as tabs, virtual calculator and NAT keypad. The test runs in **full screen**; leaving it, switching tab/window, blur, Esc or refresh ends the test as **failed** (`attempt.failed`, not scored, excluded from stats). **Do not add an Esc-closes handler on the exam screen.** The header shows only `attempt.title` (no exam name). Attempts persist in `gate.attempts`; `results/[id]` reviews them.

Building a test (`lib/mock.ts`): `buildFixedMock(m)` for a pack's mock tests; `buildMock(pack, opts)` for recipe/subject/topic/weak/quick tests (unseen questions first, then generated ones if `useBuiltinGenerators`, then already-seen); duration = max(requested, ~1.8 min per mark). `attemptFrom` makes the `Attempt`.

## Code questions
- Learner writes a program reading stdin and printing stdout; tests compare output (`sameOutput` in `lib/judge.ts`, whitespace-tolerant at line ends).
- **In the browser**: Python (Pyodide from jsdelivr CDN) and JavaScript in a Web Worker (`lib/browserRunner.ts`); a worker that runs too long is killed (time limits). Works when hosted.
- **On the user's computer**: Java, C, C++ (and Python/JS as fallback) through `POST /api/run` (`app/api/run/route.ts` → `lib/runner.ts`). It only answers requests from `localhost` / `127.0.0.1` / `::1`, needs the `x-orbit-run: 1` header, refuses cross-site requests, caps code at 100,000 characters, ≤40 test inputs, runs with a limited environment. **Nothing is sandboxed** (programs run with the user's permissions). `GET /api/run` reports which compilers are installed (`scripts/check-runner.ts` does the same from the CLI).
- A question's `setup` (files, folders, SQL tables) is shown on the card; **Copy setup prompt** (`lib/setupPrompt.ts`) gives an AI a prompt that writes a script building that data; the learner can set a working folder (`drafts["dir:<id>"]`). Questions with `setup` only work when Orbit runs on the user's own computer.
- Drafts autosave to `gate.drafts` (debounced 500 ms). After Submit/Skip the reference solution is shown.

## Generators
`lib/generators.ts` and `lib/questions/*` are GATE-sample numeric generators, used only when a pack sets `useBuiltinGenerators` (GATE pack). Do not add new dependencies on them.
