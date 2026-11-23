# Orbit UI components and the `/dev` workbench

Every screen in Orbit is built from a small set of shared components. This file explains **what each one is for**, **its main options**, and **the rules** that keep the app consistent. Each component is also shown live, in both themes, at **`/dev/components`**.

- Shared components: `components/ui/` (one file each; everything is exported from `components/ui/index.ts`)
- Question components: `components/question/`
- Styling: **Tailwind CSS v4 utility classes**, written in the components. All CSS lives in `styles/`: `styles/site.css` holds the theme, custom utilities and base rules, and imports the rest (see §3).

---

## 1. The `/dev` route

`/dev` is a **workbench for developers**, not part of the app the learner uses.

| Page | What it is |
|---|---|
| `/dev` | Index of the workbench pages |
| `/dev/components` | Every shared component and question type, live and interactive, with its normal, **special** (cool) and **warm** variants |

**Why it exists**
- To see and try every component in one place, in light and dark (toggle in the top bar), on a phone width and a desktop width.
- To catch regressions quickly. Every component on the page renders some maths, so a component that stops rendering markdown + LaTeX shows raw `$…$` text and stands out at once.
- To give new screens a reference: copy the usage from the demo.

**It only exists in development**
- `app/dev/layout.tsx` calls `notFound()` unless `NODE_ENV` is `development`, so in a production build (and on Vercel) **every `/dev` page returns 404**.
- It is marked `noindex`, and picture uploads on it are kept in memory only (lost on reload).

**Using it**
```
bun run dev
open http://localhost:3000/dev/components
```

**Rule:** when you add or change a shared component, add or update its demo on `/dev/components` in the same change (file: `app/dev/components/Showcase.tsx`).

🔴 **CAUTION:** never run a second dev server, or `bun run build`, against the same `.next` folder as a dev server that is already running; they corrupt each other ("`__webpack_modules__[moduleId] is not a function`"). For a second, throwaway server use its own folder: `NEXT_DIST_DIR=.next-check bun --bun next dev -p 3127`. Next.js then adds `.next-check/types/**/*.ts` to `tsconfig.json`; revert that afterwards and delete `.next-check`.

---

## 2. Rules every screen follows

1. **Only shared components.** No raw `<button>`, `<input>`, `<select>`, `<a>`, `<h1>`–`<h3>`, `<p>`, `<details>`, `<table>` or `<hr>` in pages. If something is missing, add it to `components/ui` (with a demo) first.
2. **No native `<select>`.** Its pop-up list is drawn by the browser: it can't be themed and can't show maths. Use `Dropdown`.
3. **All text is markdown + LaTeX.** Every component renders its text props through `txt()` automatically. In your own JSX, wrap text in `<Text>`, `<Rich>` or `txt()`. See §4.
4. **Colours only through theme tokens** (`bg-sheet text-ink border-line bg-accent text-gray …`). Tailwind's own palette (`gray-500`, `blue-600`…) is switched off: it doesn't follow light / dark. Both themes are required.
5. **Special sparingly.** The animated gradient ("special") is for moments worth celebrating: one or two per screen.
6. **Never start a class with `ad-`, `ads-`, `banner` or `sponsor`:** ad blockers hide those on the deployed site.

---

## 3. Styling, theme, "special" and "warm"

- **Tailwind CSS v4.** Components carry utility classes; CSS lives in the root `styles/` folder. `styles/site.css` contains only:
  - the **theme tokens** (`--pad --sheet --ink --accent …`, light and dark) and the `@theme` mapping that makes them Tailwind's only colours (`bg-sheet`, `text-ink`, `border-line`, `bg-accent-soft`, `text-on-hero/70`…), fonts (`font-display`, `font-body`, `font-mono`), radii (`rounded-sm/md/lg`) and shadows (`shadow-card`, `shadow-lg`);
  - **custom utilities**: `special-fill`, `special-text`, `special-border` (inner colour via `--sp-inner`), `special-tint`, `special-ring`, `warm`, `dot-grid`, `frosted`;
  - base element rules (body, headings, code, selection, scrollbars, reduced motion);
  - `@import`s of everything else, each file saying what uses it:
    - `styles/animations/*.css`: the `animate-*` tokens and their keyframes, one file per component (`toast.css`, `dialog.css`, `popover.css`, `button.css`, `file-input.css`, `quote-banner.css`) plus `shared.css` for those several components use (`flow`, `flow-border`, `twinkle`, `card-in`, `copy-pop`);
    - `styles/code-editor.css`: the **code-editor overlay** (`ui-ce-*`), plain CSS utilities can't express;
    - `styles/theme-ripple.css`: the **theme ripple**.
