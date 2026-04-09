const { Telegraf, Markup } = require('telegraf');
const { prisma } = require('../services/db');

const bot = new Telegraf(process.env.BOT_TOKEN);
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://your-frontend.vercel.app';

// ─── Auto-register user ───────────────────────────────────────────────────────
bot.use(async (ctx, next) => {
  if (!ctx.from) return next();
  const telegramId = String(ctx.from.id);
  const adminIds = (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(s => s.trim());

  let user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        telegramId,
        username: ctx.from.username,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name,
        role: adminIds.includes(telegramId) ? 'ADMIN' : 'CUSTOMER',
      },
    });
  }
  ctx.dbUser = user;
  return next();
});

// ─── /start ───────────────────────────────────────────────────────────────────
bot.start(async (ctx) => {
  const name = ctx.from.first_name || 'there';
  await ctx.replyWithPhoto(
    { url: 'https://i.imgur.com/placeholder-market.png' },
    {
      caption:
        `👋 Welcome to *Hager Gebeya*, ${name}!\n\n` +
        `🛒 Shop from local vendors\n` +
        `🏷️ Get exclusive discounts\n` +
        `📦 Track your orders\n\n` +
        `Tap the button below to start shopping!`,
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp('🛍️ Open Shop', MINI_APP_URL)],
        [Markup.button.callback('📦 My Orders', 'my_orders')],
        [Markup.button.callback('ℹ️ Help', 'help')],
      ]),
    }
  ).catch(() => {
    // fallback without photo
    ctx.reply(
      `👋 Welcome to *Hager Gebeya*, ${name}!\n\n` +
      `🛒 Shop from local vendors, get discounts, track orders.`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp('🛍️ Open Shop', MINI_APP_URL)],
          [Markup.button.callback('📦 My Orders', 'my_orders')],
          [Markup.button.callback('ℹ️ Help', 'help')],
        ]),
      }
    );
  });
});

// ─── /shop ────────────────────────────────────────────────────────────────────
bot.command('shop', async (ctx) => {
  await ctx.reply('🛍️ Open the shop:', {
    ...Markup.inlineKeyboard([[Markup.button.webApp('Open Hager Gebeya', MINI_APP_URL)]]),
  });
});

// ─── /vendors ────────────────────────────────────────────────────────────────
bot.command('vendors', async (ctx) => {
  const vendors = await prisma.vendor.findMany({
    where: { approved: true, active: true },
    take: 10,
  });
  if (!vendors.length) return ctx.reply('No vendors yet. Check back soon!');

  let text = '🏪 *Active Vendors:*\n\n';
  vendors.forEach((v, i) => {
    text += `${i + 1}. *${v.name}*${v.category ? ` — ${v.category}` : ''}\n`;
    if (v.description) text += `   ${v.description}\n`;
    text += '\n';
  });

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([[Markup.button.webApp('Browse All', MINI_APP_URL)]]),
  });
});

// ─── /orders ─────────────────────────────────────────────────────────────────
bot.command('orders', async (ctx) => {
  await showOrders(ctx);
});

bot.action('my_orders', async (ctx) => {
  await ctx.answerCbQuery();
  await showOrders(ctx);
});

async function showOrders(ctx) {
  const orders = await prisma.order.findMany({
    where: { userId: ctx.dbUser.id },
    include: { vendor: true },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  if (!orders.length) {
    return ctx.reply("You haven't placed any orders yet.\n\nShop now!", {
      ...Markup.inlineKeyboard([[Markup.button.webApp('🛍️ Start Shopping', MINI_APP_URL)]]),
    });
  }

  const statusEmoji = {
    PENDING: '⏳', CONFIRMED: '✅', PREPARING: '👨‍🍳',
    READY: '🎁', DELIVERED: '🏠', CANCELLED: '❌',
  };

  let text = '📦 *Your Recent Orders:*\n\n';
  orders.forEach(order => {
    text += `${statusEmoji[order.status] || '📦'} \`${order.orderNumber}\`\n`;
    text += `   🏪 ${order.vendor.name}\n`;
    text += `   💰 ${order.finalTotal.toFixed(2)} ETB\n`;
    text += `   📅 ${order.createdAt.toLocaleDateString()}\n\n`;
  });

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([[Markup.button.webApp('View All Orders', `${MINI_APP_URL}/orders`)]]),
  });
}

