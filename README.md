# Orbit

A personal, exam-agnostic study hub: planner, topic-wise practice, mock tests, mistake log and statistics. Next.js 15 / React 19 / TypeScript.

Storage is being rebuilt on SQLite (WASM, in a Web Worker, stored in OPFS). Design: [docs/STORAGE.md](docs/STORAGE.md). Schema: [db/schema.sql](db/schema.sql). Progress: [docs/HANDOFF.md](docs/HANDOFF.md).

UI: every screen is built from the shared components in `components/ui`, documented in [docs/COMPONENTS.md](docs/COMPONENTS.md). While `bun run dev` is running, http://localhost:3000/dev/components shows all of them live (the `/dev` pages return 404 in production).

```
bun install
bun run dev      # http://localhost:3000
bun run check    # must print ALL OK
bunx tsc --noEmit # must be clean
```