- **`dark:`** follows Orbit's theme (system setting, overridden by the user's choice), not just the system. It is rarely needed: the tokens switch by themselves.
- **Shared looks** used by several components (field box, pop-up panel, trigger, label / hint / error) are class strings in `components/utils/styles.ts`; button looks are exported from `Button.tsx`.
- Don't add component CSS to `site.css`. Use utilities; if a pattern repeats, add an `@utility`. A new animation goes in `styles/animations/<component>.css` (inside `@theme inline`), imported from `site.css`.
- **Formatting:** `bun run format` runs Prettier on every `.tsx` file (`.prettierrc.json`); `bun run format:check` must pass.

- **Theme:** light by default, dark when the system says so, unless the user picks one with `ThemeToggle` (Light / System / Dark). The choice is saved as `localStorage["orbit.theme"]` and applied before the first paint (`lib/theme.ts`), so there is no flash. Reactive theme state is managed via Jotai in `@/lib/global` (`useTheme()`). Switching reveals the new theme as a circle growing from where you clicked.
- **Special:** many components take `special` (or `variant`/`tone="special"`). Filled parts get a slowly flowing gradient; bordered parts a flowing gradient border; headings gradient text. Larger components also show a sparkle badge. Special panels (`Card`, `Dialog`) glow underneath; `glow` sets how much: `low` · `medium` (default) · `high` (utilities `special-glow-*`, classes in `GLOW`, `Special.tsx`; they follow warm). Motion stops for users with "reduce motion" on.
- **Cool vs warm:** the default special gradient is **cool** (teal, blue, violet). Wrap anything in `<Warm>` and every special style inside it becomes **warm** (rose-red, red-orange, orange, a touch of amber, the v1 quote-banner colours). Toasts, which render outside your layout, use `toast("…", "warm")` instead.

```tsx
<Button variant="special">Cool</Button>
<Warm inline><Button variant="special">Warm</Button></Warm>
```

---

## 4. Text, markdown and maths

| | |
|---|---|
| **`Rich`** · `Rich.tsx` | Renders a string as markdown + LaTeX. `block` for full markdown (paragraphs, lists, headings, quotes, code blocks, `$$display$$`); without it, one inline run (bold, italic, `$maths$`, links, pictures). Raw HTML in the text is shown as text, never run. |
| **`txt(node)`** · `txt.tsx` | What every component calls on its text: a string → `<Rich>`; JSX text with `{…}` pieces (`Score: {n}%`) is joined first; elements pass through. Safe to call from server components. |
| **`Text`** · `Text.tsx` | Running text. `variant`: `body` · `muted` · `small` · `hint` · `caption` (small uppercase group label) · `error`. `as`: `p` (default) / `span` / `div`. `block` = full markdown. |
| **`Code`** · `Text.tsx` | Inline code, shown exactly as typed (no markdown or maths inside). |
| **`Heading`** · `Heading.tsx` | `level` 1–3, optional `special`, optional `id`. |

**Syntax** (parser: `lib/markdown.ts`): `**bold**` · `*italic*` · `++underline++` · `~~strike~~` · `` `code` `` · `$x^2$` · `$$…$$` · `[text](https://…)` · `![alt](img:<hash>)` · `- list` · `1. list` · `## heading` · `> quote` · `---` · `\$` for a literal dollar sign.

