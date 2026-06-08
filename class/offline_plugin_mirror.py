# -*- coding: utf-8 -*-
"""
Local mirror for free aaPanel plugins (offline fork).

Fetch catalog from node.aapanel.com, download selected plugins to data/plugin_mirror/,
install from cache without cloud auth.
"""
import json
import os
import time

import public


def mirror_root():
    return '{}/data/plugin_mirror'.format(public.get_panel_path())


def mirror_zip_dir():
    path = '{}/zips'.format(mirror_root())
    if not os.path.exists(path):
        os.makedirs(path, mode=0o755)
    return path


def manifest_path():
    return '{}/manifest.json'.format(mirror_root())


def load_manifest():
    path = manifest_path()
    if not os.path.exists(path):
        return {'plugins': {}, 'updated_at': 0}
    try:
        data = json.loads(public.readFile(path))
        if not isinstance(data, dict):
            return {'plugins': {}, 'updated_at': 0}
        if 'plugins' not in data or not isinstance(data['plugins'], dict):
            data['plugins'] = {}
        return data
    except:
        return {'plugins': {}, 'updated_at': 0}


def save_manifest(data):
    root = mirror_root()
    if not os.path.exists(root):
        os.makedirs(root, mode=0o755)
    data['updated_at'] = int(time.time())
    public.writeFile(manifest_path(), json.dumps(data, indent=2))


def has_mirror(name):
    if not name:
        return False
    manifest = load_manifest()
    entry = manifest.get('plugins', {}).get(name)
    if not entry:
        return False
    zip_path = entry.get('zip') or '{}/{}.zip'.format(mirror_zip_dir(), name)
    return os.path.isfile(zip_path) and os.path.getsize(zip_path) > 100


def get_mirror_zip(name):
    manifest = load_manifest()
    entry = manifest.get('plugins', {}).get(name, {})
    zip_path = entry.get('zip') or '{}/{}.zip'.format(mirror_zip_dir(), name)
    if os.path.isfile(zip_path):
        return zip_path
    alt = '{}/{}.zip'.format(mirror_zip_dir(), name)
    if os.path.isfile(alt):
        return alt
    return None


def is_mirror_plugin(item):
    if not isinstance(item, dict):
        return False
    if public.is_offline_uninstallable_plugin(item):
        return False
    checks = str(item.get('install_checks') or '')
    if '/www/server/panel/plugin/' in checks:
        return True
    try:
        t = int(item.get('type', 0))
    except:
        t = 0
    return t in (4, 5, 8, 10, 12)


def _load_panel_userinfo(require_token=True):
    """Read bound aaPanel cloud account (absolute path; accepts access_token, not only JWT)."""
    user_path = '{}/data/userInfo.json'.format(public.get_panel_path())
    if not os.path.isfile(user_path):
        if require_token:
            raise public.PanelError(
                'aaPanel account not bound. Panel → Settings → aaPanel account → login.')
        return {}

    try:
        data = json.loads(public.readFile(user_path) or '{}')
    except Exception:
        data = {}

    if not isinstance(data, dict) or not data:
        if require_token:
            raise public.PanelError('userInfo.json is empty. Re-login via Panel → Settings → aaPanel account.')
        return {}

    token = data.get('token') or data.get('access_token') or data.get('jwt')
    if token and not data.get('token'):
        data['token'] = token

    if require_token and not token:
        raise public.PanelError(
            'No token in userInfo.json. Re-login via Panel → Settings → aaPanel account.')

    if data.get('id') is not None and not data.get('uid'):
        data['uid'] = data['id']

    if not data.get('server_id'):
        try:
            data['server_id'] = public.gen_server_id()
        except Exception:
            try:
                data['server_id'] = public.get_server_id()
            except Exception:
                data['server_id'] = public.md5(public.get_mac_address())
        try:
            public.writeFile(user_path, json.dumps(data))
        except Exception:
            pass

    return data


