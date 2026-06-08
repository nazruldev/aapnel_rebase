/**
 * Offline / private mode: disable aaPanel account binding and Pro upgrade UI.
 */
(function () {
	var offline = !!window.__PANEL_OFFLINE_MODE;
	if (typeof bt === 'undefined' && !offline) return;

	if (document.body) document.body.classList.add('panel-offline-mode');

	if (typeof bt !== 'undefined') {
		bt.set_cookie('pro_end', 0);
		bt.set_cookie('ltd_end', 0);

		function noop() {
			return false;
		}

		if (bt.pub) {
			bt.pub.bind_btname = function (callback) {
				if (callback) callback({ status: true });
				return false;
			};
			bt.pub.unbind_bt = noop;
		}

		if (bt.soft) {
			bt.soft.product_pay_view = noop;
			bt.soft.updata_pro = noop;
			bt.soft.renew_pro = noop;
			bt.soft.updata_ltd = noop;
			bt.soft.get_order_stat = noop;
			bt.soft.product_pay_monitor = noop;
			bt.soft.updata_commercial_view = noop;
			if (bt.soft.pro) {
				bt.soft.pro.create_order = function (data, callback) {
					if (callback) callback({ status: false, msg: 'Offline mode' });
				};
			}
		}

		if (typeof index !== 'undefined') {
			index.check_update = noop;
			index.to_update = noop;
		}
		if (bt.system) {
			bt.system.check_update = function (cb) {
				if (cb) cb({ status: true, local_is_latest: true, version: window.panelVersion || '' });
			};
			bt.system.to_update = noop;
		}

		if (typeof product_recommend !== 'undefined') {
			product_recommend.pay_product_sign = noop;
			if (product_recommend.recommend_product_view) {
				product_recommend.recommend_product_view = noop;
			}
		}
	}

	var UPGRADE_RE =
		/upgrade\s*now|renew\s*now|renewal|buy\s*now|buy\s*license|upgrade\s*to\s*pro|bind\s*account|license|purchase|aapanel\.com|立即升级|立即续费|升级专业版/i;

	function stripCommercialUi() {
		if (typeof $ === 'undefined') return;
		$(
			'#updata_pro_info, .product-buy, .authState, .bind-user, .daily-product-buy, .openLtd, #is_ltd, .btpro-free, .btpro-gray, .updata_pro, .showprofun, .alert-ltd-success'
		).remove();

		$('button, a, .btn, .btlink').each(function () {
			var text = $(this).text().replace(/\s+/g, ' ').trim();
			if (text && text.length <= 80 && UPGRADE_RE.test(text)) {
				$(this).remove();
			}
		});

		$('.alert').each(function () {
			var text = $(this).text() || '';
			if (/upgrade to pro|upgrade to pro edition|professional version|buy now/i.test(text)) {
				$(this).remove();
			}
		});
	}

	if (typeof $ !== 'undefined') {
		$(stripCommercialUi);
		$(document).ajaxComplete(stripCommercialUi);
		setInterval(stripCommercialUi, 1500);
	}
})();
