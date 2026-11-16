# Orbit

A personal, exam-agnostic study hub: planner, topic-wise practice, mock tests, mistake log and statistics. Next.js 15 / React 19 / TypeScript.

Storage is being rebuilt on SQLite (WASM, in a Web Worker, stored in OPFS). Design: [docs/STORAGE.md](docs/STORAGE.md). Schema: [db/schema.sql](db/schema.sql). Progress: [docs/HANDOFF.md](docs/HANDOFF.md).

```
bun install
bun run dev      # http://localhost:3000
bun run check    # must print ALL OK
bunx tsc --noEmit # must be clean
```
