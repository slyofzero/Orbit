---
name: smart-commit
description: Analyzes git diffs and recent conversation context to generate a comprehensive, well-structured git commit message. Trigger when the user asks to "make a commit" or "commit changes".
---

# Smart Commit

This skill creates high-quality, context-aware git commits by combining technical diff
analysis with the narrative context of the current conversation.

## Workflow

### 0. Mandatory Gate — Confirm `.agent/github/COMMITS.md` Exists

Check for `.agent/github/COMMITS.md` in the current repo.

- **If it exists**: its rules are mandatory and override everything in Step 2 below — do not
  blend them with the generic default. Proceed to Step 1.
- **If it does not exist**: 🔴 STOP. Do not commit using a generic default. Draft a proposed
  `COMMITS.md` (a reasonable commit-standards doc: subject line format, allowed types, body
  formatting, footer convention), present it to the user, and only save it to
  `.agent/github/COMMITS.md` after explicit approval. Only after the doc exists do you proceed
  to Step 1 — this is a one-time bootstrap per repo, not something to repeat on every commit.

### 1. Gather Context

You must understand what changed and *why* it changed.
- **Git Status**: `git status` to see what is staged vs unstaged.
- **Git Diff**: `git diff --cached` (if staged) or `git diff` to view the exact code changes.
- **Git Log**: `git log -1` to see the immediate predecessor commit.
- **Conversation Context**: reflect on what was just done in the chat. The diff tells you
  *what* changed; the conversation tells you *why* (a bug fix, a requested feature, a planned
  architecture step).

### 2. Draft the Commit Message (generic default — only used if no `COMMITS.md` exists, per Step 0)

- **Subject Line**: Conventional Commits style (`type(scope): description`), imperative mood,
  under 72 characters. Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`,
  `style`, `build`, `ci`.
- **Body**: bullet points, grouped logically, explaining the *why* alongside the *what* — not
  just a restatement of the diff.

```text
feat(agentic): introduce indexeddb persistence and terminal ui overhaul

- Persistence: added IndexedDB support (indexedDB.ts) for saving live scan data every 5s.
- Terminal UI: introduced specialized React components for log streams to improve readability.
- Tool Reliability: patched tool_executor.py to ensure permanent tool failures bubble up to
  the frontend UI.
```

### 3. Mandatory Plan Proposal — Seek User Approval

Present the drafted commit message clearly, built strictly from `COMMITS.md`'s rules (or the
generic default only if Step 0 found no doc). This step is required for every commit, every
time — never skip straight from Step 1/2 to Step 4.

🔴 **Do not run `git commit` without explicit approval of this exact drafted message.**

### 4. Execute

Once approved, run the commit using multiple `-m` flags:
```bash
git commit -m "subject line" -m "- bullet 1" -m "- bullet 2"
```
(Alternatively, write the message to a temp file and use `git commit -F <file>` for longer,
multi-section bodies — preferred when following `COMMITS.md`'s footer section, since footers
are easy to mangle across multiple `-m` flags.)