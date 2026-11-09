# 13. Cosmic events (the sky behind the pages)

Files: `components/Cosmos.tsx` (all the events), `components/Companion.tsx` (the buddy reacts to them), `components/mascots.tsx` (each buddy's reaction line per event), CSS `.cosmos` in `app/site.css`, trigger in `components/ThemeToggle.tsx`.

## How it works
- `Cosmos` renders one fixed full-screen layer `<div className="cosmos">` (z-index 0, `pointer-events: none`, behind the page).
- An **event** is a function inside the `useEffect` in `Cosmos.tsx` that adds temporary elements to the layer with the helper `add(css, keyframes, options)`. It creates an `<i>` element, animates it with the Web Animations API (`el.animate`, `fill: "forwards"`) and removes it when the animation ends. Nothing is left behind.
- Events today: `supernova, nebula, shooting, comet, cluster, aurora, saturn, asteroid` (the type `Kind` and the array `KINDS` at the top of the file).
- **Schedule**: the first event appears ~25 s after the app opens; then one event every **15 to 25 minutes** (random: `rand(15 * 60_000, 25 * 60_000)` in `loop`). Nothing runs while the tab is hidden (`document.hidden`). The same kind never fires twice in a row (`last`).
- **Reduced motion**: `calm()` (`prefers-reduced-motion: reduce`) makes `run()` return immediately and CSS hides `.cosmos`. Every new event must respect this by going through `run()`.
- **Theme**: `dim()` returns 1 in dark mode and 0.85 in light mode; multiply every peak opacity by it (`const k = dim()`), so events stay visible but gentle on the light theme.
- **Helpers** inside the effect: `W()`/`H()` (viewport size), `rand(a, b)`, `later(fn, ms)` (timers that are cleaned up on unmount), `flash(peak, ms, color)` (screen flash), `shake(ms, amp)` (page shake), `phase(name)` (tells the buddy about a sub-moment).
- **Events the app sends** (all `window` CustomEvents):
  - `gate-cosmos` with `detail: Kind`: an event has started (the buddy reacts).
  - `gate-cosmos-phase` with `detail: "impact" | "rings" | …`: a sub-moment inside a long event (saturn uses `rings` and `impact`).
  - `gate-cosmos-now` with optional `detail: Kind`: **ask for an event now** (used by the sparkle button in `ThemeToggle`, and by clicking the buddy 5 times quickly, which sends `nebula`).
  - `gate-finale`: the secret finale (Konami code: ↑ ↑ ↓ ↓ ← → ← → b a). It fires several supernovas, aurora, nebula, cluster and shooting stars at once and makes the buddy throw a party.

## Change how often events happen
In `Cosmos.tsx`, find `loop(rand(15 * 60_000, 25 * 60_000))` and the first call `loop(25_000)`. Change those numbers (milliseconds). Update the comment above `Cosmos` and the sentence in this file.

## Add a new cosmic event (checklist)
1. **Write the event** in `Cosmos.tsx`, next to the others, as `const myEvent = () => { … }`. Start with `const k = dim();`. Build elements with `add({ …css… }, [ …keyframes… ], { duration, delay, easing })`. Use positions in pixels from `W()`/`H()` (rand for variety). Keep each element's total duration under ~10 s. Use `flash`/`shake` sparingly.
2. **Register it**: add the name to the `Kind` type, to the `KINDS` array and to the `table` object (`const table: Record<Kind, () => void> = { …, myEvent }`). TypeScript will complain if one is missing.
3. **Give every buddy a reaction line**: in `components/mascots.tsx` add the name to the `Reaction` type and add a `react.myEvent` line to **every** buddy in `BUDDIES` (the type requires all of them; `bun run check` fails if one is missing). Keep each line short, in the buddy's voice, and exam-agnostic.
4. **Admin profile**: the admin buddies use a single generic `react` line from `components/adminLines.ts`; nothing to add per event.
5. **Try it** without waiting: open the browser console and run `window.dispatchEvent(new CustomEvent("gate-cosmos-now", { detail: "myEvent" }))`, in both light and dark themes, and with the OS "reduce motion" setting on (nothing should appear).
6. Run `npx tsc --noEmit` and `bun run check`; update this file's list of events.

## Edit an existing event
Find its `const name = () => { … }` in `Cosmos.tsx`. Colours, sizes, counts and durations are plain numbers/strings inside the `add(...)` calls. After editing, trigger it with `gate-cosmos-now` and look at it in both themes. Remember that `saturn` is a long, multi-stage sequence (`TOT`, `BREAK`, `HIT` constants) with `phase("rings")` and `phase("impact")` calls that the buddy listens to: if you change its timing, keep those phase calls in step with what is on screen.

## Rules
- Pure decoration: never block clicks (`pointerEvents: "none"`), never read or write saved data, never throw.
- Always remove what you add (the `add` helper does). Use `later(...)` for delayed work so unmounting cancels it.
- No text or exam-specific references in events.
