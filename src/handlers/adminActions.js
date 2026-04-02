const config = require("../config");
const orderService = require("../services/orderService");
const productService = require("../services/productService");
const userService = require("../services/userService");
const { deliverOrder } = require("./paymentConfirm");
const { formatPrice } = require("../utils/keyboard");
const { Markup } = require("telegraf");
const fs = require("fs");
const path = require("path");

// Admin state per user (for multi-step flows)
const adminState = {};

function isAdmin(ctx) {
  return ctx.from.id === config.ADMIN_ID;
}

function adminOnly(ctx, next) {
  if (!isAdmin(ctx)) {
    return ctx.replyWithHTML("⛔ you are not admin");
  }
  return next();
}

module.exports = (bot) => {
  // ═══════════════════════════════════════
  // /admin - Admin Panel (Main Menu)
  // ═══════════════════════════════════════
  bot.command("admin", adminOnly, (ctx) => {
    const stats = orderService.getStats();
    ctx.replyWithHTML(
      `🔧 <b>ADMIN PANEL — ${config.SHOP_NAME}</b>\n\n` +
        `📊 <b>Quick Stats:</b>\n` +
        `├ 👥 Users: ${stats.totalUsers}\n` +
        `├ 📦 Completed Orders: ${stats.totalOrders}\n` +
        `├ 💰 Revenue: ${formatPrice(stats.totalRevenue)}\n` +
        `├ ⏳ Pending Orders: ${stats.pendingOrders}\n` +
        `└ 🏪 Stock: ${stats.totalStock}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📦 <b>PRODUCT MANAGEMENT:</b>\n` +
        `/listproduct — View all products\n` +
        `/addproduct — Add new product\n` +
        `/editprice [ID] [price] — Edit price\n` +
        `/editname [ID] [name] — Edit name\n` +
        `/toggleproduct [ID] — Enable/disable product\n` +
        `/deleteproduct [ID] — Delete product\n\n` +
        `📋 <b>INVENTORY MANAGEMENT:</b>\n` +
        `/addstock [ID] — Add accounts to inventory\n` +
        `/viewstock [ID] — View product inventory\n` +
        `/clearstock [ID] — Clear all unsold stock\n\n` +
        `💰 <b>ORDERS & PAYMENT:</b>\n` +
        `/pending — View pending orders\n` +
        `/confirm [orderID] — Confirm & deliver\n` +
        `/cancelorder [orderID] — Cancel order\n` +
        `/orders — View all orders\n\n` +
        `🏦 <b>SETTINGS:</b>\n` +
        `/setbank — View bank information\n` +
        `/setshop — View/edit shop information\n\n` +
        `📊 <b>GOOGLE SHEET & OTHER:</b>\n` +
        `/sync — 🔄 Sync products from Google Sheet\n` +
        `/stats — Detailed statistics\n` +
        `/users — View user list\n` +
        `/broadcast — Send broadcast to all users`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback("📦 Products", "adm_products"),
          Markup.button.callback("⏳ Pending Orders", "adm_pending"),
        ],
        [
          Markup.button.callback("🔄 Sync Sheet", "adm_sync"),
          Markup.button.callback("📊 Statistics", "adm_stats"),
        ],
      ]),
    );
  });

  // Admin button callbacks
  bot.action("adm_products", (ctx) => {
    if (isAdmin(ctx)) {
      ctx.answerCbQuery();
      showProductList(ctx);
    }
  });
  bot.action("adm_pending", (ctx) => {
    if (isAdmin(ctx)) {
      ctx.answerCbQuery();
      showPending(ctx);
    }
  });
  bot.action("adm_stats", (ctx) => {
    if (isAdmin(ctx)) {
      ctx.answerCbQuery();
      showStats(ctx);
    }
  });
  bot.action("adm_sync", async (ctx) => {
    if (!isAdmin(ctx)) return;
    ctx.answerCbQuery("🔄 Đang sync...");
    await runSync(ctx);
  });

  // /sync - Manual sync from Google Sheet
  bot.command("sync", adminOnly, async (ctx) => {
    await runSync(ctx);
  });

  async function runSync(ctx) {
    const { syncFromSheet, SYNC_INTERVAL } = require("../services/sheetSync");
    if (!process.env.GOOGLE_SHEET_ID) {
      return ctx.replyWithHTML(
        `❌ <b>Google Sheet not configured!</b>\n\n` +
          `Add <code>GOOGLE_SHEET_ID</code> to .env file\n\n` +
          `📋 Instructions:\n` +
          `1. Open Google Sheet\n` +
          `2. File → Share → Publish to web → Publish\n` +
          `3. Copy Sheet ID from URL:\n` +
          `   <code>docs.google.com/spreadsheets/d/<b>[SHEET_ID]</b>/edit</code>\n` +
          `4. Add to .env:\n` +
          `   <code>GOOGLE_SHEET_ID=your_sheet_id</code>\n` +
          `5. Restart bot`,
      );
    }

    await ctx.replyWithHTML("🔄 Đang đồng bộ từ Google Sheet...");
    const result = await syncFromSheet();

    if (result && !result.error) {
      ctx.replyWithHTML(
        `✅ <b>Sync successful!</b>\n\n` +
          `├ ✏️ Updated: ${result.updated} products\n` +
          `├ ➕ Added: ${result.added} products\n` +
          `└ 📊 Total: ${result.total} products\n\n` +
          `🔄 Auto-sync every ${SYNC_INTERVAL} minutes`,
      );
    } else {
      ctx.replyWithHTML(
        `❌ Sync error: ${result?.error || "Unknown error"}\n\n💡 Check if Sheet is "Published to web".`,
      );
    }
  }

  // ═══════════════════════════════════════
  // QUẢN LÝ SẢN PHẨM
  // ═══════════════════════════════════════

  // /listproduct - List all products with IDs
  bot.command("listproduct", adminOnly, (ctx) => {
    showProductList(ctx);
  });

  // /addproduct - Add new product (interactive)
  bot.command("addproduct", adminOnly, (ctx) => {
    const argsText = ctx.message.text.replace("/addproduct", "").trim();
    const parts = argsText.split("|").map((s) => s.trim());

    if (parts.length < 3 || !parts[0]) {
      const categories = productService.getCategories();
      let catList = categories
        .map((c) => `  ${c.id}. ${c.emoji} ${c.name}`)
        .join("\n");
      return ctx.replyWithHTML(
        `➕ <b>ADD PRODUCT</b>\n\n` +
          `Usage:\n` +
          `<code>/addproduct catID | name | price</code>\n\n` +
          `Example:\n` +
          `<code>/addproduct 1 | ChatGPT Plus 3 months | 20000</code>\n\n` +
          `📂 <b>Categories:</b>\n${catList}\n\n` +
          `💡 Add category: <code>/addcategory name | emoji</code>`,
      );
    }

    const [catId, name, priceStr] = parts;
    const price = parseInt(priceStr);
    if (isNaN(price)) return ctx.reply("❌ Price must be a number.");

    const id = productService.addProduct(parseInt(catId), name, price);
    ctx.replyWithHTML(
      `✅ Product added:\n` +
        `├ ID: <b>#${id}</b>\n` +
        `├ Name: ${name}\n` +
        `├ Price: ${formatPrice(price)}\n` +
        `└ Category: #${catId}\n\n` +
        `👉 Add inventory: <code>/addstock ${id}</code>`,
    );
  });

  // /addcategory - Add new category
  bot.command("addcategory", adminOnly, (ctx) => {
    const argsText = ctx.message.text.replace("/addcategory", "").trim();
    const parts = argsText.split("|").map((s) => s.trim());

    if (parts.length < 1 || !parts[0]) {
      return ctx.replyWithHTML(
        "Usage: <code>/addcategory name | emoji</code>\nExample: <code>/addcategory Netflix | 🎬</code>",
      );
    }

    const name = parts[0];
    const emoji = parts[1] || "📦";
    const db = require("../database");
    const result = db
      .prepare(
        "INSERT INTO categories (name, emoji, sort_order) VALUES (?, ?, ?)",
      )
      .run(name, emoji, 99);
    ctx.replyWithHTML(
      `✅ Category added #${result.lastInsertRowid}: ${emoji} ${name}`,
    );
  });

  // /editprice [ID] [price] - Edit product price
  bot.command("editprice", adminOnly, (ctx) => {
    const args = ctx.message.text.split(" ");
    if (args.length < 3) {
      return ctx.replyWithHTML(
        "Usage: <code>/editprice [productID] [new price]</code>\nExample: <code>/editprice 1 10000</code>",
      );
    }

    const productId = parseInt(args[1]);
    const newPrice = parseInt(args[2]);
    const product = productService.getById(productId);
    if (!product) return ctx.reply("❌ Product not found");

    const db = require("../database");
    db.prepare("UPDATE products SET price = ? WHERE id = ?").run(
      newPrice,
      productId,
    );
    ctx.replyWithHTML(
      `✅ Price updated:\n` +
        `├ Product: ${product.name}\n` +
        `├ Old price: ${formatPrice(product.price)}\n` +
        `└ New price: <b>${formatPrice(newPrice)}</b>`,
    );
  });

  // /editname [ID] [name] - Edit product name
  bot.command("editname", adminOnly, (ctx) => {
    const match = ctx.message.text.match(/^\/editname\s+(\d+)\s+(.+)$/);
    if (!match) {
      return ctx.replyWithHTML(
        "Usage: <code>/editname [productID] [new name]</code>\nExample: <code>/editname 1 ChatGPT Plus 1 month new</code>",
      );
    }

    const productId = parseInt(match[1]);
    const newName = match[2].trim();
    const product = productService.getById(productId);
    if (!product) return ctx.reply("❌ Product not found");

    const db = require("../database");
    db.prepare("UPDATE products SET name = ? WHERE id = ?").run(
      newName,
      productId,
    );
    ctx.replyWithHTML(
      `✅ Name changed:\n` +
        `├ Old: ${product.name}\n` +
        `└ New: <b>${newName}</b>`,
    );
  });

  // /toggleproduct [ID] - Toggle product active/inactive
  bot.command("toggleproduct", adminOnly, (ctx) => {
    const args = ctx.message.text.split(" ");
    if (args.length < 2)
      return ctx.replyWithHTML(
        "Usage: <code>/toggleproduct [productID]</code>",
      );

    const productId = parseInt(args[1]);
    const product = productService.getById(productId);
    if (!product) return ctx.reply("❌ Product not found");

    const newState = product.is_active ? 0 : 1;
    const db = require("../database");
    db.prepare("UPDATE products SET is_active = ? WHERE id = ?").run(
      newState,
      productId,
    );
    ctx.replyWithHTML(
      `✅ Product <b>${product.name}</b>: ${newState ? "🟢 ENABLED" : "🔴 DISABLED"}`,
    );
  });

  // /deleteproduct [ID] - Delete product
  bot.command("deleteproduct", adminOnly, (ctx) => {
    const args = ctx.message.text.split(" ");
    if (args.length < 2)
      return ctx.replyWithHTML(
        "Usage: <code>/deleteproduct [productID]</code>",
      );

    const productId = parseInt(args[1]);
    const product = productService.getById(productId);
    if (!product) return ctx.reply("❌ Product not found");

    const db = require("../database");
    db.prepare("DELETE FROM stock WHERE product_id = ? AND is_sold = 0").run(
      productId,
    );
    db.prepare("DELETE FROM products WHERE id = ?").run(productId);
    ctx.replyWithHTML(`🗑️ Deleted product: <b>${product.name}</b>`);
  });

  // ═══════════════════════════════════════
  // QUẢN LÝ KHO
  // ═══════════════════════════════════════

  // /addstock [ID] - Add stock items
  bot.command("addstock", adminOnly, (ctx) => {
    const args = ctx.message.text.split(" ");
    if (args.length < 2) {
      // List products so admin can see IDs
      const products = productService.getAll();
      let list = products
        .map((p) => `  #${p.id} ${p.name} (stock: ${p.stock_count})`)
        .join("\n");
      return ctx.replyWithHTML(
        `📦 <b>ADD ACCOUNTS TO INVENTORY</b>\n\n` +
          `Usage: <code>/addstock [productID]</code>\n\n` +
          `Then send the account list (one per line).\n\n` +
          `📋 <b>Products:</b>\n${list}`,
      );
    }

    const productId = parseInt(args[1]);
    const product = productService.getById(productId);
    if (!product) return ctx.reply("❌ Product not found");

    // Set admin waiting state
    adminState[ctx.from.id] = { action: "addstock", productId };
    ctx.replyWithHTML(
      `📦 Add accounts for: <b>${product.name}</b>\n` +
        `📊 Current stock: ${product.stock_count}\n\n` +
        `👇 Send account list now (one per line):\n\n` +
        `<i>Example:</i>\n` +
        `<code>email1@outlook.com|pass1|chatgpt_pass1\nemail2@outlook.com|pass2|chatgpt_pass2</code>\n\n` +
        `Type /cancel to cancel.`,
    );
  });

  // /viewstock [ID] - View stock details
  bot.command("viewstock", adminOnly, (ctx) => {
    const args = ctx.message.text.split(" ");
    if (args.length < 2) {
      const products = productService.getAll();
      let list = products
        .map((p) => `  #${p.id} ${p.name} — 📦 ${p.stock_count} items`)
        .join("\n");
      return ctx.replyWithHTML(
        `🏪 <b>INVENTORY</b>\n\n${list}\n\n💡 View details: <code>/viewstock [ID]</code>`,
      );
    }

    const productId = parseInt(args[1]);
    const product = productService.getById(productId);
    if (!product) return ctx.reply("❌ Product not found");

    const db = require("../database");
    const items = db
      .prepare(
        "SELECT * FROM stock WHERE product_id = ? AND is_sold = 0 LIMIT 20",
      )
      .all(productId);

    if (items.length === 0) {
      return ctx.replyWithHTML(
        `📦 <b>${product.name}</b>\n\n❌ Empty inventory!`,
      );
    }

    let text = `📦 <b>${product.name}</b> — ${product.stock_count} items\n\n`;
    items.forEach((item, i) => {
      text += `${i + 1}. <code>${item.data}</code>\n`;
    });
    if (product.stock_count > 20) {
      text += `\n... and ${product.stock_count - 20} more items`;
    }

    ctx.replyWithHTML(text);
  });

  // /clearstock [ID] - Clear unsold stock
  bot.command("clearstock", adminOnly, (ctx) => {
    const args = ctx.message.text.split(" ");
    if (args.length < 2)
      return ctx.replyWithHTML("Usage: <code>/clearstock [productID]</code>");

    const productId = parseInt(args[1]);
    const product = productService.getById(productId);
    if (!product) return ctx.reply("❌ Product not found");

    const db = require("../database");
    const result = db
      .prepare("DELETE FROM stock WHERE product_id = ? AND is_sold = 0")
      .run(productId);
    ctx.replyWithHTML(
      `🗑️ Deleted <b>${result.changes}</b> unsold accounts from <b>${product.name}</b>`,
    );
  });

  // ═══════════════════════════════════════
  // ORDERS
  // ═══════════════════════════════════════

  // /confirm {orderID}
  bot.command("confirm", adminOnly, async (ctx) => {
    const args = ctx.message.text.split(" ");
    if (args.length < 2) return ctx.reply("Usage: /confirm [orderID]");

    const orderId = parseInt(args[1]);
    const result = await deliverOrder(bot, orderId);

    if (result.success) {
      ctx.replyWithHTML(
        `✅ Order <b>#${orderId}</b> confirmed & delivered successfully!`,
      );
    } else {
      ctx.replyWithHTML(`❌ Error: ${result.error}`);
    }
  });

  // /pending - View pending orders
  bot.command("pending", adminOnly, (ctx) => {
    showPending(ctx);
  });

  // /cancelorder [ID]
  bot.command("cancelorder", adminOnly, (ctx) => {
    const args = ctx.message.text.split(" ");
    if (args.length < 2)
      return ctx.replyWithHTML("Usage: <code>/cancelorder [orderID]</code>");

    const orderId = parseInt(args[1]);
    orderService.cancel(orderId);
    ctx.replyWithHTML(`❌ Order <b>#${orderId}</b> cancelled`);
  });

  // /orders - View all orders
  bot.command("orders", adminOnly, (ctx) => {
    const db = require("../database");
    const orders = db
      .prepare(
        `
      SELECT o.*, p.name as product_name, u.full_name as user_name
      FROM orders o
      JOIN products p ON o.product_id = p.id
      JOIN users u ON o.user_id = u.telegram_id
      ORDER BY o.created_at DESC
      LIMIT 20
    `,
      )
      .all();

    if (orders.length === 0) return ctx.reply("📋 No orders yet.");

    let text = `📋 <b>RECENT ORDERS (${orders.length})</b>\n\n`;
    const statusEmoji = {
      pending: "⏳",
      paid: "💵",
      delivered: "✅",
      cancelled: "❌",
    };
    orders.forEach((o) => {
      text += `${statusEmoji[o.status] || "❓"} <b>#${o.id}</b> | ${o.user_name}\n`;
      text += `  ${o.product_name} × ${o.quantity} = ${formatPrice(o.total_price)}\n`;
      text += `  📅 ${o.created_at}\n\n`;
    });

    ctx.replyWithHTML(text);
  });

  // ═══════════════════════════════════════
  // PAYMENT & SHOP SETTINGS
  // ═══════════════════════════════════════

  // /setbank - View bank info (fixed to Techcombank)
  bot.command("setbank", adminOnly, (ctx) => {
    ctx.replyWithHTML(
      `🏦 <b>BANK INFORMATION</b>\n\n` +
        `├ Bank: <b>${config.BANK.NAME}</b>\n` +
        `├ BIN: <code>${config.BANK.BIN}</code>\n` +
        `├ Account Number: <code>${config.BANK.ACCOUNT}</code>\n` +
        `└ Account Name: <b>${config.BANK.ACCOUNT_NAME}</b>\n\n` +
        `✅ VietQR payment uses the above information.`,
    );
  });

  // /setshop - Edit shop name & support
  bot.command("setshop", adminOnly, (ctx) => {
    const argsText = ctx.message.text.replace("/setshop", "").trim();

    if (!argsText) {
      return ctx.replyWithHTML(
        `🏪 <b>SHOP INFORMATION</b>\n\n` +
          `├ Name: <b>${config.SHOP_NAME}</b>\n` +
          `└ Support: ${config.SUPPORT_CONTACT}\n\n` +
          `✏️ To edit:\n` +
          `<code>/setshop shop name | @support_contact</code>`,
      );
    }

    const parts = argsText.split("|").map((s) => s.trim());
    const shopName = parts[0];
    const support = parts[1] || config.SUPPORT_CONTACT;

    const envPath = path.join(__dirname, "..", "..", ".env");
    let envContent = fs.readFileSync(envPath, "utf8");
    envContent = envContent.replace(/SHOP_NAME=.*/, `SHOP_NAME=${shopName}`);
    envContent = envContent.replace(
      /SUPPORT_CONTACT=.*/,
      `SUPPORT_CONTACT=${support}`,
    );
    fs.writeFileSync(envPath, envContent);

    config.SHOP_NAME = shopName;
    config.SUPPORT_CONTACT = support;

    ctx.replyWithHTML(
      `✅ Updated:\n├ Shop: <b>${shopName}</b>\n└ Support: ${support}`,
    );
  });

  // ═══════════════════════════════════════
  // STATISTICS & USERS
  // ═══════════════════════════════════════

  // /stats - Detailed stats
  bot.command("stats", adminOnly, (ctx) => {
    showStats(ctx);
  });

  // /users - List users
  bot.command("users", adminOnly, (ctx) => {
    const db = require("../database");
    const users = db
      .prepare("SELECT * FROM users ORDER BY created_at DESC LIMIT 20")
      .all();

    let text = `👥 <b>RECENT USERS (${users.length})</b>\n\n`;
    users.forEach((u) => {
      text += `🆔 <code>${u.telegram_id}</code> | ${u.full_name}`;
      if (u.username) text += ` (@${u.username})`;
      text += `\n  💰 ${formatPrice(u.balance)} | 📅 ${u.created_at}\n\n`;
    });

    ctx.replyWithHTML(text);
  });

  // /broadcast - Send message to all users
  bot.command("broadcast", adminOnly, (ctx) => {
    const msg = ctx.message.text.replace("/broadcast", "").trim();

    if (!msg) {
      adminState[ctx.from.id] = { action: "broadcast" };
      return ctx.replyWithHTML(
        `📢 <b>SEND BROADCAST</b>\n\n` +
          `Send the broadcast message now.\n` +
          `Supports HTML formatting.\n\n` +
          `Type /cancel to cancel.`,
      );
    }

    sendBroadcast(ctx, bot, msg);
  });

  // /cancel - Cancel current admin action
  bot.command("cancel", (ctx) => {
    if (adminState[ctx.from.id]) {
      delete adminState[ctx.from.id];
      ctx.reply("❌ Action cancelled.");
    }
  });

  // ═══════════════════════════════════════
  // TEXT HANDLER - for multi-step admin flows
  // ═══════════════════════════════════════
  bot.on("text", async (ctx, next) => {
    if (!isAdmin(ctx)) return next();

    const state = adminState[ctx.from.id];
    if (!state) return next();

    // Handle addstock text input
    if (state.action === "addstock") {
      delete adminState[ctx.from.id];

      const lines = ctx.message.text.split("\n").filter((l) => l.trim());
      if (lines.length === 0) return ctx.reply("❌ No data provided.");

      productService.addStock(state.productId, lines);
      const product = productService.getById(state.productId);

      ctx.replyWithHTML(
        `✅ <b>Added ${lines.length} accounts!</b>\n\n` +
          `├ Product: ${product.name}\n` +
          `└ 📦 Stock: <b>${product.stock_count}</b>`,
      );
      return;
    }

    // Handle broadcast text input
    if (state.action === "broadcast") {
      delete adminState[ctx.from.id];
      sendBroadcast(ctx, bot, ctx.message.text);
      return;
    }

    // Handle manual delivery: admin provides account info
    if (state.action === "deliver_order") {
      delete adminState[ctx.from.id];

      const accountData = ctx.message.text.trim();
      const accounts = accountData.split("\n").filter((l) => l.trim());

      // Mark order as delivered
      orderService.manualDeliver(state.orderId);

      // Decrease sheet_stock in DB
      const db = require("../database");
      db.prepare(
        "UPDATE products SET sheet_stock = MAX(sheet_stock - ?, 0) WHERE id = (SELECT product_id FROM orders WHERE id = ?)",
      ).run(state.quantity, state.orderId);

      // Build success message for customer
      let customerMsg =
        `✅ <b>ORDER SUCCESSFUL!</b>\n\n` +
        `📦 ${state.productName} × ${state.quantity}\n\n` +
        `🔑 <b>Account Information:</b>\n`;

      accounts.forEach((acc, i) => {
        customerMsg += `${i + 1})\n<code>${acc}</code>\n`;
      });

      customerMsg +=
        `\n📖 <b>Instructions:</b> email | password_email | password_chatgpt\n` +
        `log into outlook.com to get the code`;

      // Send to customer
      try {
        await bot.telegram.sendMessage(state.userId, customerMsg, {
          parse_mode: "HTML",
        });
        ctx.replyWithHTML(
          `✅ <b>Order #${state.orderId} delivered!</b>\n\n` +
            `📦 ${state.productName} × ${state.quantity}\n` +
            `👤 Sent to customer: <code>${state.userId}</code>`,
        );
      } catch (err) {
        ctx.replyWithHTML(`❌ Could not send to customer: ${err.message}`);
      }
      return;
    }

    return next();
  });

  // ═══════════════════════════════════════
  // HELPER FUNCTIONS
  // ═══════════════════════════════════════

  function showProductList(ctx) {
    const db = require("../database");
    const products = db
      .prepare(
        `
      SELECT p.id as product_id, p.name, p.price, p.emoji, p.promotion, p.contact_only, p.is_active, p.category_id,
        c.name as cat_name, c.emoji as cat_emoji,
        (SELECT COUNT(*) FROM stock s WHERE s.product_id = p.id AND s.is_sold = 0) as stock_count
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ORDER BY p.category_id, p.id
    `,
      )
      .all();

    if (products.length === 0) return ctx.reply("❌ No products found.");

    let text = `📦 <b>ALL PRODUCTS</b>\n\n`;
    let currentCat = null;

    products.forEach((p) => {
      if (p.category_id !== currentCat) {
        currentCat = p.category_id;
        text += `\n${p.cat_emoji || "📂"} <b>${p.cat_name || "General"}</b>\n`;
      }

      const status = p.is_active ? "🟢" : "🔴";
      text += `${status} <b>ID:${p.product_id}</b> | ${p.name}\n`;
      text += `     💰 ${formatPrice(p.price)} | 📦 Stock: ${p.stock_count}`;
      if (p.contact_only) text += ` | 💬 Contact only`;
      if (p.promotion) text += ` | ${p.promotion}`;
      text += `\n`;
    });

    text += `\n━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `💡 Use the ID above for commands:\n`;
    text += `/addstock [ID] | /editprice [ID] [price]\n`;
    text += `/editname [ID] [name] | /viewstock [ID]`;

    ctx.replyWithHTML(text);
  }

  function showPending(ctx) {
    const orders = orderService.getAllPending();
    if (orders.length === 0) return ctx.reply("✅ No pending orders!");

    let text = `⏳ <b>PENDING ORDERS (${orders.length})</b>\n\n`;
    orders.forEach((o) => {
      text +=
        `📌 <b>#${o.id}</b> | ${o.user_name}\n` +
        `  📦 ${o.product_name} × ${o.quantity}\n` +
        `  💰 ${formatPrice(o.total_price)}\n` +
        `  🔑 <code>${o.payment_code}</code>\n` +
        `  📅 ${o.created_at}\n` +
        `  → <code>/confirm ${o.id}</code>\n\n`;
    });

    ctx.replyWithHTML(text);
  }

  function showStats(ctx) {
    const stats = orderService.getStats();
    const db = require("../database");
    const todayOrders = db
      .prepare(
        "SELECT COUNT(*) as c, COALESCE(SUM(total_price),0) as s FROM orders WHERE status='delivered' AND date(delivered_at)=date('now')",
      )
      .get();

    ctx.replyWithHTML(
      `📊 <b>DETAILED STATISTICS</b>\n\n` +
        `<b>Overview:</b>\n` +
        `├ 👥 Users: ${stats.totalUsers}\n` +
        `├ 📦 Completed Orders: ${stats.totalOrders}\n` +
        `├ 💰 Total Revenue: ${formatPrice(stats.totalRevenue)}\n` +
        `├ ⏳ Pending Orders: ${stats.pendingOrders}\n` +
        `└ 🏪 Total Stock: ${stats.totalStock}\n\n` +
        `<b>Today:</b>\n` +
        `├ 📦 Orders: ${todayOrders.c}\n` +
        `└ 💰 Revenue: ${formatPrice(todayOrders.s)}`,
    );
  }

  function showBank(ctx) {
    ctx.replyWithHTML(
      `🏦 <b>BANK INFORMATION</b>\n\n` +
        `├ Bank: <b>${config.BANK.NAME}</b>\n` +
        `├ BIN: <code>${config.BANK.BIN}</code>\n` +
        `├ Account Number: <code>${config.BANK.ACCOUNT}</code>\n` +
        `└ Account Name: <b>${config.BANK.ACCOUNT_NAME}</b>\n\n` +
        `✏️ Edit: <code>/setbank BIN | AccountNumber | AccountName | BankName</code>`,
    );
  }

  async function sendBroadcast(ctx, bot, message) {
    const db = require("../database");
    const users = db.prepare("SELECT telegram_id FROM users").all();

    let sent = 0;
    let failed = 0;

    await ctx.reply(`📢 Sending to ${users.length} users...`);

    for (const user of users) {
      try {
        await bot.telegram.sendMessage(user.telegram_id, message, {
          parse_mode: "HTML",
        });
        sent++;
      } catch (err) {
        failed++;
      }
    }

    ctx.replyWithHTML(
      `📢 <b>Broadcast complete!</b>\n├ ✅ Success: ${sent}\n└ ❌ Failed: ${failed}`,
    );
  }
};

// Export setAdminState so other handlers can set admin state
module.exports.setAdminState = (userId, state) => {
  adminState[userId] = state;
};