def fetch_cloud_soft_list(force_update=True):
    """Pull encrypted soft list from aaPanel cloud (works even when offline_mode is on)."""
    panel_path = public.get_panel_path()
    local_cache_file = '{}/data/plugin_bin.pl'.format(panel_path)
    cloud_url = '{}/api/panel/getSoftListEn'.format(public.OfficialApiBase())
    pdata = {}
    try:
        pdata = _load_panel_userinfo(require_token=False)
    except public.PanelError:
        pdata = {}
    except Exception:
        pdata = {}
    if not isinstance(pdata, dict):
        pdata = {}
    if not pdata.get('server_id'):
        try:
            pdata['server_id'] = public.gen_server_id()
        except:
            pdata['server_id'] = public.md5(public.get_mac_address())
    pdata['environment_info'] = json.dumps(public.fetch_env_info())
    headers = {'user-agent': 'aaPanel/1.0'}
    if pdata.get('token'):
        headers['authorization'] = 'bt {}'.format(pdata['token'])

    import requests
    resp = requests.post(cloud_url, params=pdata, headers=headers, verify=False, timeout=60)
    if not resp.ok:
        raise public.PanelError('Cloud soft list failed (HTTP {})'.format(resp.status_code))
    if force_update:
        public.writeFile(local_cache_file, resp.text)
    import PluginLoader
    if hasattr(PluginLoader, 'parse_plugin_list'):
        PluginLoader.parse_plugin_list(1)
    plugin_list_data = PluginLoader.get_plugin_list(0)
    if not isinstance(plugin_list_data, dict):
        raise public.PanelError('Invalid soft list from cloud')
    return plugin_list_data


def _plugin_version_key(item):
    vers = item.get('versions')
    if isinstance(vers, list) and vers:
        v0 = vers[0]
        if isinstance(v0, dict):
            if v0.get('m_version') is not None:
                return '{}.{}'.format(v0.get('m_version', ''), v0.get('version', ''))
            return str(v0.get('version', ''))
    return str(item.get('version', ''))


def _plugin_version_candidates(item):
    """Version strings to try against download_plugin API."""
    candidates = []
    primary = _plugin_version_key(item)
    if primary and primary != '.':
        candidates.append(primary)
    vers = item.get('versions') or []
    v0 = vers[0] if vers and isinstance(vers[0], dict) else {}
    fallback = '{}.{}'.format(v0.get('m_version', '1'), v0.get('version', '0'))
    if fallback and fallback not in candidates and fallback != '.':
        candidates.append(fallback)
    if v0.get('version'):
        sv = str(v0['version'])
        if sv not in candidates:
            candidates.append(sv)
    for alias in ('tls', 'beta'):
        if alias not in candidates:
            candidates.append(alias)
    return candidates


def _get_cloud_auth_pdata():
    return _load_panel_userinfo(require_token=True)


def _parse_download_http_error(resp):
    try:
        body = resp.json()
        if isinstance(body, dict):
            for key in ('msg', 'message', 'res', 'error'):
                if body.get(key):
                    return str(body[key])
    except:
        pass
    text = (resp.text or '').strip()
    if text:
        return text[:400]
    return 'Download failed (HTTP {})'.format(resp.status_code)


