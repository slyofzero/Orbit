# 12. Owner preferences and decision history

## About the owner
Ishan, a student preparing for an exam in February 2027 (originally GATE Data Science & AI). Works on Windows, runs the app with Bun. Timezone IST.

### How they want agents to work
- "Consider me a pig": they copy/paste and will not read long text. Keep final replies short and plain. Offer **paste-ready code** and self-explanatory UI.
- Explain the **problem first**, then give code that can be pasted without reformatting.
- Use big **🔴 CAUTION** lines for anything they must not do.
- Explanations should build up progressively, thorough but readable by a college student (Socratic style is welcome when teaching).
- One principle to remember: **"Nothing in Orbit should be only for GATE."**
- Deliver changed files to their machine folder; never overwrite their `package.json`.

## Decision log (what was built and why; newest areas last)
- **Exam-agnostic core**: plan and pack are uploaded JSON; GATE data became sample exports. GATE wording was stripped from the exam header, mascots, pack strings and prompts.
- **Profiles + admin profile** for managing several people/plans in one browser.
- **Pictures in questions** stored in IndexedDB by content hash; included in backups and pack exports.
- **Programming questions** with in-browser Python/JS and local Java/C/C++, `setup` descriptions and a setup-prompt for an AI.
- **Question links** (plan ↔ question bank) built with any AI via a paste prompt or, for large banks (> 100,000 chars), a two-file route with warnings that some AIs read only part of a big file (an AI once reported 809 questions for a 4,987-question export, so exports carry `questionCount` and the UI tells the user to check the count).
- **Dashboard rework**: linked questions appear as a "Main event" on the Today card; greeting + quote share a row; compact runway; "Go to planner" button; calendar labels truncate.
- **Skip button removed** → view tracking; skips derived as views − answers.
- **Big statistics expansion** (mastery, revision queue, traps, weekly/time-of-day, plan adherence, linked progress) with a Progress tab and a many-sheet Excel export; **Reset stats** with typed confirmation.
- **Copy AI prompt** per day (Today + planner cards), generic and including links and the plan description.
- **Plan description** field (JSON + UI) that flows into every plan-carrying prompt.
- **LaTeX everywhere in plans** (planner, dashboard, day page, milestones), with automatic repair of single backslashes in JSON.
- **Planner carousel**: Prev / Today / Next below the three day cards.
- **Plan export/import carries links**; import verifies links against the plan and question bank and offers "plan only" vs "plan + working links" (or states no link is valid).
- **Question IDs** shown next to every question (practice, mock header, results).
- **Esc closes every dialog** (except the exam arena, where Esc ends the test).
- **Question editor prompt**: "Copy prompt" (top right of the dialog, inverse-coloured button) builds an OCR clean-up prompt with strict one-code-block-per-field output; pictures can be copied separately (clipboard cannot carry prompt + picture together).

- **Finished-day focus**: a day whose tasks are ticked and linked questions answered dims its Main event box and moves the highlight/agenda to tomorrow (planner and Today).

- **Cosmic events** now fire every 15 to 25 minutes (random). Cosmic events and buddies each have a guide (`13`, `14`). A test checks every buddy has all its lines; a leftover exam name in a buddy line was removed.

## Open ideas the owner has not decided on
- A one-paste "prompt + picture" clipboard button (works only in some AI chat UIs).
- A "Copy picture as base64" button (only useful for API/code tools).

## Updating this documentation
When you ship a feature: update the matching file in `agents/`, add a bullet to the decision log above, and keep `AGENTS.md`'s map in sync. Do not let `README.md` and these files contradict each other.
