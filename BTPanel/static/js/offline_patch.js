/**
 * Offline / private mode: disable aaPanel account binding and Pro upgrade UI.
 * Enabled when config/config.json has "offline_mode": true
 */
(function () {
	if (typeof bt === 'undefined') return;

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
		if (bt.soft.pro) {
			bt.soft.pro.create_order = function (data, callback) {
				if (callback) callback({ status: false, msg: 'Offline mode' });
			};
		}
	}

	if (typeof product_recommend !== 'undefined') {
		product_recommend.pay_product_sign = noop;
		if (product_recommend.recommend_product_view) {
			product_recommend.recommend_product_view = noop;
		}
	}

	function stripCommercialUi() {
		$(
			'#updata_pro_info, .product-buy, .authState, .bind-user, .daily-product-buy, .openLtd, #is_ltd, .btpro-free, .btpro-gray, .updata_pro'
		).remove();
	}

	if (typeof $ !== 'undefined') {
		$(stripCommercialUi);
		$(document).ajaxComplete(stripCommercialUi);
	}
})();
