#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Install built-in plugins (e.g. bt_agent AI Assistant) and ensure list.json entries."""
import os
import sys

os.chdir('/www/server/panel')
if '/www/server/panel/class' not in sys.path:
    sys.path.insert(0, '/www/server/panel/class')

import builtin_plugins


def main():
    builtin_plugins.ensure_all()
    status = builtin_plugins.get_public_status()
    for name, info in status.items():
        flag = 'ok' if info.get('installed') else 'missing'
        en = 'on' if info.get('enabled') else 'off'
        print('  [{}] {} installed={} ui={}'.format(flag, name, info.get('installed'), en))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