def _download_plugin_from_cloud(name, version):
    """Download plugin ZIP via aaPanel download_plugin API."""
    import json
    import requests

    panel_path = public.get_panel_path()
    tmp_path = '{}/temp'.format(panel_path)
    if not os.path.exists(tmp_path):
        os.makedirs(tmp_path, mode=0o755)
    filename = '{}/{}.zip'.format(tmp_path, name)
    if os.path.isfile(filename):
        os.remove(filename)

    pdata = _get_cloud_auth_pdata()
    extra = public.get_user_info() or {}
    if isinstance(extra, dict):
        for key, val in extra.items():
            if key not in pdata and val is not None and not isinstance(val, (list, tuple, dict)):
                pdata[key] = val
    pdata['name'] = name
    pdata['version'] = version
    pdata['os'] = 'Linux'
    pdata['environment_info'] = json.dumps(public.fetch_env_info(), ensure_ascii=False)

    try:
        headers = dict(public.get_requests_headers())
    except:
        headers = {'Content-type': 'application/x-www-form-urlencoded', 'User-Agent': 'BT-Panel'}
    headers['authorization'] = 'bt {}'.format(pdata['token'])

    urls = [
        '{}/api/panel/download_plugin'.format(public.sync_plugin_OfficialApiBase()),
        '{}/api/panel/download_plugin'.format(public.OfficialApiBase()),
    ]

    last_err = None
    for url in urls:
        try:
            resp = requests.post(url, pdata, headers=headers, timeout=(60, 1800), stream=True, verify=False)
        except Exception as ex:
            last_err = public.PanelError(str(ex))
            continue

        if not resp.ok:
            last_err = public.PanelError(_parse_download_http_error(resp))
            continue

        try:
            headers_total_size = int(resp.headers.get('File-size', 0))
        except:
            headers_total_size = 0

        if headers_total_size <= 0:
            last_err = public.PanelError(_parse_download_http_error(resp))
            continue

        with open(filename, 'wb') as out:
            for chunk in resp.iter_content(chunk_size=256 * 1024):
                if chunk:
                    out.write(chunk)

        content_md5 = resp.headers.get('Content-md5')
        if content_md5 and public.FileMd5(filename) != content_md5:
            os.remove(filename)
            last_err = public.PanelError('Verify package checksum failed.')
            continue

        if not os.path.isfile(filename) or os.path.getsize(filename) < 100:
            if os.path.isfile(filename):
                os.remove(filename)
            last_err = public.PanelError('Empty package for {}'.format(name))
            continue

        return filename

    if last_err:
        raise last_err
    raise public.PanelError('Download failed for {}'.format(name))


def list_catalog(refresh=False):
    if refresh or not load_manifest().get('plugins'):
        try:
            fetch_cloud_soft_list(force_update=refresh)
        except Exception as ex:
            return {'ok': False, 'error': str(ex), 'items': []}

    soft = public.load_soft_list(force=False)
    items = soft.get('list') if isinstance(soft, dict) else []
    if not isinstance(items, list):
        items = []

    manifest = load_manifest()
    catalog = []
    for item in items:
        if not is_mirror_plugin(item):
            continue
        name = item.get('name')
        if not name:
            continue
        mirrored = has_mirror(name)
        catalog.append({
            'name': name,
            'title': item.get('title', name),
            'version': _plugin_version_key(item),
            'type': item.get('type'),
            'setup': bool(item.get('setup')),
            'mirrored': mirrored,
            'enabled': manifest.get('plugins', {}).get(name, {}).get('enabled', True),
            'synced_at': manifest.get('plugins', {}).get(name, {}).get('synced_at', 0),
            'size': manifest.get('plugins', {}).get(name, {}).get('size', 0),
        })
    catalog.sort(key=lambda x: x['title'].lower())
    return {'ok': True, 'items': catalog, 'total': len(catalog), 'mirrored': sum(1 for x in catalog if x['mirrored'])}


def _download_plugin_zip(item):
    name = item['name']
    vers = item.get('versions') or []
    if not vers or not isinstance(vers[0], dict):
        raise public.PanelError('No version info for {}'.format(name))
    v0 = vers[0]
    zip_dir = mirror_zip_dir()
    dest = '{}/{}.zip'.format(zip_dir, name)
    tmp = '{}/{}.download'.format(zip_dir, name)

    if 'download' in v0 and v0.get('download'):
        auth = _get_cloud_auth_pdata()
        token = auth.get('token') or ''
        url = '{}/api/plugin/download?filename={}&token={}'.format(
            public.OfficialApiBase(), v0['download'], token)
        public.downloadFile(url, tmp)
        if v0.get('md5') and os.path.exists(tmp):
            if public.FileMd5(tmp) != v0['md5']:
                public.ExecShell('rm -f {}'.format(tmp))
                raise public.PanelError('MD5 mismatch for {}'.format(name))
    else:
        last_ex = None
        src = None
        for version in _plugin_version_candidates(item):
            try:
                src = _download_plugin_from_cloud(name, version)
                break
            except public.PanelError as ex:
                last_ex = ex
                err = str(ex).lower()
                if 'login' in err or 'token' in err or 'account' in err:
                    raise
        if not src:
            raise last_ex or public.PanelError('Download failed for {}'.format(name))
        import shutil
        shutil.copyfile(src, tmp)

    if not os.path.isfile(tmp) or os.path.getsize(tmp) < 100:
        public.ExecShell('rm -f {}'.format(tmp))
        raise public.PanelError('Empty package for {}'.format(name))

    if os.path.isfile(dest):
        public.ExecShell('rm -f {}'.format(dest))
    os.rename(tmp, dest)
    return dest


