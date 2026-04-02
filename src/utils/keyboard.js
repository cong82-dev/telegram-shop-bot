const { Markup } = require("telegraf");

/**
 * Build product list keyboard
 */
function productListKeyboard(products) {
  const buttons = products.map((p) => {
    const stock = p.display_stock || p.stock_count;
    let label = `${p.emoji} ${p.name} - ${formatPrice(p.price)}`;

    if (p.contact_only && stock === 0) {
      label += ` — 📬 Liên hệ`;
    } else {
      label += ` (Còn: ${stock})`;
    }

    if (p.promotion) {
      label += ` ${p.promotion}`;
    }

    return [Markup.button.callback(label, `product_${p.id}`)];
  });

  buttons.push([Markup.button.callback("🔄 Làm mới", "refresh_products")]);

  return Markup.inlineKeyboard(buttons);
}

/**
 * Build quantity selection keyboard
 */
function quantityKeyboard(productId, maxQty = 10) {
  const max = Math.min(maxQty, 10);
  const rows = [];
  let row = [];

  for (let i = 1; i <= max; i++) {
    row.push(Markup.button.callback(`${i}`, `qty_${productId}_${i}`));
    if (row.length === 5) {
      rows.push(row);
      row = [];
    }
  }
  if (row.length > 0) rows.push(row);

  rows.push([Markup.button.callback("❌ Cancel", "cancel_order")]);

  return Markup.inlineKeyboard(rows);
}

/**
 * Build order confirmation keyboard
 */
function orderConfirmKeyboard(orderId) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("✅ Paid", `check_paid_${orderId}`)],
    [Markup.button.callback("❌ Cancel Order", `cancel_order_${orderId}`)],
  ]);
}

/**
 * Build post-delivery keyboard
 */
function postDeliveryKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("📊 Data", "data_main"),
      Markup.button.callback("🔄 Buy Again", "buy_again"),
    ],
    [Markup.button.callback("📋 Back to List", "refresh_products")],
  ]);
}

/**
 * Format price in VND
 */
function formatPrice(amount) {
  return new Intl.NumberFormat("vi-VN").format(amount) + "đ";
}

/**
 * Main menu keyboard (reply keyboard)
 */
function mainMenuKeyboard() {
  return Markup.keyboard([
    ["📦 Products", "💰 Top Up"],
    ["🔍 Check Payment", "👤 Account"],
    ["🆘 Support"],
  ]).resize();
}

module.exports = {
  productListKeyboard,
  quantityKeyboard,
  orderConfirmKeyboard,
  postDeliveryKeyboard,
  formatPrice,
  mainMenuKeyboard,
};
