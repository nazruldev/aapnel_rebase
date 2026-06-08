#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Reset panel admin username/password from config/default_login.json."""
from __future__ import print_function

import json
import os
import sys

PANEL = os.environ.get('BT_PANEL', '/www/server/panel')
if os.path.isdir(PANEL):
    os.chdir(PANEL)
if PANEL not in sys.path:
    sys.path.insert(0, PANEL)
sys.path.insert(0, os.path.join(PANEL, 'class'))

import public  # noqa: E402


def load_config():
    path = '{}/config/default_login.json'.format(public.get_panel_path())
    if not os.path.isfile(path):
        return None
    try:
        data = json.loads(public.readFile(path))
        return data if isinstance(data, dict) else None
    except Exception:
        return None


def apply_default_login(quiet=False):
    cfg = load_config()
    if not cfg or not cfg.get('enabled', True):
        if not quiet:
            print('Default login reset disabled (config/default_login.json).')
        return 0

    username = str(cfg.get('username') or 'srvadmin').strip()
    password = str(cfg.get('password') or 'admin123').strip()
    if len(username) < 3:
        print('ERROR: username too short in default_login.json')
        return 1
    if not password:
        print('ERROR: empty password in default_login.json')
        return 1

    import db
    sql = db.Sql()
    sql.table('users').where('id=?', (1,)).setField('username', username)
    sql.table('users').where('id=?', (1,)).setField(
        'password', public.password_salt(public.md5(password), uid=1))

    panel_path = public.get_panel_path()
    default_pl = '{}/default.pl'.format(panel_path)
    user_pl = '{}/data/default_user.pl'.format(panel_path)
    try:
        public.ExecShell('chattr -i {} 2>/dev/null'.format(default_pl))
    except Exception:
        pass
    public.writeFile(default_pl, password)
    public.writeFile(user_pl, username)
    try:
        os.chmod(default_pl, 0o600)
        os.chmod(user_pl, 0o600)
    except Exception:
        pass

    if not quiet:
        print('Panel login reset: username={} password={}'.format(username, password))
    return 0


def show_login_info():
    """Print panel login for bt 14 / bt default — apply config first, never randomize."""
    apply_default_login(quiet=True)
    cfg = load_config() or {}
    username = cfg.get('username') or 'srvadmin'
    password = cfg.get('password') or 'admin123'

    panel_path = public.get_panel_path()
    user_pl = '{}/data/default_user.pl'.format(panel_path)
    if os.path.isfile(user_pl):
        try:
            username = (public.readFile(user_pl) or username).strip() or username
        except Exception:
            pass

    try:
        import db
        sql = db.Sql()
        db_user = sql.table('users').where('id=?', (1,)).getField('username')
        if db_user:
            username = db_user
    except Exception:
        pass

    default_pl = '{}/default.pl'.format(panel_path)
    if os.path.isfile(default_pl):
        try:
            pl_pass = (public.readFile(default_pl) or '').strip()
            if pl_pass and pl_pass != '********':
                password = pl_pass
        except Exception:
            pass

    print('username: {}'.format(username))
    print('password: {}'.format(password))
    return 0


def main():
    if '--show' in sys.argv or 'show' in sys.argv:
        return show_login_info()
    quiet = '--quiet' in sys.argv or '-q' in sys.argv
    return apply_default_login(quiet=quiet)


if __name__ == '__main__':
    raise SystemExit(main())
