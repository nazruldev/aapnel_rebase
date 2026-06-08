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
DOWNLOAD_URL="${DOWNLOAD_URL:-https://node.aapanel.com}"
PANEL_ZIP_URL="${PANEL_ZIP_URL:-${DOWNLOAD_URL}/install/src/panel_7_en.zip}"
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

pyenv_python_bin() {
  for candidate in \
    "$PANEL/pyenv/bin/python3.12" \
    "$PANEL/pyenv/bin/python3" \
    "$PANEL/pyenv/bin/python"; do
    if [ -x "$candidate" ]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

detect_os_for_pyenv() {
  if [ ! -f /etc/os-release ]; then
    echo "ERROR: /etc/os-release not found."
    exit 1
  fi
  # shellcheck disable=SC1091
  . /etc/os-release
  case "${ID,,}" in
    ubuntu)
      os_type="ubuntu"
      os_version="${VERSION_ID%%.*}"
      ;;
    debian)
      os_type="debian"
      os_version="${VERSION_ID%%.*}"
      ;;
    *)
      echo "ERROR: Unsupported OS (${ID:-unknown}). Use Ubuntu 22+ or Debian 11+."
      exit 1
      ;;
  esac
  echo "Detected OS for pyenv: ${os_type}${os_version}"
}

detect_arch_for_pyenv() {
  case "$(uname -m)" in
    x86_64) echo "64" ;;
    aarch64) echo "aarch64" ;;
    *)
      echo "ERROR: Unsupported CPU architecture: $(uname -m)"
      exit 1
      ;;
  esac
}

install_pyenv() {
  if pyenv_python_bin >/dev/null 2>&1; then
    echo "==> pyenv already present, skip download"
    return
  fi

  detect_os_for_pyenv
  local os_type os_version arch pyenv_file pyenv_url
  # shellcheck disable=SC1091
  . /etc/os-release
  case "${ID,,}" in
    ubuntu) os_type="ubuntu"; os_version="${VERSION_ID%%.*}" ;;
    debian) os_type="debian"; os_version="${VERSION_ID%%.*}" ;;
  esac
  arch="$(detect_arch_for_pyenv)"
  pyenv_file="/www/pyenv.tar.gz"
  pyenv_url="${DOWNLOAD_URL}/install/pyenv/3.12/pyenv-${os_type}${os_version}-x${arch}-3.12.tar.gz"

  echo "==> Download Python runtime (pyenv) — one time only"
  echo "    URL: $pyenv_url"
  mkdir -p "$PANEL"
  if ! wget --no-check-certificate -O "$pyenv_file" "$pyenv_url" -t 3 -T 120; then
    echo "ERROR: Failed to download pyenv for ${os_type}${os_version}."
    echo "Try official installer once: curl -ksSO https://www.aapanel.com/script/install_6.0_en.sh && bash install_6.0_en.sh"
    exit 1
  fi

  local tmp_size
  tmp_size=$(du -b "$pyenv_file" | awk '{print $1}')
  if [ "$tmp_size" -lt 100000000 ]; then
    echo "ERROR: pyenv download too small (${tmp_size} bytes)."
    rm -f "$pyenv_file"
    exit 1
  fi

  tar zxf "$pyenv_file" -C "$PANEL/"
  rm -f "$pyenv_file"
  chmod -R 700 "$PANEL/pyenv/bin" 2>/dev/null || true

  if [ -x "$PANEL/pyenv/bin/python3.12" ] && [ ! -x "$PANEL/pyenv/bin/python" ]; then
    ln -sf "$PANEL/pyenv/bin/python3.12" "$PANEL/pyenv/bin/python"
  fi
  if [ -x "$PANEL/pyenv/bin/pip3.12" ] && [ ! -x "$PANEL/pyenv/bin/pip" ]; then
    ln -sf "$PANEL/pyenv/bin/pip3.12" "$PANEL/pyenv/bin/pip"
  fi

  if ! pyenv_python_bin >/dev/null 2>&1; then
    echo "ERROR: pyenv not found after install."
    exit 1
  fi

  echo "==> pyenv OK: $(pyenv_python_bin) -V"
}

