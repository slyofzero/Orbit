# Commit standards

- **Subject:** one line, imperative mood, capital first letter, no full stop, 72 characters or fewer.
  It says what the commit adds or changes, e.g. "Add practice page shell and onboarding".
- **Body (optional):** a blank line, then short bullets grouped by area. Each bullet says the
  reason as well as the change. Skip the body for small commits.
- **One topic per commit.** Don't mix a refactor with a feature when they can be split.
- **Checks first:** `bunx tsc --noEmit`, `bun run check` (prints ALL OK) and
  `bun run format:check` must pass before committing.
- **Never commit:** `.env` files, `temp/`, or anything with secrets.
- **Footer:** `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`
