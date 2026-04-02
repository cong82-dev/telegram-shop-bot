const config = require("../config");
const { formatPrice } = require("./keyboard");

const SHOP = config.SHOP_NAME;

const messages = {
  welcome: (name) =>
    `👋 Welcome <b>${name}</b> to <b>${SHOP}</b>!\n\n` +
    `🛒 We provide affordable Premium accounts\n\n` +
    `📋 <b>Command list:</b>\n` +
    `/start — 🔄 Start / Restart\n` +
    `/menu — 👤 Account info\n` +
    `/product — 📦 Product list\n` +
    `/nap — 💰 Top up balance\n` +
    `/checkpay — 🔍 Check payment\n` +
    `/support — 🆘 Support\n` +
    `/myid — 🆔 Get your ID`,

  accountInfo: (user) =>
    `👤 <b>Account info</b>\n\n` +
    `🆔 ID: <code>${user.telegram_id}</code>\n` +
    `👤 Name: ${user.full_name}\n` +
    `💰 Balance: <b>${formatPrice(user.balance)}</b>\n` +
    `📅 Joined: ${user.created_at}`,

  productHeader: "👇 👇 👇  Select the product you want to buy below:",

  selectQuantity: (product) =>
    `📦 <b>${product.name}</b>\n` +
    `💰 Price: ${formatPrice(product.price)} each\n` +
    `📊 Remaining: ${product.display_stock || product.stock_count} items\n\n` +
    `Select quantity to buy:`,

  contactOnly: (product) =>
    `📦 <b>${product.name}</b>\n\n` +
    `💰 Price: ${formatPrice(product.price)}\n` +
    (product.promotion ? `📋 ${product.promotion}\n` : "") +
    `Please contact below to purchase.\n\n` +
    `💬 This product requires direct contact to buy.\n` +
    `Press the button below to see contact info.`,

  paymentQR: (order, product, paymentCode) =>
    `⏳ <b>Waiting for payment ${formatPrice(order.total_price)}...</b>\n\n` +
    `Scan the QR code above to transfer.\n\n` +
    `💰 <b>ORDER PAYMENT</b>\n\n` +
    `📦 Product: ${product.name}\n` +
    `📊 Quantity: ${order.quantity}\n` +
    `💵 Total: <b>${formatPrice(order.total_price)}</b>\n\n` +
    `━━━━━━━━━━━━━━━━━\n\n` +
    `🏦 Scan the QR to transfer\n` +
    `├ Amount: <b>${formatPrice(order.total_price)}</b>\n` +
    `└ Note: <code>${paymentCode}</code>`,

  orderSuccess: (product, quantity, accounts) => {
    let msg =
      `✅ <b>ORDER SUCCESSFUL!</b>\n\n` +
      `📦 ${product.name} × ${quantity}\n\n` +
      `🔑 <b>Account info:</b>\n`;

    accounts.forEach((acc, i) => {
      msg += `${i + 1})\n<code>${acc}</code>\n`;
    });

    msg +=
      `\n📖 <b>Note:</b> maill | passmail | passchatgpt\n` +
      `Login to outlook.com to get the code.`;

    return msg;
  },

  orderSuccessNotify: (quantity) =>
    `✅ Successfully purchased ${quantity} accounts! Check your messages below.`,

  noStock: "❌ Sorry, the product is out of stock. Please try again later.",

  invalidQuantity: (available) =>
    `❌ Not enough stock. Only ${available} items left.`,

  napInfo: (amount, paymentCode) =>
    `💰 <b>TOP UP BALANCE</b>\n\n` +
    `Scan the QR code to top up ${formatPrice(amount)} to your balance.\n\n` +
    `🏦 Scan the QR to transfer\n` +
    `├ Amount: <b>${formatPrice(amount)}</b>\n` +
    `└ Note: <code>${paymentCode}</code>`,

  checkPayStatus: (order) => {
    const statusMap = {
      pending: "⏳ Waiting for payment",
      paid: "💵 Paid",
      delivered: "✅ Delivered",
      cancelled: "❌ Cancelled",
    };
    return (
      `🔍 <b>Order status #${order.id}</b>\n\n` +
      `📦 Product: ${order.product_name}\n` +
      `📊 Quantity: ${order.quantity}\n` +
      `💵 Total: ${formatPrice(order.total_price)}\n` +
      `📋 Status: ${statusMap[order.status] || order.status}\n` +
      `📅 Created at: ${order.created_at}`
    );
  },

  supportInfo:
    `🆘 <b>SUPPORT</b>\n\n` +
    `If you have any issues, contact:\n` +
    `👉 ${config.SUPPORT_CONTACT}\n\n` +
    `⏰ Support available 24/7`,

  myId: (id) => `🆔 <b>Your Telegram ID:</b>\n<code>${id}</code>`,

  adminOnly: "⛔ You do not have permission to use this command.",

  orderCancelled: "❌ Order has been cancelled.",

  paymentPending:
    "⏳ Payment not received yet. Please wait or contact support.",
};

module.exports = messages;
