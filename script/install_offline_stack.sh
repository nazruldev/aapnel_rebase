#!/bin/bash
# Install default LAMP stack + Pure-FTPd + NVM/Node for offline fork.
# Requires network to node.aapanel.com (same as official aaPanel installers).
#
# Usage (as root):
#   bash /www/server/panel/script/install_offline_stack.sh
#
# Skip during bootstrap:
#   INSTALL_STACK=0 bash script/git_dev_bootstrap.sh ...

set -euo pipefail

PANEL="${PANEL:-/www/server/panel}"
INST="$PANEL/install"
TYPE="${INSTALL_SOFT_TYPE:-3}"
LOG="/tmp/offline_stack_install.log"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root."
  exit 1
fi

if [ ! -f "$INST/install_soft.sh" ]; then
  echo "ERROR: $INST/install_soft.sh not found."
  exit 1
fi

if [ -f /etc/os-release ]; then
  # shellcheck disable=SC1091
  . /etc/os-release
  if [ "${ID,,}" = "ubuntu" ] || [ "${ID,,}" = "debian" ]; then
    TYPE=3
  elif [ -f /usr/bin/yum ] || [ -f /usr/bin/dnf ]; then
    TYPE=0
  fi
fi

install_if_missing() {
  local check_path="$1"
  local name="$2"
  local version="$3"
  if [ -e "$check_path" ] || [ -f "$check_path" ]; then
    echo "  [skip] $name already present"
    return 0
  fi
  echo "  [install] $name ${version} ..."
  cd "$INST"
  if ! bash install_soft.sh "$TYPE" install "$name" "$version" >>"$LOG" 2>&1; then
    echo "  [warn] $name install failed — see $LOG"
    return 1
  fi
  echo "  [ok] $name"
}

install_nvm_node() {
  local nvm_dir="/www/server/nvm"
  if [ -s "$nvm_dir/nvm.sh" ] && command -v node >/dev/null 2>&1; then
    echo "  [skip] nvm/node already present"
    return 0
  fi
  echo "  [install] nvm + latest Node.js ..."
  mkdir -p "$nvm_dir"
  export NVM_DIR="$nvm_dir"
  if [ ! -s "$nvm_dir/nvm.sh" ]; then
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | NVM_DIR="$nvm_dir" bash >>"$LOG" 2>&1
  fi
  # shellcheck disable=SC1091
  . "$nvm_dir/nvm.sh"
  nvm install node >>"$LOG" 2>&1
  nvm alias default node >>"$LOG" 2>&1
  local node_bin npm_bin
  node_bin="$(command -v node || true)"
  npm_bin="$(command -v npm || true)"
  [ -n "$node_bin" ] && ln -sf "$node_bin" /usr/local/bin/node 2>/dev/null || true
  [ -n "$npm_bin" ] && ln -sf "$npm_bin" /usr/local/bin/npm 2>/dev/null || true
  echo "  [ok] node $(node -v 2>/dev/null || echo '?')"
}

echo "==> Installing default stack (log: $LOG)"
: >"$LOG"

install_if_missing /www/server/nginx/sbin/nginx nginx 126 || true
install_if_missing /www/server/mysql/bin/mysql mysql 80 || true
install_if_missing /www/server/pure-ftpd/bin/pure-pw pure-ftpd 1047 || true
install_if_missing /www/server/php/83/bin/php php 83 || true
install_if_missing /www/server/phpmyadmin/version.pl phpmyadmin 48 || true
install_nvm_node || true

echo "==> Default stack install pass complete."
echo "    Review $LOG for any warnings."