- Links allow only `https://`, `http://`, `mailto:` and `#anchors`; pictures only `img:<hash>` (stored pictures) and web addresses. Never base64.
- **Cost:** plain text skips parsing; parsed text and rendered maths are cached. About 2 µs per label and 50 µs per new formula.
- **Writing maths in JSX:** inside an attribute string (`label="$\frac{1}{2}$"`) backslashes and braces are literal. As JSX children use a JS string: `{"$\\frac{1}{2}$"}`. A bare `{1}` in JSX text is a JavaScript expression and its braces vanish.
- **Pictures:** `img:<hash>` is turned into a URL by the nearest `ImageProvider` (`images.tsx`). The app provides one backed by the database (`components/app/ImageStore.tsx`, in the app layout; `image.get`), and `useAddImage()` gives the editor's `onAddImage` (`image.add`); `/dev` uses an in-memory one.

---

## 5. Component catalogue

### Actions
| Component | File | Use it for | Main options |
|---|---|---|---|
| `Button` | `Button.tsx` | Any action | `variant`: `primary` (one per screen) · `secondary` · `soft` · `ghost` · `danger` · `special`; `size` sm/md/lg; `icon`, `iconAfter`, `loading`, `block`; `href` makes it a link with the same look |
| `IconButton` | `Button.tsx` | An action shown as an icon only | `label` (required: read aloud and shown on hover); `size` sm/md; `variant` `outline` / `ghost` (toolbars, inside other components) |
| `Spinner` | `Button.tsx` | Something is loading | `label`, `special` (gradient ring) |
| `ImportProblems` | `ImportProblems.tsx` | What every import screen (plan, question file, progress) shows when a file is refused: a numbered list of the exact problems and a "Copy how to fix this" button. The copied text (`lib/importFix.ts`) lists the errors, says how to fix them and restates the file format, so it works pasted into any AI chat | `kind` `plan` / `questions` / `backup`; `errors` (the parser's messages); `fileName` (when several files are checked together) |
| `CopyButton` | `CopyButton.tsx` | Copy text to the clipboard | `text` (string or a function, so long text is built only when clicked); `label` (omit for an icon button, then `hint` is its hover text); `tone` `match` (page colours, default) / `contrast` (inverted: dark on light, light on dark); icon turns into ✓ "Copied!" (✗ if the browser blocks it) |
| `Link` | `Link.tsx` | Navigation | `variant`: `inline` (underlined, in text) · `nav` (menu item, `active`) · `subtle`; `http(s)`/`mailto` open in a new tab |

### Form fields
All fields take `label`, `hint`, `error` and **`help`** (a "?" tip beside the label), and are wired up for screen readers.

| Component | File | Use it for | Main options |
|---|---|---|---|
| `TextField` | `Field.tsx` | One line of text or a number | all `<input>` props (`inputMode="decimal"` for numbers) |
| `TextArea` | `Field.tsx` | A few lines of plain text | all `<textarea>` props |
| `RichEditor` | `RichEditor.tsx` | Writing formatted notes / questions | toolbar (bold, italic, underline, strike, heading, lists, quote, divider, link, picture, maths, code); Write / Preview / Both; shortcuts Ctrl+B/I/U/K/M/E; `onAddImage(file) → "img:<hash>"` enables upload and paste; every action undoable with Ctrl+Z |
| `CodeEditor` | `CodeEditor.tsx` | Writing code | language picker (Python, C, C++, Java, JavaScript, SQL, plain text; `language`/`onLanguageChange` or `defaultLanguage`); highlighting, line numbers, indent guides; Enter keeps indent (+1 after `:` or `{ ( [`), Tab/Shift+Tab, Backspace removes a level, `}` outdents; rules in `lib/codeIndent.ts` |
| `Dropdown` | `Dropdown.tsx` | Choosing one item from a list | `options` (`label`, `description`, `icon`, `disabled`, `group` = a heading above each run of options sharing it); `searchable` adds a filter box; keyboard ↑/↓, Home/End, type a letter to jump |
| `DatePicker` | `DatePicker.tsx` | Choosing a day | values are `YYYY-MM-DD` (IST); `min`, `max`, `clearable`; keyboard arrows, PageUp/PageDown, Home/End |
| `DateFilter` | `DatePicker.tsx` | Filtering by a day, week, month or weekday | a text box you type into; a list under it offers what the text could mean (`suggestRanges` in `lib/dates.ts`: "23 Nov", "today", "this week", "November", "saturday" → every / this / next / last Saturday), arrows + Enter or a click take one, and text that reads as a date is taken by itself. Text that isn't a date puts the last date back on leaving the box (no error line, nothing moves). × clears; the calendar button is the fallback (a day, Today, This week, This month, Clear). Value is a `DateRange` (`from`, `to`, `unit`, `weekday` for "every Saturday") or null; `min` / `max` pick the year, bound "every Saturday" and limit the calendar. Shares the calendar with `DatePicker` |
| `FileInput` | `FileInput.tsx` | Picking files | `files` / `onChange(files)`; `multiple`; `accept`; `title`, `description`, `buttonLabel`; drop zone lights up with the special gradient while dragging; chosen files become cards (type tile or picture thumbnail, size, ✓ Ready, remove) |
| `Checkbox` | `Choice.tsx` | On/off inside a form | `label`, `description`, `disabled`; `variant="task"` = v1's agenda task (round tick turning green, struck-through text, dashed line), `burst` = confetti pieces when ticked (`components/utils/burst.ts`) |
| `RadioGroup` | `Choice.tsx` | One of a few options, all visible | `legend`, `options` (`label`, `description`, `disabled`) |
| `Radio` | `Choice.tsx` | One round radio on its own, in a row you lay out yourself (the question editor's "this option is right") | `name` (radios sharing it form a group), `checked`, `onChange`, `label` (read aloud only), `disabled` |
| `Switch` | `Switch.tsx` | A setting that applies at once | `label` |
| `Segmented` | `Segmented.tsx` | 2–4 mutually exclusive options side by side | `segments` (`label`, `icon`); arrow keys; `special`: `true` (all) or a list of values (just those) |
| `ThemeToggle` | `ThemeToggle.tsx` | Light / System / Dark | `compact` = rail pill: cosmic-event button on the left (dud for now) and theme button on the right (toggles strictly between light and dark mode on each click; switching plays ripple) |

### Showing information
| Component | File | Use it for | Main options |
|---|---|---|---|
| `Card` | `Card.tsx` | A sheet holding one idea | `title` (h2, v1's card-title size), `subtitle`, `actions` (wrap under the title on narrow screens); `hero` (the one dark panel per screen); `special`, with `glow` low · medium (default) · high; `onClick` (+ `label`) makes the whole card one button (hover lift, accent border; Tab / Enter / Space; no other buttons inside) |
| `Pill` | `Pill.tsx` | Status, difficulty, counts, tags | `tone`: neutral · accent · green · red · amber · blue · ink · hi · red-solid · accent-solid · special (day kinds: study blue, light green, short day amber, mock accent-solid, exam red-solid, taper hi, buffer neutral) |
| `Kbd` | `Pill.tsx` | A keyboard key | text shown literally |
| `Tabs` | `Tabs.tsx` | Switching between views | `tabs` (`label`, `count`); arrow keys; `special`: `true` or a list of values; `shape`: `pills` (default) · `bar` (one rounded bar, the open tab filled: v1's Practice sections; no `special`) · `underline` (plain words on a line, the open one underlined in the accent colour: v1's Manage pack sections; no `special`) |
| `SearchField` | `SearchField.tsx` | A toolbar search box ("Find a topic") | `label` (read aloud), `value`, `onChange(text)`, `placeholder` (plain text); search icon, clear button once typed; grows up to 340px |
| `FilterMenu` | `FilterMenu.tsx` | v1's Filter button and pop-up | `groups` (`key`, `label`, `choices`: `value` unique across groups, `label`, `count`), `picked` / `onChange(values)`; search box, chosen chips + Clear all, 20 chips per group then "… N more"; renders nothing without choices; closes on Esc / outside click |
| `ProgressRow` | `ProgressRow.tsx` | v1's practice row, its own progress bar | `lead`, `title`, `end`, `good` / `bad` / `skipped` (0-100: share tinted green, then red, then grey; the rest plain), `hint`; `href` = link, else `onClick` = button |
| `StatusDot` | `ProgressRow.tsx` | A topic's rating dot | `tone` green · amber · red, `label` (read aloud, hover) |
| `Callout` | `Callout.tsx` | A highlighted message | `tone`: info · success · warn · **caution** (title always starts "CAUTION:", for anything destructive) · special |
| `ProgressBar` | `Progress.tsx` | Progress towards a total | `value`, `max`, `label`; `tone`: accent · green · red · amber · warm · gold · special; `segments` (stretches side by side, each as wide as its `max`, e.g. own questions warm + bonus gold); `showLabel={false}` |
| `Stat` | `Progress.tsx` | One big number | `value`, `label`, `hint`, `trend` up/down |
| `Table` | `Table.tsx` | Rows of data | `columns` (`header`, `cell`, `align`, `sortValue` makes it sortable, `special` highlights the column); `rowKey`; `empty`; `specialRow(row)`; `rowHref(row)` opens a row in a new tab on click or Enter (its buttons and links still work); `onRowClick(row)` runs instead for a row without `rowHref`, e.g. moves to another page in the same tab (Stats → Questions: the question's history page); `groupBy(row)` draws a heavier line where the group changes (Manage plan: one day's tasks); `rowTone(row)` tints a row `green` or `red` (Manage plan: done / missed); scrolls sideways on phones; keep to one page of rows |
| `Divider` | `Divider.tsx` | A line between sections | `variant`: solid · dashed · dotted · double · thick · accent · fade · special; `label` (and `align="start"`) |
| `EmptyState` | `EmptyState.tsx` | A list or page with nothing yet | `title`, text, `action`; say why it is empty and offer the next step |
| `Disclosure` | `Disclosure.tsx` | Show / hide extra content in place; the body grows and fades in when opened, shrinks and fades out when shut, in every browser (`disclosure-motion`, styles/animations/disclosure.css) | `title`, `defaultOpen`; `open` + `onOpenChange` = controlled by the page (e.g. forced open while searching); `bodyClassName` replaces the body's padding and layout (default: indented under the title) |
| `ProgressRing` | `ProgressRing.tsx` | A round meter (tasks done today) | `value`, `max`, `label`; `tone` hi · accent · green; size via `className` (default 52px); track takes the text colour, so it works on the hero |
| `ExamTimer` | `ExamTimer.tsx` | A mock's countdown ("Time left 01:59:07") | `endsAt` (Unix ms; wall clock, so a refresh never pauses it), `onTimeUp` (fires once at zero), `label`; amber in the last 10 minutes, red and pulsing in the last 2 (`styles/animations/exam-timer.css`; rules `clockText` / `clockTone` in `lib/exam.ts`) |

### App frame and dashboard pieces (from v1)
| Component | File | Use it for | Main options |
|---|---|---|---|
| `NavRail` | `NavRail.tsx` | The main menu | `items` (`href`, `label`, `icon`), `brand`, `footer`; narrow rail on desktop, bottom bar on phones (footer floats top-right) |
| `QuoteBanner` | `QuoteBanner.tsx` | The warm quote bar | `quote`, `onNext`; `size="sm"` beside the dashboard greeting; quotes and their order: `lib/quotes.ts` |
| `Runway` | `Runway.tsx` | The dashboard hero | `title`, `sub`, `stats`, `ticks` (done · miss · past · today · ms · future), `flags` (`pct`, `long`/`short`, `next`, `flip`, `level`); also `RunwayStat` (a chip), `Flame` (streak), `CountUp`; what goes in it: `lib/runway.ts` |
| `Calendar` | `Calendar.tsx` | v1's month calendar | `today`, `selected`, `onSelect`, `days` (per date: `tone` blue · green · amber · accent · red · hi · neutral, `done` ✓, `tag` red label + ring, `label` for screen readers), `legend`, `actions`; 6×7 Monday first, month follows `selected`, today pulses (`styles/animations/calendar.css`) |
| `BarChart` | `BarChart.tsx` | Small per-day bars ("Last 7 days") | `bars` (`key`, `label`, `value`, `title` (screen-reader text), `tip` (hover bubble via `Tooltip`, markdown + maths; none = no bubble), `highlight`), `label`, `height`, `max` (default the largest, at least 4); bars grow in (`styles/animations/bar-chart.css`) |
| `StatTile` | `StatTile.tsx` | A big number on a tinted block ("Where you stand") | `value`, `label`, `tone`: accent · green · amber · neutral |
| `ActionRow` | `ActionRow.tsx` | A list row ("Coming up") | `lead` (`big`, `small`), `title`, `sub`, `end`; `href` or `onClick` makes it clickable |
| `DateTile` | `DateTile.tsx` | v1's date block (planner cards and rows) | `big`, `small`; `size` sm/md; `highlight` (yellow, the focus day); `strike` (past) |
| `DayRow` | `DayRow.tsx` | v1's collapsible planner row | `lead` (date tile), `title`, `end` (hidden on phones), `count`; `today` (accent border), `past` (faded and crossed out while shut), `tone` won / missed (green / red edge); the body (`children`) renders only while open |
| `DayStrip` | `DayStrip.tsx` | v1's thin won / missed strip in a section header | `segments` (`key`, `weight` = width, `state` won · missed · partial · none, `part` 0–1), `label` (read aloud); rules for planner days: `lib/planner.ts` |
| `OrbitScene` | `components/background/OrbitScene.tsx` (import it from there; not in the `components/ui` index) | An animated universe (the `welcome` scene of `Backdrop`; the `/dev` demo uses it directly) | canvas; `sunX`, `sunY` (0–1); theme colours, follows light / dark; one still frame with reduced motion; decorative (`aria-hidden`) |
| `Backdrop` / `useScene` | `components/background/Backdrop.tsx` | The app's ever-present background layer, behind every app page | mounted once in `app/(app)/layout.tsx`, pinned to the viewport (doesn't scroll); a page calls `useScene("welcome")` to show a scene (default `"none"`, empty); scenes fade in, and fade out then unmount when the page leaves; scenes are the `SCENES` list in the file. Pages must not paint an opaque full-page background, or they hide it |
| `LaunchWarp` | `components/background/LaunchWarp.tsx` | The launch sequence after a plan is imported | full-screen overlay: canvas hyperspace warp, rocket lift-off, `title` fading up, then dissolves and calls `onDone`; `duration` (ms, default `LAUNCH_MS` = 1500) scales every part, `Infinity` keeps it on screen (dev); skipped with reduced motion; animations in `styles/animations/launch.css` |

### Overlays and feedback
| Component | File | Use it for | Main options |
|---|---|---|---|
| `Dialog` | `Dialog.tsx` | A focused task or confirmation | `open`, `onClose`, `title`, `footer`, `special` (with `glow` low · medium · high); `shake` = shakes a little as it opens (a warning, e.g. leaving a mock's full screen; `dialog-shake` in `styles/animations/dialog.css`); `size` `md` (520px, default) · `wide` (760px, a long form such as the question editor); closes on Esc, ×, or a click outside; fades in and out over a frosted backdrop |
| `Tooltip` | `Tooltip.tsx` | A short label for a button or link | `content`, `placement` top/bottom/left/right, `className` (replaces the inline wrapper layout, e.g. a chart column). The bubble (also `HelpTip`'s) opens in the browser's top layer (`popover`), so no card, stacking context or open dialog covers it; it is kept 8px inside the window and follows scroll |
| `HelpTip` | `Tooltip.tsx` | A "?" explaining the text beside it | hover, keyboard focus or tap; Esc or a tap elsewhere closes it |
| `HelpDialog` | `Tooltip.tsx` | Help too long for a bubble (tables, examples) | same "?" (optionally with a `label`), opens a `Dialog`; e.g. the editor's Formatting help |
| `ToastProvider` + `useToast()` | `Toast.tsx` | Short feedback ("Saved", "Copied") | `toast(text, tone, action?)` (`action` = `{ label, onClick }`, e.g. Undo); tones neutral · success · error · special · warm; bottom-right, slides in and out, others glide into the gap, at most 3; every toast stays 5 s (longer only while hovered); `error` toasts have **Copy** (copies the message); above everything incl. open dialogs and independent of them: a toast outlives the screen or dialog that showed it (the stack is a `popover` in the top layer, in one holder that is moved into the top open modal dialog so it stays clickable, and back to `<body>` the moment that dialog closes or is removed) |
| `SparkleBadge`, `Warm` | `Special.tsx` | The special style's badge; switching special to warm | `Warm inline` for inline content |

### Helpers (not visual)
In `components/utils/` (import from `@/components/utils`): `cx()` joins class names · `txt()` renders text as markdown + LaTeX · `useDismiss()` closes a pop-up on Esc or an outside click · `ImageProvider` / `useImageResolver` look up pictures · `styles.ts` shared class strings · `highlight.ts`, `textareaEdit.ts` (code editor and text editor internals). Still in `components/ui/`: `FieldLabel` is the label + "?" row used by every field · `copyText()` · `CODE_LANGS`. Icons are in `components/icons.tsx` (import from `@/components/icons`; 24×24 line icons, always paired with a label).

---

## 6. Question components (`components/question/`)

Each takes `question` (a `questions` row), `detail` (the matching type row from `types/tables/`), optional `number` (shows "Q3"), `special`, and `onAnswer(verdict)`.

| Component | Answer area | Checking (`lib/grade.ts`) |
|---|---|---|
| `McqQuestion` | lettered options, pick one | right if the picked index = `correct` |
| `MsqQuestion` | lettered options, pick several | all-or-nothing: the picked set must equal `correct` |
| `NatQuestion` | number field | right if within `± tolerance` of `value` |
| `StrQuestion` | text field | `exact` / `list` (in order) / `set` (any order); case rule from the question; any accepted answer counts |
| `CodeQuestion` | `CodeEditor` with the starter code (`rows`, `onCodeChange`; `split` = statement beside the editor on wide screens) | no automatic check: the learner marks it right or wrong |

Also here: **`AnyQuestion`** (shows a question with the component of its `type`, for lists of mixed questions), **`ExamQuestion`** (one question of a mock, any type: exam mode = controlled `response` + `onChange`, no Check, no verdict; `review` = locked, with the correct answer, explanation and marks earned; shapes and grading in `lib/exam.ts`) and **`QuestionPalette`** (the grid of numbered buttons beside a sitting: `states` one per question: practice `new` · `seen` · `right` · `wrong` (`lib/session.ts`) or a mock's `not_visited` · `not_answered` · `answered` · `marked` · `answered_marked` (`lib/exam.ts`); `current` (-1 = none), `onJump`, `start` (the first number, for a section), `counts` (numbers in the legend); the legend lists only the states present). The topic practice screen (`components/practice/PracticeSession.tsx`, `/practice/session?topic=`) is built from these; its clock is `components/utils/useSittingClock.ts` (`lib/activeClock.ts`).

They all share **`QuestionFrame`**: type, difficulty and marks (+marks, −negative marks or "No negative marking"), the stem, the answer area, **Check answer** → the explanation, directly under the answer area → the verdict bar with marks gained or lost and **Try again** at its right end (left out when `onReset` is not given: a locked review). `split` puts the stem beside the answer area; `exam` drops checking (a mock in progress). `OptionList` is the A/B/C/D list shared by MCQ and MSQ.

---

## 7. Adding a new component

1. Make sure no existing component already does the job (see §5).
2. Add `components/ui/<Name>.tsx`; export it from `components/ui/index.ts`.
3. Render every piece of text through `txt()` (or `Text` / `Heading`); support `special` if it is a component people would celebrate with.
4. Style it with Tailwind utilities and theme tokens only (shared looks: `components/utils/styles.ts`); check light and dark.
5. Pure logic (parsing, maths, rules) goes in `lib/` with a test in `scripts/checks/`.
6. Add a demo to `/dev/components` that includes some LaTeX, and a row to this file.