// ─── /become_vendor ──────────────────────────────────────────────────────────
bot.command('become_vendor', async (ctx) => {
  const existing = await prisma.vendor.findUnique({ where: { ownerId: ctx.dbUser.id } });
  if (existing) {
    const status = existing.approved ? '✅ approved' : '⏳ pending approval';
    return ctx.reply(`You already have a vendor account (${status}): *${existing.name}*`, { parse_mode: 'Markdown' });
  }
  await ctx.reply(
    '🏪 *Become a Vendor on Hager Gebeya*\n\n' +
    'Please send your shop details in this format:\n\n' +
    '`/register_vendor ShopName | Description | Category | Phone`\n\n' +
    'Example:\n' +
    '`/register_vendor Abebe Store | Fresh fruits and vegetables | Groceries | 0911234567`',
    { parse_mode: 'Markdown' }
  );
});

bot.command('register_vendor', async (ctx) => {
  const existing = await prisma.vendor.findUnique({ where: { ownerId: ctx.dbUser.id } });
  if (existing) return ctx.reply('You already have a vendor account.');

  const text = ctx.message.text.replace('/register_vendor', '').trim();
  const parts = text.split('|').map(s => s.trim());
  if (parts.length < 2) {
    return ctx.reply('Please provide at least: Name | Description\nExample: `/register_vendor My Shop | Best shop in town`', { parse_mode: 'Markdown' });
  }

  const [name, description, category, phone] = parts;
  if (!name) return ctx.reply('Shop name is required.');

  const vendor = await prisma.vendor.create({
    data: {
      name,
      description: description || null,
      category: category || null,
      phone: phone || null,
      ownerId: ctx.dbUser.id,
    },
  });

  // Update user role
  await prisma.user.update({ where: { id: ctx.dbUser.id }, data: { role: 'VENDOR' } });

  // Notify admins
  const adminIds = (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  for (const adminId of adminIds) {
    bot.telegram.sendMessage(
      adminId,
      `🆕 *New Vendor Application*\n\n` +
      `🏪 *${vendor.name}*\n` +
      `📝 ${vendor.description || 'No description'}\n` +
      `📂 ${vendor.category || 'No category'}\n` +
      `📞 ${vendor.phone || 'No phone'}\n` +
      `👤 @${ctx.from.username || ctx.from.first_name}\n` +
      `🆔 ID: ${vendor.id}`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(`✅ Approve`, `approve_vendor_${vendor.id}`),
            Markup.button.callback(`❌ Reject`, `reject_vendor_${vendor.id}`),
          ],
        ]),
      }
    ).catch(() => {});
  }

  await ctx.reply(
    `✅ *Application submitted!*\n\n` +
    `Shop: *${vendor.name}*\n\n` +
    `Your application is under review. We'll notify you once approved!`,
    { parse_mode: 'Markdown' }
  );
});

// ─── Admin: approve/reject vendor ────────────────────────────────────────────
bot.action(/approve_vendor_(\d+)/, async (ctx) => {
  if (ctx.dbUser.role !== 'ADMIN') return ctx.answerCbQuery('Not authorized');
  const vendorId = parseInt(ctx.match[1]);
  const vendor = await prisma.vendor.update({
    where: { id: vendorId },
    data: { approved: true },
    include: { owner: true },
  });
  await ctx.answerCbQuery('✅ Vendor approved!');
  await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
  await ctx.reply(`✅ *${vendor.name}* has been approved!`, { parse_mode: 'Markdown' });

  // Notify vendor
  bot.telegram.sendMessage(
    vendor.owner.telegramId,
    `🎉 *Congratulations!*\n\n` +
    `Your shop *${vendor.name}* has been approved on Hager Gebeya!\n\n` +
    `You can now add products through the shop admin panel.\n\n` +
    `Use /vendor_dashboard to manage your shop.`,
    { parse_mode: 'Markdown' }
  ).catch(() => {});
});

bot.action(/reject_vendor_(\d+)/, async (ctx) => {
  if (ctx.dbUser.role !== 'ADMIN') return ctx.answerCbQuery('Not authorized');
  const vendorId = parseInt(ctx.match[1]);
  const vendor = await prisma.vendor.update({
    where: { id: vendorId },
    data: { active: false },
    include: { owner: true },
  });
  await ctx.answerCbQuery('❌ Vendor rejected');
  await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
  await ctx.reply(`❌ *${vendor.name}* has been rejected.`, { parse_mode: 'Markdown' });

  bot.telegram.sendMessage(
    vendor.owner.telegramId,
    `Unfortunately, your shop *${vendor.name}* was not approved at this time. Please contact support for more information.`,
    { parse_mode: 'Markdown' }
  ).catch(() => {});
});

