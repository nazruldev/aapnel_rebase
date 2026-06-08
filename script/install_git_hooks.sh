#!/bin/bash
# Install git hooks for this panel fork (login reset after pull).
set -euo pipefail

PANEL="${BT_PANEL:-/www/server/panel}"
cd "$PANEL"

if [ ! -d .git ]; then
  echo "ERROR: $PANEL is not a git repository"
  exit 1
fi

HOOK_SRC="$PANEL/script/githooks/post-checkout"
HOOK_DST="$PANEL/.git/hooks/post-checkout"

if [ ! -f "$HOOK_SRC" ]; then
  echo "ERROR: missing $HOOK_SRC"
  exit 1
fi

cp "$HOOK_SRC" "$HOOK_DST"
chmod +x "$HOOK_DST"
echo "Installed: $HOOK_DST"
echo "After git pull / reset --hard, login resets per config/default_login.json"
