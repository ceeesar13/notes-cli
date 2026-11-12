#!/usr/bin/env bash
# Only src/cli.ts prints. Fails when the change adds console.log anywhere else in src/.
set -u
git add -N src 2>/dev/null || true  # make new files visible to git diff, as factory.sh does
bad="$(git diff -U0 "$FACTORY_BASE" -- src ':(exclude)src/cli.ts' | grep -v '^+++' | grep -E '^\+.*console\.log' || true)"
if [ -n "$bad" ]; then
  echo "console.log added outside src/cli.ts (logic in src/notes.ts must return values, not print):"
  echo "$bad"
  exit 1
fi
echo "No console.log outside src/cli.ts."