// ─── /vendor_dashboard ───────────────────────────────────────────────────────
bot.command('vendor_dashboard', async (ctx) => {
  const vendor = await prisma.vendor.findUnique({ where: { ownerId: ctx.dbUser.id } });
  if (!vendor) return ctx.reply('You don\'t have a vendor account. Use /become_vendor to apply.');
  if (!vendor.approved) return ctx.reply('⏳ Your vendor account is pending approval.');

  const [products, pendingOrders] = await Promise.all([
    prisma.product.count({ where: { vendorId: vendor.id, active: true } }),
    prisma.order.count({ where: { vendorId: vendor.id, status: 'PENDING' } }),
  ]);

  await ctx.reply(
    `🏪 *${vendor.name} Dashboard*\n\n` +
    `📦 Active Products: ${products}\n` +
    `🆕 Pending Orders: ${pendingOrders}\n\n` +
    `Manage your shop:`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp('🛠️ Manage Shop', `${MINI_APP_URL}/vendor`)],
        [Markup.button.callback('📋 View Pending Orders', `vendor_orders_${vendor.id}`)],
      ]),
    }
  );
});

bot.action(/vendor_orders_(\d+)/, async (ctx) => {
  const vendorId = parseInt(ctx.match[1]);
  const vendor = await prisma.vendor.findFirst({ where: { id: vendorId, ownerId: ctx.dbUser.id } });
  if (!vendor) return ctx.answerCbQuery('Not authorized');

  const orders = await prisma.order.findMany({
    where: { vendorId, status: { in: ['PENDING', 'CONFIRMED', 'PREPARING'] } },
    include: { user: true, items: { include: { product: true } } },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  await ctx.answerCbQuery();
  if (!orders.length) return ctx.reply('No active orders right now.');

  for (const order of orders) {
    let text = `📦 Order \`${order.orderNumber}\`\n`;
    text += `👤 ${order.user.firstName || order.user.username || 'Customer'}\n`;
    text += `💰 ${order.finalTotal.toFixed(2)} ETB\n`;
    text += `📍 ${order.address || 'No address'}\n\n`;
    text += `*Items:*\n`;
    order.items.forEach(item => {
      text += `  • ${item.product.name} x${item.quantity} — ${(item.price * item.quantity).toFixed(2)} ETB\n`;
    });

    await ctx.reply(text, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Confirm', `order_status_${order.id}_CONFIRMED`),
          Markup.button.callback('👨‍🍳 Preparing', `order_status_${order.id}_PREPARING`),
        ],
        [
          Markup.button.callback('🎁 Ready', `order_status_${order.id}_READY`),
          Markup.button.callback('❌ Cancel', `order_status_${order.id}_CANCELLED`),
        ],
      ]),
    });
  }
});

// ─── Order status updates ─────────────────────────────────────────────────────
bot.action(/order_status_(\d+)_(\w+)/, async (ctx) => {
  const orderId = parseInt(ctx.match[1]);
  const newStatus = ctx.match[2];

  const order = await prisma.order.findFirst({
    where: { id: orderId },
    include: { vendor: true, user: true },
  });
  if (!order) return ctx.answerCbQuery('Order not found');

  // Verify it's the vendor
  const isVendor = order.vendor.ownerId === ctx.dbUser.id;
  const isAdmin = ctx.dbUser.role === 'ADMIN';
  if (!isVendor && !isAdmin) return ctx.answerCbQuery('Not authorized');

  await prisma.order.update({ where: { id: orderId }, data: { status: newStatus } });

  const statusMessages = {
    CONFIRMED: '✅ Order confirmed! We\'ll start preparing it soon.',
    PREPARING: '👨‍🍳 Your order is being prepared!',
    READY: '🎁 Your order is ready for pickup/delivery!',
    DELIVERED: '🏠 Your order has been delivered. Enjoy!',
    CANCELLED: '❌ Your order has been cancelled.',
  };

  await ctx.answerCbQuery(`Status updated to ${newStatus}`);
  await ctx.editMessageReplyMarkup({ inline_keyboard: [] });

  // Notify customer
  if (statusMessages[newStatus]) {
    bot.telegram.sendMessage(
      order.user.telegramId,
      `📦 *Order Update* — \`${order.orderNumber}\`\n\n` +
      `${statusMessages[newStatus]}\n\n` +
      `🏪 ${order.vendor.name}`,
      { parse_mode: 'Markdown' }
    ).catch(() => {});
  }
});

