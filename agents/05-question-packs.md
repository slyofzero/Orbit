# 5. Question packs

A pack is one JSON object (`PackData` after parsing). Parsed and validated by `parsePack` in `lib/packs.ts`; combined from several files by `lib/packMerge.ts`; edited piece by piece by `lib/packEdit.ts`. The authoritative format description for AIs is `packPrompt()` in `lib/packs.ts` and the example `packTemplateJson()`; keep them in sync with the parser.

A pack may hold at most 6000 practice questions.

## Top-level keys
`name` (≤60 chars) · `subjects` `{id: "Display name"}` · `topics` `[{id, subject, name, status}]` (`status`: know | shaky | noidea) · `questions` (practice bank) · optional `mockTests` · optional old-style `mocks` (recipes that draw from the practice bank) · optional `images`. `useBuiltinGenerators` is internal; never write it in new packs.

## Question fields
Mandatory: `subject` (must match the topic's subject), `topic`, `difficulty` (easy|medium|hard), `type`, `marks` (1|2), `text`, `explanation`. Optional: `tags`, `id` (normally left out: the system assigns ids like `algebra-7`, or `mock1-q4` inside mocks; supply an id only to replace an existing question).
Types:
- `mcq`: `options` (2–8), `answer` = index.
- `msq`: `options`, `answer` = list of indices.
- `nat`: `answer` = number, `tolerance` (absolute; default 0.01) or `{value, tol}`.
- `str`: short typed text (practice bank only, never in mock tests): `answer` string or list, `match` exact|list|set, `caseSensitive`. Compared after trimming, removing spaces, ignoring case unless asked; "NIL" = empty list (`lib/strMatch.ts`). **Never use `nat` for text.**
- `code`: practice bank only. `language` (python, c, cpp, java, javascript), `tests` (the AI prompt asks for 3–8; the parser allows up to 40; at least one must be visible; `hidden` tests show only pass/fail), optional `starter`, `solution`, `timeLimitMs` (200–15000), `setup` (≤6000 chars; exact deterministic description of files/folders/tables the program needs).

## Tags (strict)
At most 3 per question; at most 40 distinct tags per pack (AI target: 10–25); lowercase, 1–2 words joined with `-`; they describe the skill/style (formula, trap, calculation, …), **never** the source, series, year or number (`isSourceTag` rejects those). Difficulty is its own field (`difficulty`); older packs may carry it as a tag, so always read it with `difficultyOf(q)` in `lib/questionFilter.ts`.

## Mock tests
`mockTests: [{id, name, minutes (5–600), note?, sections: [{name, questions: [...]}]}]`. Every question belongs to exactly one mock; ids unique across the whole pack. Uploading on top of an existing pack ("Add to my pack") adds new mocks whole and puts new questions into a mock with the same id. Old-style `mocks` recipes pick counts of 1-/2-mark questions per subject.

## Maths, code and pictures in text
- LaTeX between `$…$` / `$$…$$` (KaTeX). In **JSON files every LaTeX backslash is doubled**; `repairBackslashes` rescues the common single-backslash accidents (`\t`, `\f`, `\b`, `\n`, `\r`, `\v`) and warns. Literal dollar = `\$`. No `\( \)`, `\[ \]`, packages, or `align` environments (use `aligned` inside `$$`).
- Code: inline in single backticks; blocks in triple backticks with a language (python, sql, c, cpp, java, javascript, typescript, bash, json, r, html). Never put code between dollar signs. `mergeTickLines` repairs line-by-line backticks.
- Pictures: `![caption](img:name)` plus a top-level `images` object of data URIs (png/jpeg/webp/gif/svg). Limits: 3,000,000 characters per picture, 2000 pictures, 80,000,000 characters total. The app renames each picture by content hash (`h…`) and stores it in IndexedDB. `https://` image links also work. `scripts/embed-images.ts` builds a pack from picture files.
- `texProblems` (in `lib/tex.ts`) reports LaTeX that will not render, at upload time, so what passes upload is what renders.

## Merging and editing
- `mergeFiles` (several files → one): first file wins for subjects/topics; later file wins for a question/mock/recipe with the same id; problems are reported per file.
- Replacing a pack offers export-first; reset of history is separate (`usePack().clearHistory`).
- The admin editor edits one question; `checkQuestion` pushes it through `parsePack` so a broken question cannot be saved. `upsertQuestion` writes it to the practice bank or a mock section.
- `lib/typeBreakdown.ts` and `components/PackBreakdown.tsx` show how many questions of each type each topic holds.
