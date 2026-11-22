---
name: handoff
description: Compact the current conversation into a handoff document (plus a TODO checklist) for another agent to pick up.
argument-hint: "What will the next session be used for? Add 'in pwd' to keep the files in the project folder."
disable-model-invocation: true
---

Write a handoff document summarising the current conversation so a fresh agent can continue the work, and a `TODO.md` checklist next to it. The two files always live together in the same folder.

## Where the files go

- **Default: the temporary directory** of the user's OS (`$TMPDIR`, else `/tmp`; `%TEMP%` on Windows), in a folder named after the project: `<temp>/handoff/<project-folder-name>/HANDOFF.md` and `<temp>/handoff/<project-folder-name>/TODO.md`. Create the folder if needed. Not the current workspace.
- **Option: the present working directory** (the workspace root): `HANDOFF.md` and `TODO.md` side by side there. Use this only when the user asks for it (for example "in pwd", "in the project", "keep them in the repo"), or when a `TODO.md` already exists in the workspace root (the project already chose this; keep using it, and put `HANDOFF.md` beside it, unless the project has its own handoff doc such as `docs/HANDOFF.md`, which you leave alone).
- Never split them: both go to the temp folder, or both go to the workspace root.
- At the end, tell the user the full absolute paths of both files.
- Mention the locations in the project documents: if the project has an agent-instructions file (`AGENTS.md` / `CLAUDE.md`), make sure it says where the handoff and TODO live (and how to switch). Add or fix that one line if it is missing or stale; do not rewrite anything else.

## HANDOFF.md

Include a "suggested skills" section, naming which skills the next agent should call the Skill tool for.

Do not duplicate content already captured in other artifacts (specs, plans, ADRs, issues, commits, diffs). Reference them by path or URL instead.

Redact any sensitive information, such as API keys, passwords, or personally identifiable information.

## TODO.md

A full checklist of the project's work, past and pending: one item per task, with completed work as `- [x]` and pending work as `- [ ]`. Group it under "Done" and "Pending" headings, with pending ordered by priority. Build the "Done" list from the whole project history you can see (this conversation, any existing handoff doc, git log), not only this session.

If a `TODO.md` already exists in the chosen folder, read it first and update it in place instead of overwriting it: keep every existing item, move items to "Done" when finished, and add new ones. Never drop completed items. If the default (temp) folder has none but the workspace root does, treat the workspace root as the chosen folder (see above). Keep each item to one line, and reference specs, plans and issues by path or URL instead of copying them. Apply the same redaction rules.

If the user passed arguments, treat them as a description of what the next session will focus on and tailor the documents accordingly.