// ─── /admin ───────────────────────────────────────────────────────────────────
bot.command('admin', async (ctx) => {
  if (ctx.dbUser.role !== 'ADMIN') return ctx.reply('⛔ Admin access only.');
  const [users, vendors, orders] = await Promise.all([
    prisma.user.count(),
    prisma.vendor.count({ where: { approved: true } }),
    prisma.order.count({ where: { createdAt: { gte: new Date(Date.now() - 86400000) } } }),
  ]);
  const pendingVendors = await prisma.vendor.count({ where: { approved: false, active: true } });

  await ctx.reply(
    `⚙️ *Admin Dashboard*\n\n` +
    `👥 Total Users: ${users}\n` +
    `🏪 Active Vendors: ${vendors}\n` +
    `⏳ Pending Vendors: ${pendingVendors}\n` +
    `📦 Orders (24h): ${orders}\n\n` +
    `Manage everything:`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp('🖥️ Admin Panel', `${MINI_APP_URL}/admin`)],
        [Markup.button.callback('🏪 Pending Vendors', 'admin_pending_vendors')],
        [Markup.button.callback('📊 Today\'s Orders', 'admin_todays_orders')],
      ]),
    }
  );
});

bot.action('admin_pending_vendors', async (ctx) => {
  if (ctx.dbUser.role !== 'ADMIN') return ctx.answerCbQuery('Not authorized');
  await ctx.answerCbQuery();

  const vendors = await prisma.vendor.findMany({
    where: { approved: false, active: true },
    include: { owner: true },
  });

  if (!vendors.length) return ctx.reply('No pending vendor applications.');

  for (const vendor of vendors) {
    await ctx.reply(
      `🏪 *${vendor.name}*\n` +
      `📝 ${vendor.description || 'No description'}\n` +
      `📂 ${vendor.category || 'No category'}\n` +
      `📞 ${vendor.phone || 'No phone'}\n` +
      `👤 @${vendor.owner.username || vendor.owner.firstName}`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ Approve', `approve_vendor_${vendor.id}`),
            Markup.button.callback('❌ Reject', `reject_vendor_${vendor.id}`),
          ],
        ]),
      }
    );
  }
});

bot.action('admin_todays_orders', async (ctx) => {
  if (ctx.dbUser.role !== 'ADMIN') return ctx.answerCbQuery('Not authorized');
  await ctx.answerCbQuery();

  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: new Date(Date.now() - 86400000) } },
    include: { vendor: true, user: true },
    orderBy: { createdAt: 'desc' },
  });

  if (!orders.length) return ctx.reply("No orders in the last 24 hours.");

  const total = orders.reduce((sum, o) => sum + o.finalTotal, 0);
  let text = `📊 *Today's Orders (${orders.length})*\nTotal: ${total.toFixed(2)} ETB\n\n`;
  orders.slice(0, 10).forEach(o => {
    text += `• \`${o.orderNumber}\` — ${o.vendor.name} — ${o.finalTotal.toFixed(2)} ETB — ${o.status}\n`;
  });

  await ctx.reply(text, { parse_mode: 'Markdown' });
});

// ─── Help ─────────────────────────────────────────────────────────────────────
bot.action('help', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(
    `ℹ️ *Hager Gebeya Help*\n\n` +
    `*Customer Commands:*\n` +
    `/start — Welcome screen\n` +
    `/shop — Open the shop\n` +
    `/orders — View your orders\n` +
    `/vendors — Browse vendors\n\n` +
    `*Vendor Commands:*\n` +
    `/become\\_vendor — Apply as vendor\n` +
    `/vendor\\_dashboard — Manage your shop\n\n` +
    `*Admin Commands:*\n` +
    `/admin — Admin dashboard\n\n` +
    `For support, contact @HagerGebeyaSupport`,
    { parse_mode: 'Markdown' }
  );
});

bot.help((ctx) => ctx.reply('Use /start to open the shop, /orders to track orders, /vendors to browse.'));

async function setupBotWebhook() {
  const webhookUrl = `${process.env.WEBHOOK_URL}/webhook`;
  await bot.telegram.setWebhook(webhookUrl);
  console.log(`Webhook set to ${webhookUrl}`);
}

module.exports = { bot, setupBotWebhook };
