/**
 * Offline mode patch for aaPanel Vue (Vite) UI.
 */
(function () {
	if (!window.__PANEL_OFFLINE_MODE) return;

	document.body && document.body.classList.add('panel-offline-mode');

	var UPGRADE_RE =
		/upgrade\s*now|renew\s*now|buy\s*now|upgrade\s*to\s*pro|bind\s*account|login\s*to\s*continue|立即升级|立即续费|升级专业版|升级企业版/i;

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
		if (!t || t.length > 80) return false;
		return UPGRADE_RE.test(t);
	}

	function hideNode(el) {
		if (!el || !el.parentNode) return;
		var parent = el.closest
			? el.closest(
					'.pro-badge, .product-buy, .daily-product-buy, .showprofun, .alert, .n-alert, .n-button, button, a'
			  )
			: null;
		if (parent && parent !== document.body) {
			if (
				parent.classList &&
				(parent.classList.contains('n-button') ||
					parent.classList.contains('btn') ||
					parent.classList.contains('pro-badge') ||
					parent.classList.contains('btlink'))
			) {
				parent.style.setProperty('display', 'none', 'important');
				parent.style.setProperty('pointer-events', 'none', 'important');
				return;
			}
		}
		el.style.setProperty('display', 'none', 'important');
		el.style.setProperty('pointer-events', 'none', 'important');
	}

	function stripCommercialUi() {
		document.querySelectorAll('.pro-badge').forEach(function (el) {
			el.style.setProperty('display', 'none', 'important');
			el.onclick = stopEvent;
		});

		document
			.querySelectorAll(
				'#updata_pro_info, .product-buy, .daily-product-buy, .authState, .bind-user, .openLtd, #is_ltd, .btpro-free, .btpro-gray, .updata_pro, .showprofun, .alert-ltd-success'
			)
			.forEach(function (el) {
				el.parentNode && el.parentNode.removeChild(el);
			});

		document.querySelectorAll('button, a, .n-button, .btlink, span, div').forEach(function (el) {
			if (el.children && el.children.length > 2) return;
			if (shouldHideText(el.textContent)) hideNode(el);
		});
	}

	stripCommercialUi();
	if (document.documentElement) {
		new MutationObserver(stripCommercialUi).observe(document.documentElement, {
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
				node = node.parentElement;
			}
		},
		true
	);
})();
