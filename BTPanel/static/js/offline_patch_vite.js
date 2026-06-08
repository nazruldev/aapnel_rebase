/**
 * Offline mode — CSS-first patch. No DOM scanning on route changes.
 */
(function () {
	if (!window.__PANEL_OFFLINE_MODE) return;

	document.body && document.body.classList.add('panel-offline-mode');

	function removeLegacyZipBtn() {
		['offline-plugin-zip-btn', 'offline-plugin-zip-input'].forEach(function (id) {
			var el = document.getElementById(id);
			if (el) el.remove();
		});
	}

	removeLegacyZipBtn();

	document.addEventListener(
		'click',
		function (e) {
			var node = e.target;
			while (node && node !== document.body) {
				if (node.classList && node.classList.contains('pro-badge')) {
					e.preventDefault();
					e.stopImmediatePropagation();
					return false;
				}
				node = node.parentElement;
			}
		},
		true
	);
})();
