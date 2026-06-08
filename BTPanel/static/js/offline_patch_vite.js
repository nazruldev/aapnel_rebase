/**
 * Offline / isolated mode patch for aaPanel Vue (Vite) UI.
 */
(function () {
	if (!window.__PANEL_OFFLINE_MODE) return;

	document.body && document.body.classList.add('panel-offline-mode');

	var COMMERCIAL_RE =
		/upgrade\s*now|renew\s*now|renewal|buy\s*now|buy\s*license|purchase|subscribe|upgrade\s*to\s*pro|bind\s*account|login\s*to\s*continue|aapanel\.com|立即升级|立即续费|升级专业版|升级企业版|购买|续费|授权/i;

	function stopEvent(e) {
		if (e) {
			e.preventDefault();
			e.stopImmediatePropagation();
		}
		return false;
	}

	function shouldHideText(text) {
		if (!text) return false;
		var t = String(text).replace(/\s+/g, ' ').trim();
		if (!t || t.length > 120) return false;
		return COMMERCIAL_RE.test(t);
	}

	function hideNode(el) {
		if (!el || !el.parentNode) return;
		var parent = el.closest
			? el.closest(
					'.pro-badge, .product-buy, .daily-product-buy, .showprofun, .alert, .n-alert, .n-button, .n-card, button, a, .n-modal, .n-dialog'
			  )
			: null;
		if (parent && parent !== document.body) {
			if (
				parent.classList &&
				(parent.classList.contains('n-button') ||
					parent.classList.contains('btn') ||
					parent.classList.contains('pro-badge') ||
					parent.classList.contains('btlink') ||
					parent.classList.contains('n-modal') ||
					parent.classList.contains('n-dialog'))
			) {
				parent.style.setProperty('display', 'none', 'important');
				parent.style.setProperty('pointer-events', 'none', 'important');
				return;
			}
		}
		el.style.setProperty('display', 'none', 'important');
		el.style.setProperty('pointer-events', 'none', 'important');
	}

	function closeCommercialModals() {
		document.querySelectorAll('.n-modal, .n-dialog, .n-drawer').forEach(function (modal) {
			var text = modal.textContent || '';
			if (shouldHideText(text)) {
				modal.style.setProperty('display', 'none', 'important');
				modal.setAttribute('aria-hidden', 'true');
			}
		});
		document.querySelectorAll('.n-modal-mask, .n-modal-container').forEach(function (mask) {
			var text = mask.textContent || '';
			if (shouldHideText(text)) {
				mask.style.setProperty('display', 'none', 'important');
			}
		});
	}

	function stripCommercialUi() {
		closeCommercialModals();

		document.querySelectorAll('.pro-badge').forEach(function (el) {
			el.style.setProperty('display', 'none', 'important');
			el.onclick = stopEvent;
		});

		document
			.querySelectorAll(
				'#updata_pro_info, .product-buy, .daily-product-buy, .authState, .bind-user, .openLtd, #is_ltd, .btpro-free, .btpro-gray, .updata_pro, .showprofun, .alert-ltd-success, [href*="aapanel.com"], [href*="bt.cn"]'
			)
			.forEach(function (el) {
				el.parentNode && el.parentNode.removeChild(el);
			});

		document.querySelectorAll('button, a, .n-button, .btlink, span, div, p, h1, h2, h3, h4').forEach(function (el) {
			if (el.children && el.children.length > 4) return;
			if (shouldHideText(el.textContent)) hideNode(el);
		});
	}

	function injectPluginZipUpload() {
		if (!location.pathname.includes('/soft')) return;
		if (document.getElementById('offline-plugin-zip-btn')) return;

		var btn = document.createElement('button');
		btn.id = 'offline-plugin-zip-btn';
		btn.type = 'button';
		btn.className = 'n-button n-button--primary-type n-button--medium-type';
		btn.style.cssText = 'margin-left:12px;';
		btn.textContent = 'Import Plugin (ZIP)';

		var input = document.createElement('input');
		input.type = 'file';
		input.accept = '.zip,.tar.gz';
		input.style.display = 'none';
		input.id = 'offline-plugin-zip-input';

		btn.addEventListener('click', function () {
			input.click();
		});

		input.addEventListener('change', function () {
			var file = input.files && input.files[0];
			input.value = '';
			if (!file) return;

			var formData = new FormData();
			formData.append('plugin_zip', file);

			fetch('/plugin?action=update_zip', {
				method: 'POST',
				body: formData,
				credentials: 'same-origin',
			})
				.then(function (r) {
					return r.json();
				})
				.then(function (data) {
					if (data && typeof data.status === 'number' && data.status !== 0) {
						alert((data.message && data.message.msg) || data.msg || 'Upload failed');
						return;
					}
					if (data && data.message && typeof data.message === 'object') data = data.message;
					if (data && data.status === false) {
						alert(data.msg || 'Upload failed');
						return;
					}
					if (!data || !data.name) {
						alert('Invalid plugin package');
						return;
					}
					if (!confirm('Install plugin "' + data.title + '" v' + data.versions + '?')) return;

					var body = new URLSearchParams();
					body.append('plugin_name', data.name);
					body.append('tmp_path', data.tmp_path);

					return fetch('/plugin?action=input_zip', {
						method: 'POST',
						body: body,
						credentials: 'same-origin',
						headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
					})
						.then(function (r) {
							return r.json();
						})
						.then(function (res) {
							var ok = res && (res.status === true || res.status === 0);
							var msg = (res && res.message) || (res && res.msg) || (ok ? 'Installed' : 'Install failed');
							alert(msg);
							if (ok) location.reload();
						});
				})
				.catch(function () {
					alert('Upload failed');
				});
		});

		document.body.appendChild(input);

		var toolbar =
			document.querySelector('.soft-header') ||
			document.querySelector('.page-header') ||
			document.querySelector('.n-page-header') ||
			document.querySelector('main .flex') ||
			document.querySelector('main');

		if (toolbar) {
			toolbar.appendChild(btn);
		} else {
			btn.style.cssText = 'position:fixed;top:72px;right:24px;z-index:9999;';
			document.body.appendChild(btn);
		}
	}

	stripCommercialUi();
	injectPluginZipUpload();

	if (document.documentElement) {
		new MutationObserver(function () {
			stripCommercialUi();
			injectPluginZipUpload();
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
				if (node.classList && node.classList.contains('pro-badge')) {
					return stopEvent(e);
				}
				if (shouldHideText(node.textContent) && node.matches && node.matches('button, a, .n-button, .btlink')) {
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
