const { Telegraf, session } = require("telegraf");
const config = require("./config");

// Validate token
if (!config.BOT_TOKEN || config.BOT_TOKEN === "your_bot_token_here") {
  console.error("❌ BOT_TOKEN is not configured! Please update the .env file");
  process.exit(1);
}

const bot = new Telegraf(config.BOT_TOKEN);

// Enable session for admin stock input
bot.use(session());

// Error handler
bot.catch((err, ctx) => {
  console.error(`❌ Error for ${ctx.updateType}:`, err.message);
  try {
    ctx.reply("❌ An error occurred. Please try again later.");
  } catch (e) {
    // ignore
  }
});

// Register commands
require("./commands/start")(bot);
require("./commands/menu")(bot);
require("./commands/product")(bot);
require("./commands/nap")(bot);
require("./commands/checkpay")(bot);
require("./commands/support")(bot);
require("./commands/myid")(bot);

// Register handlers
require("./handlers/productSelect")(bot);
require("./handlers/quantitySelect")(bot);
require("./handlers/paymentConfirm")(bot);
require("./handlers/adminActions")(bot);

// Set bot commands for menu
bot.telegram.setMyCommands([
  { command: "start", description: "🔄 Start / Restart" },
  { command: "menu", description: "👤 Account info" },
  { command: "product", description: "📦 Product list" },
  { command: "nap", description: "💰 Top up balance" },
  { command: "checkpay", description: "🔍 Check payment" },
  { command: "support", description: "🆘 Support" },
  { command: "myid", description: "🆔 Get your ID" },
]);

// Launch bot
bot
  .launch()
  .then(() => {
    console.log(`🤖 ${config.SHOP_NAME} Bot started!`);
    console.log(`👤 Admin ID: ${config.ADMIN_ID}`);
    console.log(`🏦 Bank: ${config.BANK.NAME} - ${config.BANK.ACCOUNT}`);

    // Start Google Sheet auto-sync
    const { startAutoSync } = require("./services/sheetSync");
    startAutoSync();
  })
  .catch((err) => {
    console.error("❌ Unable to start bot:", err.message);
    console.error("💡 Check BOT_TOKEN in .env");
    process.exit(1);
  });

// Prevent crash on network errors
process.on("unhandledRejection", (err) => {
  console.error("⚠️ Unhandled rejection (ignored):", err.message || err);
});
process.on("uncaughtException", (err) => {
  console.error("⚠️ Uncaught exception:", err.message || err);
  if (err.code === "ECONNRESET" || err.code === "ETIMEDOUT") {
    console.log("🔄 Network error, bot continues running...");
    return; // Don't crash on network errors
  }
  process.exit(1);
});

// Graceful shutdown
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
