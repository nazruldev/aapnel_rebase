#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Interactive plugin mirror tools (offline fork).
Used by: bt 34  |  bt plugin [subcommand]

Subcommands:
  list | sync-all | sync NAME[,NAME] | install NAME
  export [path.tgz] | import path.tgz | install-all
"""
from __future__ import print_function

import argparse
import os
import sys
import tarfile
import time

PANEL = os.environ.get('BT_PANEL', '/www/server/panel')
if not os.path.isdir(PANEL):
    PANEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

os.chdir(PANEL)
if PANEL not in sys.path:
    sys.path.insert(0, PANEL)
sys.path.insert(0, os.path.join(PANEL, 'class'))

try:
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
except Exception:
    pass

import offline_plugin_mirror as mirror  # noqa: E402

if sys.version_info[0] == 3:
    raw_input = input

DEFAULT_EXPORT = '/www/backup/aapanel-plugins-pack-{}.tgz'.format(
    time.strftime('%Y%m%d-%H%M%S'))


def _bar():
    print('=' * 52)


def _pause():
    try:
        raw_input('\nPress Enter to continue...')
    except (EOFError, KeyboardInterrupt):
        print('')


def _print_catalog(refresh=False):
    cat = mirror.list_catalog(refresh=refresh)
    if not cat.get('ok'):
        print('ERROR:', cat.get('error'))
        return False
    print('Free mirrorable plugins: {} total, {} cached\n'.format(
        cat['total'], cat['mirrored']))
    for item in cat['items']:
        flag = '[cached]' if item['mirrored'] else '[     ]'
        setup = ' installed' if item.get('setup') else ''
        print('  {} {} v{} {}{}'.format(
            flag, item['name'], item['version'], item['title'], setup))
    return True


def _print_sync_result(result):
    if not isinstance(result, dict):
        print(result)
        return
    msg = result.get('message', result)
    if isinstance(msg, dict):
        print('Synced: {}, Failed: {}'.format(msg.get('synced', 0), msg.get('failed', 0)))
        for row in msg.get('results', []):
            st = 'OK' if row.get('status') else 'FAIL'
            print('  [{}] {} — {}'.format(st, row.get('name'), row.get('msg')))
    else:
        print(msg)


def cmd_list(refresh=False):
    _bar()
    print('Plugin mirror — list')
    _bar()
    _print_catalog(refresh=refresh)


def cmd_sync_all():
    _bar()
    print('Downloading all free plugins to local cache...')
    _bar()
    _print_sync_result(mirror.sync_plugins(sync_all_free=True))


def cmd_sync(names):
    _bar()
    print('Sync plugins:', ', '.join(names))
    _bar()
    _print_sync_result(mirror.sync_plugins(names=names))


def cmd_install(name):
    _bar()
    print('Install from mirror:', name)
    _bar()
    result = mirror.install_from_mirror(name)
    print(result.get('msg') if isinstance(result, dict) else result)
    return isinstance(result, dict) and result.get('status') is True


def cmd_install_all():
    manifest = mirror.load_manifest()
    names = sorted(manifest.get('plugins', {}).keys())
    if not names:
        print('No plugins in local mirror. Run sync first (option 2).')
        return
    ok = fail = 0
    _bar()
    print('Install all cached plugins ({})...'.format(len(names)))
    _bar()
    for name in names:
        if not mirror.has_mirror(name):
            print('  [skip] {} — zip missing'.format(name))
            fail += 1
            continue
        print('  [install] {}...'.format(name), end=' ')
        sys.stdout.flush()
        result = mirror.install_from_mirror(name)
        if isinstance(result, dict) and result.get('status') is True:
            print('OK')
            ok += 1
        else:
            msg = result.get('msg') if isinstance(result, dict) else str(result)
            print('FAIL — {}'.format(msg))
            fail += 1
    print('\nDone: {} ok, {} failed/skipped'.format(ok, fail))


def cmd_export(path=None):
    path = path or DEFAULT_EXPORT
    path = os.path.abspath(path)
    parent = os.path.dirname(path)
    if parent and not os.path.exists(parent):
        os.makedirs(parent, mode=0o755)

    include_plugin = raw_input('Include installed plugin/ folders? [Y/n]: ').strip().lower()
    with_plugins = include_plugin not in ('n', 'no')

    _bar()
    print('Creating pack:', path)
    _bar()

    with tarfile.open(path, 'w:gz') as tar:
        mirror_root = mirror.mirror_root()
        if os.path.isdir(mirror_root):
            tar.add(mirror_root, arcname='data/plugin_mirror')

        bin_pl = os.path.join(PANEL, 'data/plugin_bin.pl')
        if os.path.isfile(bin_pl):
            tar.add(bin_pl, arcname='data/plugin_bin.pl')

        if with_plugins:
            plugin_dir = os.path.join(PANEL, 'plugin')
            if os.path.isdir(plugin_dir):
                for name in os.listdir(plugin_dir):
                    full = os.path.join(plugin_dir, name)
                    if os.path.isdir(full):
                        tar.add(full, arcname='plugin/{}'.format(name))

    size_mb = os.path.getsize(path) / (1024 * 1024)
    print('Export OK ({:.1f} MB)'.format(size_mb))
    print('Copy to offline server, then: bt plugin import {}'.format(path))


def cmd_import(path):
    path = os.path.abspath(path)
    if not os.path.isfile(path):
        print('ERROR: file not found:', path)
        return False

    _bar()
    print('Import pack:', path)
    _bar()

    with tarfile.open(path, 'r:gz') as tar:
        tar.extractall(PANEL)

    print('Extracted to', PANEL)

    do_install = raw_input('Install all plugins from mirror cache now? [Y/n]: ').strip().lower()
    if do_install not in ('n', 'no'):
        cmd_install_all()
    return True


def show_menu():
    while True:
        _bar()
        print('Plugin mirror (offline) — aaPanel fork')
        _bar()
        print('  (1) List mirrorable plugins')
        print('  (2) Sync ALL free plugins (download to cache)')
        print('  (3) Sync selected plugins (comma-separated names)')
        print('  (4) Install one plugin from local cache')
        print('  (5) Install ALL plugins from local cache')
        print('  (6) Export pack (.tgz) for other servers')
        print('  (7) Import pack (.tgz) from another server')
        print('  (0) Back')
        _bar()
        try:
            choice = raw_input('Select option [0-7]: ').strip()
        except (EOFError, KeyboardInterrupt):
            print('')
            return
        if choice in ('0', ''):
            return
        if choice == '1':
            cmd_list(refresh=False)
            _pause()
        elif choice == '2':
            cmd_sync_all()
            _pause()
        elif choice == '3':
            names = raw_input('Plugin names (e.g. docker,pm2,redis): ').strip()
            if names:
                cmd_sync([n.strip() for n in names.split(',') if n.strip()])
            _pause()
        elif choice == '4':
            name = raw_input('Plugin name: ').strip()
            if name:
                cmd_install(name)
            _pause()
        elif choice == '5':
            cmd_install_all()
            _pause()
        elif choice == '6':
            out = raw_input('Export path [{}]: '.format(DEFAULT_EXPORT)).strip()
            cmd_export(out or None)
            _pause()
        elif choice == '7':
            src = raw_input('Path to .tgz pack: ').strip()
            if src:
                cmd_import(src)
            _pause()
        else:
            print('Invalid option')
            _pause()


def main(argv=None):
    parser = argparse.ArgumentParser(description='Plugin mirror CLI')
    parser.add_argument('command', nargs='?', default='menu',
                        choices=['menu', 'list', 'sync-all', 'sync', 'install',
                                 'install-all', 'export', 'import'])
    parser.add_argument('arg', nargs='?', default='')
    parser.add_argument('--refresh', action='store_true')
    args = parser.parse_args(argv)

    if args.command == 'menu':
        show_menu()
        return 0
    if args.command == 'list':
        return 0 if _print_catalog(refresh=args.refresh) else 1
    if args.command == 'sync-all':
        cmd_sync_all()
        return 0
    if args.command == 'sync':
        if not args.arg:
            print('Usage: bt plugin sync docker,pm2,redis')
            return 1
        cmd_sync([n.strip() for n in args.arg.split(',') if n.strip()])
        return 0
    if args.command == 'install':
        if not args.arg:
            print('Usage: bt plugin install docker')
            return 1
        return 0 if cmd_install(args.arg.strip()) else 1
    if args.command == 'install-all':
        cmd_install_all()
        return 0
    if args.command == 'export':
        cmd_export(args.arg.strip() or None)
        return 0
    if args.command == 'import':
        if not args.arg:
            print('Usage: bt plugin import /path/to/pack.tgz')
            return 1
        return 0 if cmd_import(args.arg.strip()) else 1
    return 1


if __name__ == '__main__':
    raise SystemExit(main())
