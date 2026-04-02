const paymentService = require("../services/paymentService");
const messages = require("../utils/messages");
const { formatPrice } = require("../utils/keyboard");

module.exports = (bot) => {
  bot.command("nap", (ctx) => {
    const text = ctx.message.text.split(" ");
    if (text.length < 2 || isNaN(text[1])) {
      return ctx.replyWithHTML(
        "💰 <b>TOP UP BALANCE</b>\n\n" +
          "Usage: /nap [amount]\n" +
          "Example: /nap 50000\n\n" +
          "💡 Minimum amount: 10,000 VND",
      );
    }

    const amount = parseInt(text[1]);
    if (amount < 10000) {
      return ctx.reply("❌ Minimum amount is 10,000 VND");
    }

    const payment = paymentService.generatePayment(amount);

    // Send QR image
    ctx.replyWithPhoto(payment.qrUrl, {
      caption:
        `💰 <b>TOP UP BALANCE</b>\n\n` +
        `Scan the QR code to top up ${formatPrice(amount)} to your balance.\n\n` +
        `🏦 Scan the QR to transfer\n` +
        `├ Amount: <b>${formatPrice(amount)}</b>\n` +
        `└ Note: <code>${payment.paymentCode}</code>\n\n` +
        `⏳ After transfer, your balance will be updated automatically.`,
      parse_mode: "HTML",
    });
  });
};
