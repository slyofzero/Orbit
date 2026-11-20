# TODO

Work set aside for later. Where the rebuild stands: `docs/HANDOFF.md`.

## Planner (UI done 21 Nov 2026)
Working: the three tabs, ticking tasks, **Tick all / Untick all** (`plan.tickDay`), the copy-day prompt, the carousel and its stepper.
These still show the "coming in the next step" toast (grep `useSoon` in `app/(app)/planner/page.tsx`, `components/planner/DayBody.tsx`):

- [ ] Improve plan (v1: AI prompt, then paste back the question links)
- [ ] Unlink questions (whole plan) and Unlink this day (only while the day isn't locked)
- [ ] Edit plan (v1 `/planner/edit`)
- [ ] Export plan (`orbit-plan` file)
- [ ] Upload plan (replaces the active plan; 🔴 confirm first)
- [ ] `/day/<date>` page: the main event's "Practise these questions" link 404s until then
- [ ] Carry-over (below) also feeds the planner's `BonusBlock`

Offered, not asked for yet:
- [ ] Full plan: rows inside an open month start 38px in (v1: 14px). Needs a `Disclosure` body-padding option (component edit: ask first)
- [ ] Keyboard ← / → to step the carousel

## Dashboard functionality (parked 21 Nov 2026)
The dashboard UI is done; these actions still show the "coming in the next step" toast (grep `useSoon`, `components/dashboard/kit.ts`). Already working: ticking tasks (`plan.tickTask`) and the copy-day prompt (lean `dayHelpPrompt`).

- [ ] Milestones: add / edit / remove, with Undo (toast action)
- [ ] Reset milestones to the plan's own (store the plan file's originals so they can be restored)
- [ ] Settings table (your name, used by the greeting)
- [ ] Start fresh (🔴 destructive: confirm with a CAUTION callout)
- [ ] Backup export / import (the profile's `.sqlite3` file, `docs/STORAGE.md` §6)
- [ ] Full v1 day prompt: question texts, milestones, topic feelings
- [ ] Carry-over (`docs/PLANS.md` §5): feeds `BonusBlock` and the main event's gold stretch; bonus tick / unlink
- [ ] Use `components/app/Page.tsx` for the dashboard's padding (it still has its own copy)

## Small things
- [ ] Give the other special pieces the `glow` setting (low · medium · high) if wanted: question frame, file drop zone while dragging, special button hover, quote banner, main event box. Only `Card` and `Dialog` have it now.
- [ ] `bun run check` fails about 1 run in 5: "search index: table subjects already exists". The test names its temp file after the process id and an old one is sometimes still there on Windows. Fix: delete the file before opening it (`scripts/check.ts`, "schema: search index").
