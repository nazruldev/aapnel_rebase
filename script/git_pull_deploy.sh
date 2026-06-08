#!/bin/bash
# Deploy panel from git + reset default login + restart.
# Usage: bash /www/server/panel/script/git_pull_deploy.sh [branch]
set -euo pipefail

PANEL="${BT_PANEL:-/www/server/panel}"
BRANCH="${1:-master}"

cd "$PANEL"
echo "==> git fetch origin $BRANCH"
git fetch origin "$BRANCH"
echo "==> git reset --hard origin/$BRANCH"
git reset --hard "origin/$BRANCH"

PY="$PANEL/pyenv/bin/python3"
[ -x "$PY" ] || PY="python3"

echo "==> reset panel login (config/default_login.json)"
"$PY" "$PANEL/script/apply_default_login.py"

echo "==> restart panel"
/etc/init.d/bt restart

echo "==> reset panel login again (after restart)"
"$PY" "$PANEL/script/apply_default_login.py"

echo "==> Done. Login: bt 14  or  bt reset_login"
