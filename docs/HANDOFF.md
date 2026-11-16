# Rehaul handoff (16 Nov 2026)

Context carried over from a Claude chat so a new Claude Code session can continue.

## Done
- Audited the v2 exports (`GATE/questions.json`, `GATE/plan.json`) and the localStorage model. Findings: integrity clean, structure poor (base64 images = 92% of pack, polymorphic `answer`, questions copied into mocks and attempts, IDs encode topic, plan target counts disagree with links on 65/77 days, ticks keyed by task index, self-ratings stored inside the pack).
- Chose storage: SQLite WASM (`@sqlite.org/sqlite-wasm`) + OPFS `opfs-sahpool` VFS, opened only in a dedicated Web Worker, one DB file per profile. See `docs/STORAGE.md`.
- Wrote `db/schema.sql` (schema v1). Verified by loading the real exports + 20k synthetic answers: 0 FK violations, all CHECKs reject bad data, trigger-maintained `question_stats` equals a full rebuild, every UI query < 12 ms (native).

## Still to do
1. ~~Clear the old code on the `rehaul` branch and scaffold a fresh Next.js app, keeping `db/`, `docs/` and the git-ignored `exports/` folder.~~ Done 16 Nov 2026: fresh scaffold, `agents/` removed, AGENTS.md trimmed, `bun run check` loads the schema.
   - The 3 uncommitted edits that were on this branch (planner page, BonusBlock, PlanEdit) are saved as `../Orbit-rehaul-uncommitted-edits-2026-11-16.patch`. Apply them to `main` if they are wanted there.
2. Build `lib/db/worker.ts` (open DB, pragmas, migrations via `PRAGMA user_version`, named-query registry, change notifications) and `lib/db/client.ts` (`useQuery` / `useMutation`).
3. Write the v2 → v1 importer (steps in `docs/STORAGE.md` §6).
4. Open decision: merge subjects `dsa`, `prog` and `code`, or keep them separate?
