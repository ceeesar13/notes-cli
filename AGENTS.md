# Notes CLI

A tiny command-line notes app in TypeScript: `node src/cli.ts add <text> | list | delete <id>`.
Node runs the TypeScript directly (type stripping), so there is no build step.
This page is the whole map: the repo is three files, so read them directly instead of searching.

## Code map
- `src/notes.ts`: the domain. `Note { id, text, created }`, `NotesError`, and pure functions
  (`addNote`, `deleteNote`, `formatList`) that take a `Note[]` and return a new value.
  Only `loadNotes`/`saveNotes` touch disk (`notes.json`, a JSON array).
- `src/cli.ts`: `run(argv, file, today): { code, out }`. It parses the command, calls `notes.ts`,
  and returns text plus exit code (0 ok, 1 `NotesError`, 2 usage). It holds no logic of its own.
  When you add a command, update `USAGE` and the header comment too.
- `test/notes.test.ts`: one file. Unit tests call the pure functions; CLI tests call
  `run([...], tmpFile(), DAY)` with the existing `tmpFile()` helper and the fixed date `DAY`.
  Add new `describe` blocks there; reuse the helpers, do not create new test files.

## Commands
- Test: the TEST_CMD in factory.conf (`npm test --silent`, vitest; must pass before any PR)
- Lint: the LINT_CMD in factory.conf (`npm run lint --silent`, the TypeScript type check)
- Try it: `NOTES_FILE=$(mktemp -d)/n.json node src/cli.ts list`. Never write to the repo's `notes.json`.

## Conventions
- TypeScript, strict. Relative imports end in `.ts`. Only erasable syntax (no enums, no namespaces,
  no parameter properties).
- Logic lives in `src/notes.ts` as pure functions; `src/cli.ts` only parses arguments and prints.
- Every behaviour change gets a vitest test in `test/`, written BEFORE the implementation.
  Assert the exact output string and exit code, as the issue states them.
- Keep functions under 30 lines.

## What must not change
- No new dependencies: `dependencies` in package.json is empty and package.json is protected.
  Use Node built-ins only. If an issue names a package that is not installed (for example a
  colour library), do not import it: implement the behaviour with built-ins (colours are plain
  ANSI escape codes such as `\x1b[32m` ... `\x1b[0m`) and say so in the plan's Assumptions.
- Stored data stays readable: notes already saved in `notes.json` must keep loading and printing.
  A new field on `Note` must be optional, and every function must handle notes without it.
- Existing commands, messages and outputs stay as they are unless the issue asks to change them.

## Factory rules
- Phase state lives in `.factory/` as markdown files. Never put plan or review text in code comments.
- Only the paths in SCOPE (factory.conf) may change. Do not touch factory.sh, lib/, gates/, .claude/, package.json or this file.
