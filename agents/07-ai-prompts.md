# 7. AI prompts the app produces

The app never calls an AI. It builds text the user pastes into any chat, then parses the reply. Each prompt below is a feature with a test in `scripts/check.ts`. When you change a format, update the prompt and the test.

| Prompt | Where | Built by | Reply expected |
|---|---|---|---|
| Write a question pack | Practice → Get a pack file → Copy AI prompt | `packPrompt(existing?)` (`lib/packs.ts`) | one JSON pack |
| Write a plan | Planner → Upload plan → Copy AI prompt | `aiPrompt(start)` (`lib/customPlan.ts`) | one JSON plan (mentions `description`, LaTeX backslash doubling) |
| Link questions to days (single prompt) | Planner → Link / Improve plan | `linkPrompt(plan, pack, opts, current)` (`lib/links.ts`) | `{ "days": [{date, practice[], mock?, note?}] }` |
| Link questions (two files) | same, when over 100,000 chars | `filesPrompt(improving)` + `planFile` + `bankFile` | same JSON reply |
| Help me do this day | Today agenda + planner cards | `dayHelpPrompt` (`lib/dayPrompt.ts`) | free text |
| Fix one question (OCR) | Question editor → Copy prompt | `editPrompt` (`lib/editPrompt.ts`) | one code block per field |
| Build setup for a programming question | Code question card | `setupPrompt` (`lib/setupPrompt.ts`) | a script |

## Shared rules (keep every prompt consistent)
- Ask for **only** the JSON (no fence, no commentary) when the reply is parsed by the app.
- LaTeX: in JSON replies every backslash is doubled; real dollar is `\\$`. In the edit-prompt (plain text boxes) backslashes are written **once**.
- Do not invent ids or dates: link prompts say "use only dates/ids that appear in the lists". The parser re-checks anyway.
- Include `plan.description` whenever plan info is included ("ABOUT MY PLAN (in my own words)").
- Prompts must be exam-agnostic.

## Edit prompt details (`lib/editPrompt.ts`)
Input is the editor's live state (type, text, options, picked, nat, str, code). The AI is told to read the whole question, fix OCR/typing artifacts, check the question is answerable and the marked answer is right (report doubts in NOTES, never change the marked answer silently), render-safe LaTeX/code rules, then reply with **exactly N code blocks** (outer fence is four backticks), in order: QUESTION, one `OPTION X` per option (mcq/msq), for code also SETUP, STARTER CODE, REFERENCE SOLUTION, then EXPLANATION, followed by NOTES. A `PICTURES` section lists pictures in reading order (`pictureList`); the editor shows **Copy picture N / Save** buttons because the clipboard cannot hold prompt text and pictures together. Only stored pictures (`img:…`) can be copied; web links are listed as links.

## Link prompt details
`RULES` in `lib/links.ts`: only known ids and dates; a question may repeat across days (revision) but never twice in a day; study days get questions matching topics/title aiming at `targetQs` (else ~3 per hour); easier first, harder later; weak topics get more; mock days get one mock test each (in order, at most once); exam and taper days get none. With existing links the prompt says "improve, do not start over; the reply replaces my current links".
