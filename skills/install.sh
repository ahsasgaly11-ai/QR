#!/usr/bin/env sh
# Install the skills in this directory as personal skills (available in every project).
#
#   sh skills/install.sh            # -> ~/.claude/skills/
#   TARGET=~/.agents/skills sh skills/install.sh   # cross-runtime location
#
# Re-running overwrites the installed copy, so this doubles as "update".
set -eu

SRC="$(cd "$(dirname "$0")" && pwd)"
TARGET="${TARGET:-$HOME/.claude/skills}"

mkdir -p "$TARGET"
for skill in "$SRC"/*/; do
  name="$(basename "$skill")"
  [ -f "$skill/SKILL.md" ] || continue
  rm -rf "$TARGET/$name"
  cp -R "$skill" "$TARGET/$name"
  echo "installed: $name -> $TARGET/$name"
done