ensure_panel_runtime_assets() {
  local need_zip=0
  mkdir -p "$PANEL/data" "$PANEL/class"

  if [ ! -f "$PANEL/data/default.db" ]; then
    need_zip=1
  fi
  if ! compgen -G "$PANEL/class/PluginLoader*.so" >/dev/null && \
     ! compgen -G "$PANEL/class/public/PluginLoader*.so" >/dev/null; then
    need_zip=1
  fi

  if [ "$need_zip" -eq 0 ]; then
    echo "==> Panel runtime assets already present (default.db + PluginLoader)"
    return
  fi

  echo "==> Download official panel zip for default.db / PluginLoader — one time only"
  local tmp_zip tmp_dir
  tmp_zip="/tmp/aapanel_panel_runtime.zip"
  tmp_dir="/tmp/aapanel_panel_extract"
  rm -rf "$tmp_dir"
  wget --no-check-certificate -O "$tmp_zip" "$PANEL_ZIP_URL" -t 3 -T 120
  unzip -o "$tmp_zip" -d "$tmp_dir" >/dev/null

  local src_panel=""
  if [ -d "$tmp_dir/panel" ]; then
    src_panel="$tmp_dir/panel"
  elif [ -d "$tmp_dir/server/panel" ]; then
    src_panel="$tmp_dir/server/panel"
  else
    src_panel="$tmp_dir"
  fi

  if [ ! -f "$PANEL/data/default.db" ] && [ -f "$src_panel/data/default.db" ]; then
    cp -a "$src_panel/data/default.db" "$PANEL/data/default.db"
    echo "==> Copied default.db"
  fi
  if [ ! -f "$PANEL/data/system.db" ] && [ -f "$src_panel/data/system.db" ]; then
    cp -a "$src_panel/data/system.db" "$PANEL/data/system.db"
  fi

  while IFS= read -r so_file; do
    rel="${so_file#"$src_panel/"}"
    dest="$PANEL/$rel"
    mkdir -p "$(dirname "$dest")"
    if [ ! -f "$dest" ]; then
      cp -a "$so_file" "$dest"
    fi
  done < <(find "$src_panel" -name 'PluginLoader*.so' 2>/dev/null)

  rm -rf "$tmp_dir" "$tmp_zip"

  if [ ! -f "$PANEL/data/default.db" ]; then
    echo "ERROR: default.db still missing after panel zip extract."
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
  local py_bin
  py_bin="$(pyenv_python_bin)"
  "$py_bin" -m pip install -U pip setuptools wheel
  "$py_bin" -m pip install -r "$PANEL/requirements.txt"
}

setup_service() {
  echo "==> Register bt service"
  local py_bin
  py_bin="$(pyenv_python_bin)"
  chmod +x "$PANEL/BT-Panel" "$PANEL/BT-Task" "$PANEL/init.sh"
  sed -i "1s|^#!.*|#!${py_bin}|" "$PANEL/BT-Panel" "$PANEL/BT-Task"
  cp -f "$PANEL/init.sh" /etc/init.d/bt
  chmod +x /etc/init.d/bt
  if command -v update-rc.d >/dev/null 2>&1; then
    update-rc.d bt defaults >/dev/null 2>&1 || true
  elif command -v chkconfig >/dev/null 2>&1; then
    chkconfig --add bt >/dev/null 2>&1 || true
  fi
  ln -sf /etc/init.d/bt /usr/bin/bt 2>/dev/null || true
}

clone_or_pull() {
  if [ -d "$PANEL/.git" ]; then
    echo "==> git pull in $PANEL"
    git -C "$PANEL" fetch origin
    git -C "$PANEL" checkout "$GIT_BRANCH"
    git -C "$PANEL" pull origin "$GIT_BRANCH"
    return
  fi

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
  echo " URL        : http://YOUR_VPS_IP:${port}/login"
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
mkdir -p /www/server /www/wwwroot /www/wwwlogs /www/backup/database /www/backup/site "$PANEL"

clone_or_pull
install_pyenv
ensure_panel_runtime_assets
ensure_data_files
ensure_offline_config
install_python_deps
setup_service

/etc/init.d/bt stop >/dev/null 2>&1 || true
/etc/init.d/bt start

install_default_stack() {
  if [ "${INSTALL_STACK:-1}" != "1" ]; then
    echo "==> Skip default stack (INSTALL_STACK=0)"
    return 0
  fi
  if [ -f "$PANEL/script/install_offline_stack.sh" ]; then
    echo "==> Default stack: nginx, mysql, php, pure-ftpd, phpmyadmin, nvm/node"
    bash "$PANEL/script/install_offline_stack.sh" || echo "WARN: stack install had errors — see /tmp/offline_stack_install.log"
  fi
}
install_default_stack

open_firewall_hint
