/**
 * Offline / isolated mode patch for aaPanel Vue (Vite) UI.
 * Keeps native App Store plugin upload (NUpload + n-dialog) working.
 */
(function () {
	if (!window.__PANEL_OFFLINE_MODE) return;

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
		if (el.querySelector && el.querySelector('.item[data-v-1e17ded2], .item')) {
			var item = el.querySelector('.item[data-v-1e17ded2], .item');
			if (item && item.querySelector('b')) return true;
		}
		var title = '';
		var titleEl = el.querySelector('.n-dialog__title, .n-modal-title');
		if (titleEl) title = titleEl.textContent || '';
		return /third.party plugin|install third|import plugin|Intall third/i.test(title);
	}

	function shouldHideText(text, el) {
		if (!text) return false;
		if (el && isAppStoreUploadArea(el)) return false;
		var t = String(text).replace(/\s+/g, ' ').trim();
		if (!t || t.length > 120) return false;
		if (/aapanel\.com|bt\.cn/i.test(t) && el && (isAppStoreUploadArea(el) || el.closest('.n-dialog, .n-modal'))) {
			return false;
		}
		return COMMERCIAL_RE.test(t);
	}

	function hideNode(el) {
		if (!el || !el.parentNode || isAppStoreUploadArea(el)) return;
		if (isPluginInstallModal(el.closest ? el.closest('.n-modal, .n-dialog, .n-modal-container') : null)) {
			return;
		}
		var parent = el.closest
			? el.closest(
					'.pro-badge, .product-buy, .daily-product-buy, .showprofun, .alert, .n-alert, .n-button, .n-card, button, a, .n-modal, .n-dialog'
			  )
			: null;
		if (parent && parent !== document.body) {
			if (isAppStoreUploadArea(parent) || isPluginInstallModal(parent)) return;
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
			if (isPluginInstallModal(modal)) return;
			var text = modal.textContent || '';
			if (shouldHideText(text, modal)) {
				modal.style.setProperty('display', 'none', 'important');
				modal.setAttribute('aria-hidden', 'true');
			}
		});
		document.querySelectorAll('.n-modal-mask, .n-modal-container').forEach(function (mask) {
			if (isPluginInstallModal(mask)) return;
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

	function tuneAppStoreUploadBar() {
		document.querySelectorAll('.appStore-third-tips').forEach(function (box) {
			box.style.setProperty('display', 'block', 'important');
			box.style.setProperty('visibility', 'visible', 'important');
			box.querySelectorAll('.n-button').forEach(function (btn) {
				if (btn.closest('.n-upload')) {
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

	function stripCommercialUi() {
		closeCommercialModals();
		hideAuthBadge();
		hideAppStorePriceColumn();
		hideFeedbackUi();
		tuneAppStoreUploadBar();

		document.querySelectorAll('.pro-badge').forEach(function (el) {
			el.style.setProperty('display', 'none', 'important');
			el.onclick = stopEvent;
		});

		document
			.querySelectorAll(
				'#updata_pro_info, .product-buy, .daily-product-buy, .authState, .bind-user, .openLtd, #is_ltd, .btpro-free, .btpro-gray, .updata_pro, .showprofun, .alert-ltd-success'
			)
			.forEach(function (el) {
				if (isAppStoreUploadArea(el)) return;
				el.parentNode && el.parentNode.removeChild(el);
			});

		document.querySelectorAll('a[href*="aapanel.com"], a[href*="bt.cn"]').forEach(function (el) {
			if (isAppStoreUploadArea(el)) return;
			if (el.closest('.n-dialog, .n-modal') && isPluginInstallModal(el.closest('.n-dialog, .n-modal'))) {
				return;
			}
			el.parentNode && el.parentNode.removeChild(el);
		});

		document.querySelectorAll('button, a, .n-button, .btlink, span, div, p, h1, h2, h3, h4').forEach(function (el) {
			if (el.children && el.children.length > 4) return;
			if (isAppStoreUploadArea(el)) return;
			if (shouldHideText(el.textContent, el)) hideNode(el);
		});
	}

	stripCommercialUi();

	if (document.documentElement) {
		new MutationObserver(function () {
			stripCommercialUi();
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
				if (isAppStoreUploadArea(node)) return;
				if (node.classList && node.classList.contains('pro-badge')) {
					return stopEvent(e);
				}
				if (shouldHideText(node.textContent, node) && node.matches && node.matches('button, a, .n-button, .btlink')) {
					return stopEvent(e);
				}
				if (node.href && /aapanel\.com|bt\.cn/i.test(node.href)) {
					if (node.closest('.n-dialog, .n-modal') && isPluginInstallModal(node.closest('.n-dialog, .n-modal'))) {
						return;
					}
					return stopEvent(e);
				}
				node = node.parentElement;
			}
		},
		true
	);
})();
