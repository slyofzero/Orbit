# Orbit: study planner, practice and mock tests

A personal study hub that runs in your browser. Upload **your plan** and **your question pack** (both JSON, an AI can write them for you) and Orbit gives you a day-by-day planner, topic-wise practice, mock tests on a real-exam-style screen, a mistake log and detailed statistics. Nothing is built in and nothing is only for one exam.

## Run it (Windows, macOS or Linux)
Needs Bun (https://bun.sh).

```
bun install
bun run dev        # http://localhost:3000
```

Production-style: `bun run build` then `bun run start`.

## Pages
| Page | What it does |
|---|---|
| Today | Today's tasks, linked questions ("Main event"), countdown, calendar, backup and restore |
| Planner | Next 3 days (Prev / Today / Next), full plan, missed days; upload, edit and improve your plan; link questions to days with any AI |
| Practice | Questions by subject and topic with instant feedback; programming questions |
| Mocks | Mock tests from your pack, plus subject, weak-topics and quick tests, on an exam-style screen |
| Stats | Overview, Progress, Explore (treemap), Questions, Mistakes; Excel export; Reset stats |
| Admin | A special profile that manages every other profile's plan, questions, mock tests and topics |

## Your data
Everything is saved in your browser (localStorage, plus IndexedDB for pictures), per profile. **Export your progress from Today regularly**; clearing site data deletes it.

## Scripts
- `bun run check`: the full logic test suite (must print `ALL OK`)
- `bun run export`: writes the sample GATE DA plan and pack into `exports/`
- `npx tsc --noEmit`: type check

## For developers and AI agents
Read `AGENTS.md`, then the files in `agents/` (index: `agents/README.md`). They describe the architecture, the saved-data format, every feature, the question-pack and plan formats, all AI prompts, statistics, styling rules, testing and the owner's preferences.
