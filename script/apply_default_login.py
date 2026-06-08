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
    public.writeFile(default_pl, password)
    try:
        os.chmod(default_pl, 0o600)
    except Exception:
        pass

    if not quiet:
        print('Panel login reset: username={} password={}'.format(username, password))
    return 0


def main():
    quiet = '--quiet' in sys.argv or '-q' in sys.argv
    return apply_default_login(quiet=quiet)


if __name__ == '__main__':
    raise SystemExit(main())
