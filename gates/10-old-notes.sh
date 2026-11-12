#!/usr/bin/env bash
# Notes saved before this change (plain id/text/created, no new fields) must still list and accept
# new notes exactly as before. Colour codes are stripped before comparing, so styling may change.
set -u
dir="$(mktemp -d)"
trap 'rm -rf "$dir"' EXIT
file="$dir/notes.json"
printf '%s\n' '[{"id":1,"text":"comprar leche","created":"2026-11-01"},{"id":3,"text":"repasar la charla","created":"2026-11-02"}]' >"$file"
plain() { NOTES_FILE="$file" node src/cli.ts "$@" 2>&1 | sed $'s/\x1b\\[[0-9;]*m//g'; }

want=$'1. comprar leche (2026-11-01)\n3. repasar la charla (2026-11-02)'
got="$(plain list)"
if [ "$got" != "$want" ]; then
  printf 'Old notes no longer list the same way.\nExpected:\n%s\nGot:\n%s\n' "$want" "$got"
  exit 1
fi
got="$(plain add "nota nueva")"
if [ "$got" != "Added note 4." ]; then
  printf 'Adding to an old notes file broke.\nExpected: Added note 4.\nGot: %s\n' "$got"
  exit 1
fi
echo "Old notes still work."
