# -*- coding: utf-8 -*-
"""
Built-in panel plugins (pre-installed, toggle UI from App Store).
"""
import json
import os

import public

PLUGINS = {
    'bt_agent': {
        'title': 'AI Assistant',
        'install_checks': '/www/server/panel/plugin/bt_agent',
        'auto_install': True,
        'default_enabled': True,
        'list_entry': {
            'sort': 3,
            'ps': 'AI Assistant — panel chat helper (built-in)',
            'shell': 'bt_agent.sh',
            'name': 'bt_agent',
            'title': 'AI Assistant',
            'default': False,
            'pid': 9001,
            'versions': '1.0',
            'tip': 'lib',
            'checks': '/www/server/panel/plugin/bt_agent',
            'display': 1,
            'author': 'aaPanel',
            'date': '2024-01-01',
            'home': 'https://www.aapanel.com',
            'type': 'other',
            'price': 0,
            'id': 3,
        },
    },
}

WHITELIST_SOFT_NAMES = frozenset(PLUGINS.keys())


def _config_path():
    return '{}/data/builtin_plugins.json'.format(public.get_panel_path())


def load_config():
    path = _config_path()
    if not os.path.exists(path):
        return {}
    try:
        data = json.loads(public.readFile(path))
        return data if isinstance(data, dict) else {}
    except:
        return {}


def save_config(data):
    public.writeFile(_config_path(), json.dumps(data, indent=2))


def is_installed(name):
    if name not in PLUGINS:
        return False
    checks = PLUGINS[name].get('install_checks') or ''
    return bool(checks and os.path.exists(checks))


def is_ui_enabled(name):
    if name not in PLUGINS:
        return False
    if not is_installed(name):
        return False
    cfg = load_config()
    entry = cfg.get(name)
    if isinstance(entry, dict) and 'enabled' in entry:
        return bool(entry['enabled'])
    return bool(PLUGINS[name].get('default_enabled', True))


def set_ui_enabled(name, enabled):
    if name not in PLUGINS:
        return False
    cfg = load_config()
    cfg.setdefault(name, {})
    cfg[name]['enabled'] = bool(enabled)
    save_config(cfg)
    _sync_list_display(name, bool(enabled))
    return True


def _sync_list_display(name, enabled):
    try:
        import panel_plugin_v2
        plugin_obj = panel_plugin_v2.panelPlugin()
        if plugin_obj.GetFind(name):
            plugin_obj.SetField(name, 'display', 1 if enabled else 0)
    except:
        pass


def ensure_list_entry(name):
    meta = PLUGINS.get(name)
    if not meta or 'list_entry' not in meta:
        return
    list_path = '{}/data/list.json'.format(public.get_panel_path())
    items = []
    if os.path.exists(list_path):
        try:
            items = json.loads(public.readFile(list_path))
            if not isinstance(items, list):
                items = []
        except:
            items = []
    for item in items:
        if isinstance(item, dict) and item.get('name') == name:
            item['display'] = 1 if is_ui_enabled(name) else 0
            public.writeFile(list_path, json.dumps(items))
            return
    entry = dict(meta['list_entry'])
    entry['display'] = 1 if is_ui_enabled(name) else 0
    items.append(entry)
    public.writeFile(list_path, json.dumps(items))


def ensure_installed(name):
    if is_installed(name):
        return True
    try:
        import offline_plugin_mirror as mirror
        if not mirror.has_mirror(name):
            mirror.sync_plugins(names=[name])
        if mirror.has_mirror(name):
            result = mirror.install_from_mirror(name)
            if isinstance(result, dict) and result.get('status') is True:
                return is_installed(name)
    except:
        pass
    try:
        import panel_plugin_v2
        plugin_obj = panel_plugin_v2.panelPlugin()
        get = public.dict_obj()
        get.sName = name
        get.type = '0'
        plugin_obj.install_plugin(get)
    except:
        pass
    return is_installed(name)


def get_public_status():
    out = {}
    for name, meta in PLUGINS.items():
        out[name] = {
            'title': meta.get('title', name),
            'installed': is_installed(name),
            'enabled': is_ui_enabled(name),
        }
    return out


def ensure_all():
    for name, meta in PLUGINS.items():
        ensure_list_entry(name)
        if not meta.get('auto_install', True):
            continue
        ensure_installed(name)
        cfg = load_config()
        if name not in cfg and is_installed(name):
            set_ui_enabled(name, bool(meta.get('default_enabled', True)))
