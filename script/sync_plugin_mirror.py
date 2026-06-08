#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Sync free aaPanel plugins from node.aapanel.com into local mirror.

Usage (on VPS, as root):
  cd /www/server/panel
  pyenv/bin/python script/sync_plugin_mirror.py --list
  pyenv/bin/python script/sync_plugin_mirror.py --sync-all
  pyenv/bin/python script/sync_plugin_mirror.py --sync docker,pm2,redis
  pyenv/bin/python script/sync_plugin_mirror.py --install docker
"""
import argparse
import os
import sys

PANEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PANEL not in sys.path:
    sys.path.insert(0, PANEL)
os.chdir(PANEL)
sys.path.insert(0, os.path.join(PANEL, 'class'))

import offline_plugin_mirror as mirror  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description='Sync free aaPanel plugins to local mirror')
    parser.add_argument('--list', action='store_true', help='List free mirrorable plugins')
    parser.add_argument('--refresh', action='store_true', help='Refresh catalog from cloud')
    parser.add_argument('--sync-all', action='store_true', help='Download all free plugins not yet mirrored')
    parser.add_argument('--sync', metavar='NAMES', help='Comma-separated plugin names to download')
    parser.add_argument('--install', metavar='NAME', help='Install one plugin from local mirror')
    args = parser.parse_args()

    if args.list or (not args.sync_all and not args.sync and not args.install):
        cat = mirror.list_catalog(refresh=args.refresh or args.sync_all)
        if not cat.get('ok'):
            print('ERROR:', cat.get('error'))
            sys.exit(1)
        print('Free plugins (mirrorable): {} total, {} cached\n'.format(cat['total'], cat['mirrored']))
        for item in cat['items']:
            flag = '[cached]' if item['mirrored'] else '[     ]'
            setup = ' installed' if item.get('setup') else ''
            print('  {} {} v{} {}{}'.format(flag, item['name'], item['version'], item['title'], setup))
        return

    if args.sync_all:
        result = mirror.sync_plugins(sync_all_free=True)
    elif args.sync:
        result = mirror.sync_plugins(names=args.sync)
    elif args.install:
        result = mirror.install_from_mirror(args.install)
        print(result)
        sys.exit(0 if isinstance(result, dict) and result.get('status') else 1)
    else:
        parser.print_help()
        return

    if isinstance(result, dict):
        msg = result.get('message', result)
        print(msg)
        if result.get('status') not in (0, True):
            sys.exit(1)


if __name__ == '__main__':
    main()