def sync_plugins(names=None, sync_all_free=False):
    if sync_all_free:
        cat = list_catalog(refresh=True)
        if not cat.get('ok'):
            return public.return_message(-1, 0, cat.get('error', 'Catalog fetch failed'))
        names = [x['name'] for x in cat.get('items', []) if not x.get('mirrored')]
    if not names:
        return public.return_message(-1, 0, public.lang('No plugins selected'))

    if isinstance(names, str):
        names = [n.strip() for n in names.split(',') if n.strip()]

    soft = public.load_soft_list(force=False)
    items = {x.get('name'): x for x in (soft.get('list') or []) if isinstance(x, dict)}

    manifest = load_manifest()
    results = []
    for name in names:
        item = items.get(name)
        if not item:
            results.append({'name': name, 'status': False, 'msg': 'Not in catalog'})
            continue
        if not is_mirror_plugin(item):
            results.append({'name': name, 'status': False, 'msg': 'Paid or not mirrorable'})
            continue
        try:
            zip_path = _download_plugin_zip(item)
            manifest.setdefault('plugins', {})[name] = {
                'title': item.get('title', name),
                'version': _plugin_version_key(item),
                'zip': zip_path,
                'size': os.path.getsize(zip_path),
                'synced_at': int(time.time()),
                'enabled': True,
            }
            results.append({'name': name, 'status': True, 'msg': 'Synced', 'zip': zip_path})
        except Exception as ex:
            results.append({'name': name, 'status': False, 'msg': str(ex)})

    save_manifest(manifest)
    ok = sum(1 for r in results if r.get('status'))
    return public.return_message(0, 0, {
        'synced': ok,
        'failed': len(results) - ok,
        'results': results,
    })


def _unwrap_message(result):
    if not isinstance(result, dict):
        return result
    if result.get('status') == -1:
        return None, result.get('message') or result.get('msg') or 'Error'
    if result.get('status') in (0, True) or result.get('status') is False and 'message' in result:
        return result.get('message', result), None
    return result, None


def install_from_mirror(name):
    zip_path = get_mirror_zip(name)
    if not zip_path:
        return public.return_msg_gettext(False, public.lang('Plugin not in local mirror: {}', name))

    import panel_plugin_v2
    plugin_obj = panel_plugin_v2.panelPlugin()
    unpack = plugin_obj._update_zip(None, zip_path, False)
    data, err = _unwrap_message(unpack if isinstance(unpack, dict) else {})
    if err:
        return public.return_msg_gettext(False, err if isinstance(err, str) else str(err))
    if not isinstance(data, dict):
        return public.return_msg_gettext(False, public.lang('Invalid plugin package'))

    get = public.dict_obj()
    get.plugin_name = data.get('name', name)
    get.tmp_path = data.get('tmp_path')
    if not get.tmp_path or not os.path.exists(get.tmp_path):
        return public.return_msg_gettext(False, public.lang('Temporary file does NOT exist, please re-upload!'))

    result = plugin_obj.input_zip(get)
    if isinstance(result, dict) and result.get('status') == 0:
        msg = result.get('message')
        if not isinstance(msg, str):
            msg = public.lang('Installation succeeded!')
        return public.return_msg_gettext(True, msg)
    if isinstance(result, dict):
        msg = result.get('message') or result.get('msg') or 'Install failed'
        return public.return_msg_gettext(False, msg if isinstance(msg, str) else str(msg))
    return result


def set_mirror_enabled(name, enabled=True):
    manifest = load_manifest()
    if name not in manifest.get('plugins', {}):
        return False
    manifest['plugins'][name]['enabled'] = bool(enabled)
    save_manifest(manifest)
    return True
