# 10. UI and styling

## Stylesheets
- `app/site.css`: everything except the exam screen. One file, grouped by feature with **unique class prefixes**: `ipm-` (improve-plan modal), `sp-` (stats progress), `xf-` (export-first / reset modals), `pi-` (plan/pack import), `pg-`, `pl-` (planner), `ad-` (admin and question editor), `qc`/`qmeta`/`qid` (questions), `top-row`, `d-agenda-head`, `tabs`. When adding styles, **append with a new unique prefix** and check nothing earlier overrides your selector (specificity!).
- `app/arena.css`: the mock exam screen only.
- Theme via `html[data-theme="dark"]`; variables: `--pad --sheet --sheet-2 --ink --ink-2 --ink-soft --accent --accent-soft --on-accent --hi --red --green --blue --amber --gray --line --code-bg --shadow --font-display --font-body --rail`. Always use variables; test both themes. Light-only overrides use `html:not([data-theme="dark"])`.
- Buttons: `.btn`, `.btn.soft`, `.btn.primary`, `.btn.invert` (white in dark mode, black in light mode; used for the question editor's Copy prompt). Pills: `.pill`. Panels: `.panel`. Tabs: `.tabs`. Callouts: `.callout`.

## Dialogs and Esc
Overlays: `ExportFirstModal` (`.xf-veil`), `ResetStats` (`.xf-veil`), `ImprovePlan` (`.ipm-veil`), `QuestionEditor` (`.ad-veil`), `TagFilter` popover. **Every dialog closes on Esc** (`keydown` listener in each) and on a click outside where it makes sense. The exam arena is the exception (Esc ends that test). Success/copy feedback that must not move the layout is a fixed bottom toast (`.ad-toast`), not inline text.

## Wording and tone
Plain language for a college student. Red 🔴 **CAUTION:** lines (a `.callout` or `.pi-err`) for anything destructive or that the user must not do. Errors say what is wrong and how to fix it; no apologies. Button names stay consistent through a flow. No exam-specific words.

## Rendering text (`components/Rich.tsx`, `lib/tex.ts`)
`Rich` splits text into plain, `$inline$`, `$$display$$`, ```code``` fences, `inline code`, and `![alt](img:…)` pictures. KaTeX CSS is imported in `app/layout.tsx`. Use `<Rich text={…} />` anywhere text may contain maths: question/option/explanation text, plan day titles and tasks, link notes, milestone notes, the day page. Editing text inputs (e.g. Edit plan) show raw source; only displayed text renders.

## Motion and accessibility
Reduced-motion is respected (`prefers-reduced-motion`, `lib/fx.ts`). Interactive icons need `aria-label`; dialogs use `role="dialog"`, `aria-modal`. Keep tap targets comfortable on phones; formulas should fit a phone width.

## Layout notes
Sidebar rail (`--rail: 96px`), `.shell` + `.page`. Dashboard top row (`.top-row`: greeting + quote) and compact runway are desktop-only rules (`@media (min-width:761px)`); calendar milestone labels truncate with ellipsis (`@media (min-width:561px)`). Planner cards use `.pl-focus` / `.pl-wrap`; the Prev/Today/Next row is `.pl-nav` (centred below the cards).
