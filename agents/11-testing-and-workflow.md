# 11. Testing and workflow

## Before you say you are done
1. `npx tsc --noEmit` is clean.
2. `bun run check` prints `ALL OK` (it validates the sample content, packs, plans, prompts, links, stats, xlsx, LaTeX repair, edit prompt, pictures list…). Add a test block in `scripts/check.ts` for every new pure function; tests use a local `err(msg)` collector.
3. For UI changes, look at it in a browser (below), in light and dark.

## Browser verification (Playwright, Python)
Build and start: `npm run build` then `npx next start -p <port>` (use a fresh port; kill old ones). The app keeps data in localStorage, so seed it with a first page load then `localStorage.setItem('gate.pack', …)` / `'gate.plan'` / `'gate.plog'` / `'gate.views'` / `'gate.links'`, reload, and screenshot (`page.screenshot`). Note: several pages have more than one `textarea.pi-text` (plan description + the paste box); target the last (`>> nth=-1`).

## Delivering to the owner
The owner runs it on Windows (`bun --bun next dev`) in `C:\Users\Ishan\Personal\GATE\Orbit`, which differs from the working container copy: **their `package.json` is different; never overwrite it.** Changed files are delivered one by one (send the file, then write it to the matching path). Tell the owner to restart dev and hard-refresh (Ctrl+Shift+R) if styles do not change.

## Conventions
- TypeScript strict, no `any` unless unavoidable; comments explain *why*, in plain English.
- Keep UI components small; put logic in `lib/`.
- Never remove a `// eslint-disable` or workaround without reading why it exists.
- Do not add dependencies without a strong reason (the app is deliberately dependency-light; even the Excel writer is hand-rolled).
- New persisted data: add a key to `KEYS`, include it in backup/restore and Reset/`clearAll` decisions, and mention it in `03-data-model-and-storage.md`.
- New statistic: see the checklist at the end of `08-statistics.md`.
- New prompt: see `07-ai-prompts.md`.

## Known limits / disclosed approximations
- The Python in-browser runner (Pyodide) loads from a CDN; offline use needs it cached.
- Derived skips are approximate (reopening an answered question adds a view).
- Reset stats also wipes mock attempts.
- Linked mock tests are not in the linked-question statistics.
- The `gate.` storage prefix and `useBuiltinGenerators` flag are intentionally kept.
