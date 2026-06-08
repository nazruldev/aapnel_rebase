/**
 * Offline / isolated mode patch for aaPanel Vue (Vite) UI.
 * Keeps native App Store plugin upload (NUpload + n-dialog) working.
 */
(function () {
	if (!window.__PANEL_OFFLINE_MODE) return;

	(function removeStaleZipBtn() {
		var btn = document.getElementById('offline-plugin-zip-btn');
		if (btn) btn.remove();
		var input = document.getElementById('offline-plugin-zip-input');
		if (input) input.remove();
	})();

	document.body && document.body.classList.add('panel-offline-mode');

	var COMMERCIAL_RE =
		/upgrade\s*now|renew\s*now|renewal|buy\s*now|buy\s*license|purchase|subscribe|upgrade\s*to\s*pro|bind\s*account|login\s*to\s*continue|feedback|立即升级|立即续费|升级专业版|升级企业版|购买|续费|授权/i;

	function stopEvent(e) {
		if (e) {
			e.preventDefault();
			e.stopImmediatePropagation();
		}
		return false;
	}

	function isAppStoreUploadArea(el) {
		if (!el || !el.closest) return false;
		return !!(
			el.closest('.appStore-third-tips') ||
			el.closest('.n-upload') ||
			el.closest('[class*="app-install-third"]')
		);
	}

	function isPluginInstallModal(el) {
		if (!el) return false;
		if (el.id === 'offline-mirror-modal' || (el.closest && el.closest('#offline-mirror-modal'))) return true;
		if (el.querySelector && el.querySelector('.item[data-v-1e17ded2], .item')) {
			var item = el.querySelector('.item[data-v-1e17ded2], .item');
			if (item && item.querySelector('b')) return true;
		}
		var title = '';
		var titleEl = el.querySelector('.n-dialog__title, .n-modal-title, .n-card-header__main, [class*="dialog-title"]');
		if (titleEl) title = titleEl.textContent || '';
		if (/third.party plugin|install third|import plugin|Intall third/i.test(title)) return true;
		if (/install|plugin|software|version|upgrade|uninstall|import|正在安装|安装/i.test(title)) return true;
		if (el.querySelector && el.querySelector('.n-progress, .speed-progress, [class*="install"]')) return true;
		var snippet = (el.textContent || '').slice(0, 800);
		if (/installing|installation|panelShell|install plugin|installing plugin/i.test(snippet)) return true;
		return false;
	}

	function isPluginSystemModal(el) {
		if (!el) return false;
		if (isPluginInstallModal(el)) return true;
		var modal = el.closest ? el.closest('.n-modal, .n-dialog, .n-drawer, .n-modal-container') : null;
		return modal ? isPluginInstallModal(modal) : false;
	}

	function shouldHideText(text, el) {
		if (!text) return false;
		if (el && (isAppStoreUploadArea(el) || isProtectedPanelArea(el))) return false;
		var t = String(text).replace(/\s+/g, ' ').trim();
		if (!t || t.length > 120) return false;
		if (/aapanel\.com|bt\.cn/i.test(t) && el && (isAppStoreUploadArea(el) || el.closest('.n-dialog, .n-modal'))) {
			return false;
		}
		return COMMERCIAL_RE.test(t);
	}

	function isProtectedPanelArea(el) {
		if (!el || !el.closest) return false;
		if (isPluginSystemModal(el)) return true;
		return !!el.closest(
			'.n-card, .n-card__content, .n-card-content, .n-data-table, .n-layout, ' +
				'.n-layout-content, .n-layout-scroll-container, .n-scrollbar-content, ' +
				'.n-tab-pane, .n-tabs, .main-content, #container, ' +
				'.soft-content, .site-content, .home-content, .n-form, .n-descriptions, ' +
				'.n-list, .n-collapse, .n-card-header, .n-card__header, ' +
				'.n-modal-body, .n-dialog__content, .n-drawer-content, #offline-mirror-modal'
		);
	}

	function hideNode(el) {
		if (!el || !el.parentNode || isAppStoreUploadArea(el)) return;
		if (isProtectedPanelArea(el)) return;
		if (isPluginSystemModal(el)) return;
		var parent = el.closest
			? el.closest(
					'.pro-badge, .product-buy, .daily-product-buy, .showprofun, .alert, .n-alert, .n-button, button, a'
			  )
			: null;
		if (parent && parent !== document.body) {
			if (isAppStoreUploadArea(parent) || isPluginSystemModal(parent) || isProtectedPanelArea(parent)) return;
			if (
				parent.classList &&
				(parent.classList.contains('n-button') ||
					parent.classList.contains('btn') ||
					parent.classList.contains('pro-badge') ||
					parent.classList.contains('btlink'))
			) {
				parent.setAttribute('data-offline-hide', '1');
				parent.style.setProperty('display', 'none', 'important');
				parent.style.setProperty('pointer-events', 'none', 'important');
				return;
			}
		}
		if (el.getAttribute('data-offline-hide') === '1') return;
		el.setAttribute('data-offline-hide', '1');
		el.style.setProperty('display', 'none', 'important');
		el.style.setProperty('pointer-events', 'none', 'important');
	}

	function closeCommercialModals() {
		document.querySelectorAll('.n-modal, .n-dialog, .n-drawer').forEach(function (modal) {
			if (isPluginSystemModal(modal)) return;
			var text = modal.textContent || '';
			if (shouldHideText(text, modal)) {
				modal.style.setProperty('display', 'none', 'important');
				modal.setAttribute('aria-hidden', 'true');
			}
		});
		document.querySelectorAll('.n-modal-mask, .n-modal-container').forEach(function (mask) {
			if (isPluginSystemModal(mask)) return;
			if (mask.querySelector && mask.querySelector('.n-modal, .n-dialog') && isPluginSystemModal(mask)) return;
			var text = mask.textContent || '';
			if (shouldHideText(text, mask)) {
				mask.style.setProperty('display', 'none', 'important');
			}
		});
	}

	function hideAuthBadge() {
		document.querySelectorAll('.pro-badge, .header-right > div').forEach(function (el) {
			var text = (el.textContent || '').replace(/\s+/g, ' ').trim();
			if (/^\d+\.\d+\.\d+/.test(text) || /expire on|renewal|lifetime/i.test(text)) {
				el.setAttribute('data-offline-hide', '1');
				el.style.setProperty('display', 'none', 'important');
			}
		});
	}

	function hideAppStorePriceColumn() {
		document.querySelectorAll('th, .n-data-table-th').forEach(function (th) {
			var text = (th.textContent || '').trim().toLowerCase();
			if (text === 'price' || text === 'expire date' || text.indexOf('expire') === 0) {
				th.classList.add('soft-expire-col');
				var idx = th.cellIndex;
				if (idx >= 0 && th.parentNode && th.parentNode.parentNode) {
					th.parentNode.parentNode.querySelectorAll('tr').forEach(function (row) {
						if (row.children[idx]) row.children[idx].classList.add('soft-expire-col');
					});
				}
			}
		});
	}

	function hideFeedbackUi() {
		document
			.querySelectorAll('.feedback-btn, [class*="feedback"], .icon-demand, [href*="feedback"]')
			.forEach(function (el) {
				if (isAppStoreUploadArea(el)) return;
				var text = (el.textContent || '').trim();
				if (/feedback/i.test(text) || el.classList.contains('icon-demand')) {
					el.setAttribute('data-offline-hide', '1');
					el.style.setProperty('display', 'none', 'important');
				}
			});
	}

	function removeLegacyZipBtn() {
		var ids = ['offline-plugin-zip-btn', 'offline-plugin-zip-input'];
		ids.forEach(function (id) {
			var el = document.getElementById(id);
			if (el) el.remove();
		});
		document.querySelectorAll('button, .n-button, a.n-button').forEach(function (el) {
			if (el.id === 'offline-plugin-zip-btn') {
				el.remove();
				return;
			}
			if (el.closest && el.closest('.appStore-third-tips')) return;
			var label = (el.textContent || '').replace(/\s+/g, ' ').trim();
			if (label === 'Import Plugin (ZIP)') el.remove();
		});
	}

	function hideAppStoreEmptyFeedback() {
		document.querySelectorAll('.n-data-table-empty, .n-empty, .n-data-table-td--empty, .n-data-table-tr--empty').forEach(function (el) {
			var text = (el.textContent || '').replace(/\s+/g, ' ').trim();
			if (/demand feedback|submit the demand|not found.*feedback|未找到.*反馈|requirements feedback/i.test(text)) {
				el.querySelectorAll('a, button, .n-button, .btlink, span').forEach(function (node) {
					node.style.setProperty('display', 'none', 'important');
				});
				el.textContent = '';
			}
		});
	}

	function tuneAppStoreUploadBar() {
		document.querySelectorAll('.appStore-third-tips').forEach(function (box) {
			box.style.setProperty('display', 'block', 'important');
			box.style.setProperty('visibility', 'visible', 'important');
			box.querySelectorAll('.n-button').forEach(function (btn) {
				if (btn.closest('.n-upload') || btn.id === 'offline-mirror-btn') {
					btn.style.removeProperty('display');
					btn.style.removeProperty('pointer-events');
					return;
				}
				var label = (btn.textContent || '').trim();
				if (/third.party apps|get third/i.test(label)) {
					btn.style.setProperty('display', 'none', 'important');
				}
			});
			box.querySelectorAll('.n-upload').forEach(function (upload) {
				upload.style.setProperty('display', 'inline-block', 'important');
				upload.style.setProperty('visibility', 'visible', 'important');
			});
		});
	}

	function postPlugin(action, body) {
		var params = new URLSearchParams();
		Object.keys(body || {}).forEach(function (k) {
			params.append(k, body[k]);
		});
		return fetch('/plugin?action=' + action, {
			method: 'POST',
			body: params,
			credentials: 'same-origin',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		}).then(function (r) {
			return r.json();
		});
	}

	function unwrap(res) {
		if (res && typeof res.status === 'number' && res.status === 0) return res.message;
		return res;
	}

	function btAgentUiEnabled() {
		var st = window.__BUILTIN_PLUGINS && window.__BUILTIN_PLUGINS.bt_agent;
		if (!st) return true;
		return !!(st.installed && st.enabled !== false);
	}

	function syncAiAssistantVisibility() {
		var show = btAgentUiEnabled();
		document.querySelectorAll('.nps-container .nps-box').forEach(function (box) {
			var img = box.querySelector('img[src*="bt_agent"]');
			if (!img && !/AI Assistant/i.test(box.textContent || '')) return;
			if (show) {
				box.style.removeProperty('display');
			} else {
				box.style.setProperty('display', 'none', 'important');
			}
		});
	}

	function refreshBuiltinPlugins() {
		return postPlugin('get_builtin_plugins', {}).then(function (res) {
			var data = unwrap(res);
			if (data && typeof data === 'object') {
				window.__BUILTIN_PLUGINS = data;
			}
			syncAiAssistantVisibility();
			return data;
		});
	}

	function injectBtAgentAppStoreToggle() {
		if (!location.pathname.includes('/soft')) return;
		document.querySelectorAll('.n-data-table-tr, tr').forEach(function (row) {
			if (row.querySelector('.offline-bt-agent-toggle')) return;
			var img = row.querySelector('img[src*="bt_agent"]');
			var text = (row.textContent || '').replace(/\s+/g, ' ');
			if (!img && !(/AI Assistant/i.test(text) && /bt_agent/i.test(text))) return;
			var cell = row.querySelector('.n-data-table-td:last-child, td:last-child');
			if (!cell) return;
			var label = document.createElement('label');
			label.className = 'offline-bt-agent-toggle';
			label.style.cssText =
				'display:inline-flex;align-items:center;gap:6px;margin-left:10px;font-size:12px;cursor:pointer;white-space:nowrap';
			var cb = document.createElement('input');
			cb.type = 'checkbox';
			cb.checked = btAgentUiEnabled();
			cb.addEventListener('change', function () {
				postPlugin('set_builtin_plugin_status', {
					name: 'bt_agent',
					enabled: cb.checked ? '1' : '0',
				}).then(function (res) {
					var data = unwrap(res);
					if (data && typeof data === 'object') window.__BUILTIN_PLUGINS = data;
					syncAiAssistantVisibility();
				});
			});
			label.appendChild(cb);
			label.appendChild(document.createTextNode('Show in panel'));
			cell.appendChild(label);
		});
	}

	function injectPluginMirrorButton() {
		if (!location.pathname.includes('/soft')) return;
		document.querySelectorAll('.appStore-third-tips').forEach(function (box) {
			if (box.querySelector('#offline-mirror-btn')) return;
			var btn = document.createElement('button');
			btn.id = 'offline-mirror-btn';
			btn.type = 'button';
			btn.className = 'n-button n-button--primary-type n-button--small-type mx-10px';
			btn.textContent = 'Sync free plugins';
			btn.addEventListener('click', openPluginMirrorModal);
			box.appendChild(btn);
		});
	}

	function openPluginMirrorModal() {
		if (document.getElementById('offline-mirror-modal')) return;

		var mask = document.createElement('div');
		mask.id = 'offline-mirror-modal';
		mask.className = 'n-modal-container';
		mask.style.cssText =
			'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;';

		var dialog = document.createElement('div');
		dialog.className = 'n-dialog n-dialog--icon-left n-modal';
		dialog.style.cssText = 'width:720px;max-width:92vw;max-height:85vh;background:var(--n-color,#fff);border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,.2);display:flex;flex-direction:column;';

		dialog.innerHTML =
			'<div class="n-dialog__title" style="padding:16px 20px;font-weight:600;border-bottom:1px solid #eee;">Free plugin mirror</div>' +
			'<div class="n-dialog__content" style="padding:16px 20px;overflow:auto;flex:1;"><p style="margin:0 0 12px;color:#666;">Fetch free plugins from node.aapanel.com, cache locally, then install without cloud.</p><div id="offline-mirror-status">Loading...</div><div id="offline-mirror-list" style="margin-top:12px;"></div></div>' +
			'<div class="n-dialog__action" style="padding:12px 20px;border-top:1px solid #eee;display:flex;gap:8px;justify-content:flex-end;">' +
			'<button type="button" class="n-button" id="offline-mirror-close">Close</button>' +
			'<button type="button" class="n-button n-button--primary-type" id="offline-mirror-sync-selected">Sync selected</button>' +
			'<button type="button" class="n-button n-button--primary-type" id="offline-mirror-sync-all">Sync all free</button>' +
			'</div>';

		mask.appendChild(dialog);
		document.body.appendChild(mask);

		function close() {
			mask.remove();
		}
		mask.addEventListener('click', function (e) {
			if (e.target === mask) close();
		});
		dialog.querySelector('#offline-mirror-close').addEventListener('click', close);

		function renderList(data) {
			var list = document.getElementById('offline-mirror-list');
			var status = document.getElementById('offline-mirror-status');
			if (!data || !data.items) {
				status.textContent = 'Failed to load catalog';
				return;
			}
			status.textContent = data.total + ' free plugins, ' + data.mirrored + ' cached locally';
			list.innerHTML =
				'<table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="text-align:left;border-bottom:1px solid #eee;"><th></th><th>Name</th><th>Title</th><th>Version</th><th>Cache</th><th></th></tr></thead><tbody>' +
				data.items
					.map(function (item) {
						var cached = item.mirrored ? 'Yes' : 'No';
						var installBtn = item.mirrored
							? '<button type="button" class="n-button n-button--tiny-type mirror-install" data-name="' +
							  item.name +
							  '">Install</button>'
							: '';
						return (
							'<tr style="border-bottom:1px solid #f0f0f0;"><td><input type="checkbox" class="mirror-pick" value="' +
							item.name +
							'" ' +
							(item.mirrored ? '' : 'checked') +
							' /></td><td>' +
							item.name +
							'</td><td>' +
							item.title +
							'</td><td>' +
							item.version +
							'</td><td>' +
							cached +
							'</td><td>' +
							installBtn +
							'</td></tr>'
						);
					})
					.join('') +
				'</tbody></table>';

			list.querySelectorAll('.mirror-install').forEach(function (b) {
				b.addEventListener('click', function () {
					var name = b.getAttribute('data-name');
					b.disabled = true;
					b.textContent = '...';
					postPlugin('mirror_install_plugin', { name: name }).then(function (res) {
						alert((res && res.message) || (res && res.msg) || 'Done');
						loadCatalog();
						if (res && res.status === 0) location.reload();
					});
				});
			});
		}

		function loadCatalog() {
			postPlugin('mirror_list_catalog', { refresh: '1' }).then(function (res) {
				renderList(unwrap(res));
			});
		}

		dialog.querySelector('#offline-mirror-sync-selected').addEventListener('click', function () {
			var names = [];
			dialog.querySelectorAll('.mirror-pick:checked').forEach(function (cb) {
				names.push(cb.value);
			});
			if (!names.length) {
				alert('Select at least one plugin');
				return;
			}
			postPlugin('mirror_sync_plugins', { names: names.join(',') }).then(function (res) {
				alert(JSON.stringify(unwrap(res)));
				loadCatalog();
			});
		});

		dialog.querySelector('#offline-mirror-sync-all').addEventListener('click', function () {
			if (!confirm('Download all free plugins? This may take a while.')) return;
			postPlugin('mirror_sync_plugins', { sync_all: '1' }).then(function (res) {
				alert(JSON.stringify(unwrap(res)));
				loadCatalog();
			});
		});

		loadCatalog();
	}

	function stripCommercialUi() {
		var onSoftPage = location.pathname.includes('/soft');
		if (!onSoftPage) {
			closeCommercialModals();
		}
		removeLegacyZipBtn();
		hideAuthBadge();
		hideAppStorePriceColumn();
		hideFeedbackUi();
		hideAppStoreEmptyFeedback();
		tuneAppStoreUploadBar();
		syncAiAssistantVisibility();
		injectBtAgentAppStoreToggle();

		document.querySelectorAll('.pro-badge').forEach(function (el) {
			el.style.setProperty('display', 'none', 'important');
			el.onclick = stopEvent;
		});

		document
			.querySelectorAll(
				'#updata_pro_info, .product-buy, .daily-product-buy, .authState, .bind-user, .openLtd, #is_ltd, .btpro-free, .btpro-gray, .updata_pro, .showprofun, .alert-ltd-success'
			)
			.forEach(function (el) {
				if (isAppStoreUploadArea(el) || isPluginSystemModal(el)) return;
				el.parentNode && el.parentNode.removeChild(el);
			});

		document.querySelectorAll('a[href*="aapanel.com"], a[href*="bt.cn"]').forEach(function (el) {
			if (isAppStoreUploadArea(el) || isProtectedPanelArea(el) || isPluginSystemModal(el)) return;
			el.parentNode && el.parentNode.removeChild(el);
		});

		if (!onSoftPage) {
			document.querySelectorAll('button, a, .n-button, .btlink').forEach(function (el) {
				if (isAppStoreUploadArea(el) || isProtectedPanelArea(el) || isPluginSystemModal(el)) return;
				if (el.getAttribute('data-offline-hide') === '1') return;
				if (shouldHideText(el.textContent, el)) hideNode(el);
			});
		}
	}

	var stripScheduled = false;
	function scheduleStripCommercialUi() {
		if (stripScheduled) return;
		stripScheduled = true;
		requestAnimationFrame(function () {
			stripScheduled = false;
			stripCommercialUi();
		});
	}

	stripCommercialUi();
	refreshBuiltinPlugins();

	if (document.documentElement) {
		new MutationObserver(function (mutations) {
			for (var i = 0; i < mutations.length; i++) {
				var nodes = mutations[i].addedNodes;
				for (var j = 0; j < nodes.length; j++) {
					var node = nodes[j];
					if (!node || node.nodeType !== 1) continue;
					if (node.id === 'offline-plugin-zip-btn' || node.id === 'offline-plugin-zip-input') {
						node.remove();
						continue;
					}
					if (node.querySelector && node.querySelector('#offline-plugin-zip-btn')) {
						removeLegacyZipBtn();
					}
				}
			}
			scheduleStripCommercialUi();
		}).observe(document.documentElement, {
			childList: true,
			subtree: true,
		});
	}

	document.addEventListener(
		'click',
		function (e) {
			var node = e.target;
			while (node && node !== document.body) {
				if (isAppStoreUploadArea(node) || isPluginSystemModal(node)) return;
				if (node.classList && node.classList.contains('pro-badge')) {
					return stopEvent(e);
				}
				if (shouldHideText(node.textContent, node) && node.matches && node.matches('button, a, .n-button, .btlink')) {
					return stopEvent(e);
				}
				if (node.href && /aapanel\.com|bt\.cn/i.test(node.href)) {
					return stopEvent(e);
				}
				node = node.parentElement;
			}
		},
		true
	);
})();
