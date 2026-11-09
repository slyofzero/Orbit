# 14. Study buddies (mascots) and their sky scenes

Files: `components/mascots.tsx` (the characters, `BUDDIES`, types), `components/Companion.tsx` (behaviour and the sidebar scene), `components/outcomes.ts` (what buddies say about answers), `components/adminLines.ts` (what they say in the Admin profile), `lib/outcome.ts` (how pages announce an outcome), `lib/quotes.ts` (the quote pool), CSS in `app/site.css` (`.pet`, `.sky`, `.scene-*`, `.rail-stage`).

## The cast (in `BUDDIES`, in rotation order)
`owl` Hoot (scene `sky`) · `robot` Bit (`lab`) · `cat` Miso (`rain`) · `astro` Nova (`space`) · `jelly` Blob (`sea`) · `tea` Lord Earl Grey (`london`) · `rex` Rexy (`paris`) · `ghost` Boo (`cake`).

## How a buddy behaves (`Companion.tsx`)
- Shown at the bottom of the sidebar inside `.rail-stage`: a backdrop (`.sky.scene-<scene>`, built by `SceneArt`) with the buddy (`.pet`, an inline `<svg viewBox="0 -14 80 110">`) in front.
- **Rotation**: a different buddy and backdrop every 5 minutes (`ROTATE_MS`), or when the person clicks the scene. The current index is kept for the browser session in `sessionStorage["gate.buddy"]`. Another part of the app can switch buddy with `window.dispatchEvent(new CustomEvent("gate-buddy", { detail: "cat" }))` (an id or an index).
- **Eyes** follow the mouse (`.pupils`), blink (`.lid`), and the buddy sleeps from midnight to 5 am IST (mood `sleep`, shows `sleep` line, `.zzz`). When every task of today is done the mood is `party` (hat and sparkles, `.hat`, `.spark`).
- **Speech bubble**: clicking the buddy says a random `chat` line; about every 2.5 minutes it may speak on its own (60% chance, only if the tab is visible); sometimes it shows a quote (`QUOTES` from `lib/quotes.ts`; the admin profile uses `ADMIN_NOTES`). Clicking it 5 times quickly makes it dizzy and triggers a nebula.
- **Reacts to cosmic events**: listens to `gate-cosmos` and `gate-cosmos-phase` and says `react[kind]` (see `13-cosmic-events.md`); reacts to `gate-finale`.
- **Reacts to answers**: pages call `announce("right" | "wrong" | "skip" | "giveup" | "quit", defer?)` from `lib/outcome.ts`; the buddy says a random line from `OUTCOME_LINES[buddyId][outcome]`. On screens with no buddy (the exam arena) call `announce(kind, true)`: it is kept in `sessionStorage` and shown as soon as the next page with a buddy opens.
- **Admin profile**: the buddies talk to "Boss" using `ADMIN_LINES[id]` (`hello`, `chat[]`, `sleep`, `react`) and `ADMIN_NOTES`.
- Reduced motion: animations on `.sky *`, `.body`, `.lid`, `.wing` are switched off in CSS.

## Edit what a buddy says
- Chat lines, sleep line, reaction lines: the object for that buddy in `BUDDIES` (`chat`, `sleep`, `react`).
- Answer reactions: `OUTCOME_LINES[id]` in `components/outcomes.ts`; each of the five outcomes needs at least one line (2 to 3 is the norm).
- Admin lines: `ADMIN_LINES[id]` and `ADMIN_NOTES` in `components/adminLines.ts`.
- Quotes: add short, original lines to `lib/quotes.ts` (none repeats until all were shown).
- **Rules for any line**: short (one or two sentences), in the buddy's voice, friendly, **no exam names** (never "GATE"; say "exam day"), nothing mean about wrong answers. `bun run check` fails if a line mentions GATE.

## Add a new buddy (checklist)
1. **Draw it** in `mascots.tsx` as `const Fox = () => (<> … </>)`: SVG shapes in a `0 -14 80 110` viewBox, about 80 wide and 96 tall. Group the character in `<g className="body">` (it bobs), put the eyes in `<g className="pupils">` (they follow the mouse) and cover them with `<ellipse className="lid" …>` (blink and sleep), optional `className="wing wl|wr"` (flap), `tail`, `led`, `beacon`, `tent` (existing animations in `site.css`). End the body group with `<Extras />` so the party hat, zzz and sparkles work (`Extras hat={[x, y]}` moves the hat; `noHat` removes it). Use fixed colours that look good on both light and dark backdrops.
2. **Add it to `BUDDIES`**: `{ id: "fox", name: "Fenn the fox", scene: "sky", art: Fox, sleep: "…", react: { …all 10 reactions… }, chat: [ …8 lines… ] }`. The ten reactions are the eight cosmic events plus `impact` and `rings`.
3. **Answer lines**: add `fox: { right: [...], wrong: [...], skip: [...], giveup: [...], quit: [...] }` to `OUTCOME_LINES`.
4. **Admin lines**: add `fox: { hello, chat: [...], sleep, react }` to `ADMIN_LINES`.
5. **Backdrop**: reuse an existing scene, or add one (below).
6. Look at it in the sidebar in both themes: wait for rotation or run `window.dispatchEvent(new CustomEvent("gate-buddy", { detail: "fox" }))` in the console; check the sleep state (temporarily change the hour check) and party state (tick all of today's tasks); click it, hover the mouse around, and trigger events with `gate-cosmos-now`.
7. `npx tsc --noEmit` and `bun run check` (it checks every buddy has all lines and unique ids). Update this file's cast list.

## Add or change a backdrop scene
1. Add the name to `Scene` in `mascots.tsx`.
2. In `Companion.tsx`, add a `case "myscene":` to `SceneArt`, returning small decorative elements (`<i>`, `<u>`, `<b>`, `<s>`, `<em>`, or an `<svg>`) positioned in percentages.
3. In `app/site.css` add `.scene-myscene { background: … }` and a dark variant `[data-theme="dark"] .scene-myscene { … }`, plus rules for the child elements and any `@keyframes`. Use a unique class prefix; scenes already share `.sky[class*="scene-"] i, u, b, em, s` base rules, so check what they set before overriding. Elements must be `pointer-events: none`.
4. Keep animations subtle and covered by the reduced-motion rule (`.sky *` is already switched off there).
5. Point a buddy's `scene` at it.

## Remove or rename a buddy
Remove its `BUDDIES` entry, its `OUTCOME_LINES[id]` and its `ADMIN_LINES[id]` entries. `sessionStorage["gate.buddy"]` only stores an index, taken modulo the list length, so removing one is safe.
