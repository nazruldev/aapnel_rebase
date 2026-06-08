#!/bin/bash
# Bootstrap aaPanel from GitHub for local development (offline/custom fork).
# Run as root on Ubuntu 22/24 or Debian 11/12.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/YOUR_USER/aaPanel/main/script/git_dev_bootstrap.sh | bash -s -- \
#     https://github.com/YOUR_USER/aaPanel.git main
#
# Or on the VPS after git clone:
#   bash /www/server/panel/script/git_dev_bootstrap.sh https://github.com/YOUR_USER/aaPanel.git main

set -euo pipefail

GIT_REPO="${1:-}"
GIT_BRANCH="${2:-main}"
PANEL="/www/server/panel"
PANEL_ZIP_URL="${PANEL_ZIP_URL:-https://node.aapanel.com/install/src/panel_7_en.zip}"
BACKUP="/www/server/panel_runtime_backup"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo bash $0 <git-repo-url> [branch]"
  exit 1
fi

if [ -z "$GIT_REPO" ]; then
  echo "Usage: bash $0 <git-repo-url> [branch]"
  echo "Example: bash $0 https://github.com/you/aaPanel.git main"
  exit 1
fi

echo "==> Install base packages"
export DEBIAN_FRONTEND=noninteractive
if command -v apt-get >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y git wget unzip curl ca-certificates build-essential \
    libssl-dev libffi-dev libxml2-dev libjpeg-dev zlib1g-dev
elif command -v dnf >/dev/null 2>&1; then
  dnf install -y git wget unzip curl ca-certificates gcc openssl-devel \
    libffi-devel libxml2-devel libjpeg-turbo-devel zlib-devel
else
  echo "Unsupported OS. Use Ubuntu 22+ or Debian 11+."
  exit 1
fi

echo "==> Create /www layout"
mkdir -p /www/server /www/wwwroot /www/wwwlogs /www/backup/database /www/backup/site

bootstrap_runtime() {
  if [ -x "$PANEL/pyenv/bin/python3" ] && [ -f "$PANEL/data/default.db" ]; then
    echo "==> Runtime already present (pyenv + default.db), skip zip bootstrap"
    return
  fi
  echo "==> Download official panel runtime (pyenv, PluginLoader, default.db) — one time only"
  tmp_zip="/tmp/aapanel_panel_runtime.zip"
  wget --no-check-certificate -O "$tmp_zip" "$PANEL_ZIP_URL" -t 3 -T 60
  unzip -o "$tmp_zip" -d /www/server/ >/dev/null
  rm -f "$tmp_zip"
  if [ ! -x "$PANEL/pyenv/bin/python3" ]; then
    echo "ERROR: pyenv not found after bootstrap."
    exit 1
  fi
}

preserve_runtime() {
  rm -rf "$BACKUP"
  mkdir -p "$BACKUP"
  for item in pyenv data logs plugin vhost ssl install; do
    if [ -e "$PANEL/$item" ]; then
      cp -a "$PANEL/$item" "$BACKUP/"
    fi
  done
}

restore_runtime() {
  for item in pyenv data logs plugin vhost ssl install; do
    if [ -e "$BACKUP/$item" ]; then
      rm -rf "$PANEL/$item"
      cp -a "$BACKUP/$item" "$PANEL/"
    fi
  done
}

ensure_offline_config() {
  python3 - <<'PY'
import json, os
path = "/www/server/panel/config/config.json"
if not os.path.exists(path):
    raise SystemExit("config.json missing")
with open(path, "r", encoding="utf-8") as f:
    cfg = json.load(f)
cfg["offline_mode"] = True
with open(path, "w", encoding="utf-8") as f:
    json.dump(cfg, f, ensure_ascii=False)
print("offline_mode=true set in config.json")
PY
}

ensure_data_files() {
  mkdir -p "$PANEL/data" "$PANEL/logs"
  [ -f "$PANEL/data/port.pl" ] || echo "8888" > "$PANEL/data/port.pl"
  [ -f "$PANEL/data/admin_path.pl" ] || echo "/login" > "$PANEL/data/admin_path.pl"
}

install_python_deps() {
  echo "==> Install Python dependencies"
  "$PANEL/pyenv/bin/pip" install -U pip setuptools wheel
  "$PANEL/pyenv/bin/pip" install -r "$PANEL/requirements.txt"
}

setup_service() {
  echo "==> Register bt service"
  chmod +x "$PANEL/BT-Panel" "$PANEL/BT-Task" "$PANEL/init.sh"
  sed -i "1s|^#!.*|#!$PANEL/pyenv/bin/python|" "$PANEL/BT-Panel" "$PANEL/BT-Task"
  cp -f "$PANEL/init.sh" /etc/init.d/bt
  chmod +x /etc/init.d/bt
  if command -v update-rc.d >/dev/null 2>&1; then
    update-rc.d bt defaults >/dev/null 2>&1 || true
  elif command -v chkconfig >/dev/null 2>&1; then
    chkconfig --add bt >/dev/null 2>&1 || true
  fi
}

clone_or_pull() {
  if [ -d "$PANEL/.git" ]; then
    echo "==> git pull in $PANEL"
    git -C "$PANEL" fetch origin
    git -C "$PANEL" checkout "$GIT_BRANCH"
    git -C "$PANEL" pull origin "$GIT_BRANCH"
    return
  fi

  bootstrap_runtime

  if [ -d "$PANEL" ] && [ "$(ls -A "$PANEL" 2>/dev/null)" ]; then
    preserve_runtime
    rm -rf "$PANEL"
  fi

  echo "==> git clone $GIT_REPO ($GIT_BRANCH)"
  git clone --branch "$GIT_BRANCH" --depth 1 "$GIT_REPO" "$PANEL"
  restore_runtime
}

open_firewall_hint() {
  port="$(cat "$PANEL/data/port.pl" 2>/dev/null || echo 8888)"
  echo ""
  echo "=============================================="
  echo " Panel path : $PANEL"
  echo " Port       : $port"
  echo " URL        : https://YOUR_VPS_IP:${port}/login"
  echo ""
  echo " Default login (if fresh default.db):"
  echo "   user: aapanel   pass: aapanel  (change via: bt default)"
  echo ""
  echo " Daily workflow on VPS:"
  echo "   cd $PANEL && git pull && /etc/init.d/bt restart"
  echo ""
  echo " Open firewall if needed:"
  echo "   ufw allow ${port}/tcp"
  echo "=============================================="
}

bootstrap_runtime
clone_or_pull
ensure_data_files
ensure_offline_config
install_python_deps
setup_service

/etc/init.d/bt stop >/dev/null 2>&1 || true
/etc/init.d/bt start

open_firewall_hint
