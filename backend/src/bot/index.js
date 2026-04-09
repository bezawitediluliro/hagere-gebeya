const { Telegraf, Markup } = require('telegraf');
const { prisma } = require('../services/db');
const { t } = require('../services/i18n');
const { nanoid } = require('nanoid');

const bot = new Telegraf(process.env.BOT_TOKEN);
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://your-frontend.vercel.app';

// ─── Auto-register & middleware ───────────────────────────────────────────────
bot.use(async (ctx, next) => {
  if (!ctx.from) return next();
  const telegramId = String(ctx.from.id);
  const adminIds = (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(s => s.trim());

  let user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) {
    const refCode = nanoid(8).toUpperCase();
    user = await prisma.user.create({
      data: {
        telegramId,
        username: ctx.from.username,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name,
        role: adminIds.includes(telegramId) ? 'ADMIN' : 'CUSTOMER',
        language: 'en',
        referralCode: refCode,
      },
    });
  }

  if (user.banned) return ctx.reply('Your account has been suspended. Contact support.');
  ctx.dbUser = user;
  ctx.lang = user.language || 'en';
  return next();
});

// ─── /start ───────────────────────────────────────────────────────────────────
bot.start(async (ctx) => {
  const name = ctx.from.first_name || 'there';
  const lang = ctx.lang;

  // Handle referral
  const startPayload = ctx.startPayload;
  if (startPayload && startPayload.startsWith('ref_')) {
    const refCode = startPayload.replace('ref_', '');
    const referrer = await prisma.user.findUnique({ where: { referralCode: refCode } });
    if (referrer && referrer.id !== ctx.dbUser.id && !ctx.dbUser.referredById) {
      await prisma.user.update({
        where: { id: ctx.dbUser.id },
        data: { referredById: referrer.id },
      });
      await prisma.user.update({
        where: { id: referrer.id },
        data: { points: { increment: 50 } },
      });
      bot.telegram.sendMessage(referrer.telegramId, t(referrer.language || 'en', 'referral_bonus', name), { parse_mode: 'Markdown' }).catch(() => {});
    }
  }

  await ctx.reply(
    t(lang, 'welcome', name),
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp(t(lang, 'open_shop'), MINI_APP_URL)],
        [Markup.button.callback(t(lang, 'my_orders'), 'my_orders')],
        [Markup.button.callback('🌐 Language / ቋንቋ', 'choose_language')],
        [Markup.button.callback(t(lang, 'help'), 'help')],
      ]),
    }
  );
});

// ─── Language selection ───────────────────────────────────────────────────────
bot.command('language', (ctx) => ctx.reply(
  t(ctx.lang, 'choose_language'),
  {
    ...Markup.inlineKeyboard([
      [Markup.button.callback('🇬🇧 English', 'lang_en')],
      [Markup.button.callback('🇪🇹 አማርኛ', 'lang_am')],
    ]),
  }
));

bot.action('choose_language', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(
    t(ctx.lang, 'choose_language'),
    {
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🇬🇧 English', 'lang_en')],
        [Markup.button.callback('🇪🇹 አማርኛ', 'lang_am')],
      ]),
    }
  );
});

bot.action(/lang_(en|am)/, async (ctx) => {
  const lang = ctx.match[1];
  await prisma.user.update({ where: { id: ctx.dbUser.id }, data: { language: lang } });
  ctx.lang = lang;
  await ctx.answerCbQuery(lang === 'am' ? '✅ አማርኛ' : '✅ English');
  await ctx.reply(t(lang, 'language_set'));
});

// ─── /shop ────────────────────────────────────────────────────────────────────
bot.command('shop', (ctx) =>
  ctx.reply(t(ctx.lang, 'open_shop'), {
    ...Markup.inlineKeyboard([[Markup.button.webApp(t(ctx.lang, 'open_shop'), MINI_APP_URL)]]),
  })
);

// ─── /points ─────────────────────────────────────────────────────────────────
bot.command('points', async (ctx) => {
  const lang = ctx.lang;
  const user = await prisma.user.findUnique({ where: { id: ctx.dbUser.id } });
  const ptValue = (user.points * 0.1).toFixed(2);
  const msg = lang === 'am'
    ? `⭐ *የቅናሽ ነጥቦችዎ*\n\nነጥቦች: *${user.points}*\nዋጋ: *${ptValue} ብር*\n\n100 ነጥቦች = 10 ብር ቅናሽ`
    : `⭐ *Your Loyalty Points*\n\nPoints: *${user.points}*\nValue: *${ptValue} ETB*\n\n100 points = 10 ETB discount`;
  await ctx.reply(msg, { parse_mode: 'Markdown' });
});

// ─── /refer ───────────────────────────────────────────────────────────────────
bot.command('refer', async (ctx) => {
  const lang = ctx.lang;
  const user = await prisma.user.findUnique({ where: { id: ctx.dbUser.id } });
  const link = `https://t.me/${ctx.botInfo.username}?start=ref_${user.referralCode}`;
  const msg = lang === 'am'
    ? `🎁 *የሪፈራል ፕሮግራም*\n\nጓደኞቾን ሃገር ገበያ ሲቀላቀሉ *50 ነጥቦች* ያሸናሉ!\n\nሊንክዎ:\n${link}`
    : `🎁 *Referral Program*\n\nEarn *50 points* for each friend who joins using your link!\n\nYour link:\n${link}`;
  await ctx.reply(msg, { parse_mode: 'Markdown' });
});

// ─── /vendors ─────────────────────────────────────────────────────────────────
bot.command('vendors', async (ctx) => {
  const lang = ctx.lang;
  const vendors = await prisma.vendor.findMany({
    where: { approved: true, active: true },
    orderBy: [{ featured: 'desc' }, { rating: 'desc' }],
    take: 10,
  });
  if (!vendors.length) return ctx.reply(t(lang, 'no_vendors'));

  let text = t(lang, 'vendors_title') + '\n\n';
  vendors.forEach((v, i) => {
    const stars = v.rating > 0 ? ` ⭐${v.rating.toFixed(1)}` : '';
    const feat = v.featured ? ' 🔥' : '';
    text += `${i + 1}.${feat} *${v.name}*${stars}\n`;
    if (v.category) text += `   📂 ${v.category}\n`;
    if (v.description) text += `   ${v.description}\n`;
    text += '\n';
  });

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([[Markup.button.webApp(t(lang, 'open_shop'), MINI_APP_URL)]]),
  });
});

// ─── /orders ──────────────────────────────────────────────────────────────────
bot.command('orders', async (ctx) => { await showOrders(ctx); });
bot.action('my_orders', async (ctx) => { await ctx.answerCbQuery(); await showOrders(ctx); });

async function showOrders(ctx) {
  const lang = ctx.lang;
  const orders = await prisma.order.findMany({
    where: { userId: ctx.dbUser.id },
    include: { vendor: true },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  if (!orders.length) {
    return ctx.reply(lang === 'am' ? 'እስካሁን ምንም ትዕዛዝ አልሰጡም።\n\nአሁን ይሸምቱ!' : "You haven't placed any orders yet.\n\nShop now!", {
      ...Markup.inlineKeyboard([[Markup.button.webApp(t(lang, 'open_shop'), MINI_APP_URL)]]),
    });
  }

  const statusEmoji = { PENDING: '⏳', CONFIRMED: '✅', PREPARING: '👨‍🍳', READY: '🎁', DELIVERED: '🏠', CANCELLED: '❌' };
  let text = lang === 'am' ? '📦 *የቅርብ ጊዜ ትዕዛዞቾ:*\n\n' : '📦 *Your Recent Orders:*\n\n';
  orders.forEach(o => {
    text += `${statusEmoji[o.status] || '📦'} \`${o.orderNumber}\`\n`;
    text += `   🏪 ${o.vendor.name}\n`;
    text += `   💰 ${o.finalTotal.toFixed(2)} ${lang === 'am' ? 'ብር' : 'ETB'}\n\n`;
  });

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([[Markup.button.webApp(lang === 'am' ? 'ሁሉንም ትዕዛዞች ይመልከቱ' : 'View All Orders', `${MINI_APP_URL}/orders`)]]),
  });
}

// ─── /become_vendor ───────────────────────────────────────────────────────────
bot.command('become_vendor', async (ctx) => {
  const lang = ctx.lang;
  const existing = await prisma.vendor.findUnique({ where: { ownerId: ctx.dbUser.id } });
  if (existing) {
    const status = existing.approved ? (lang === 'am' ? '✅ ጸድቋል' : '✅ approved') : (lang === 'am' ? '⏳ ፍቃድ እየጠበቀ ነው' : '⏳ pending approval');
    return ctx.reply(`${lang === 'am' ? 'የሻጭ መለያ አለዎት' : 'You already have a vendor account'} (${status}): *${existing.name}*`, { parse_mode: 'Markdown' });
  }
  await ctx.reply(
    t(lang, 'become_vendor'),
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp(lang === 'am' ? '🏪 ሻጭ ለመሆን ያመልክቱ' : '🏪 Apply as Vendor', `${MINI_APP_URL}/vendor`)],
      ]),
    }
  );
});

// ─── Phone number sharing ─────────────────────────────────────────────────────
bot.command('share_phone', async (ctx) => {
  const lang = ctx.lang;
  await ctx.reply(
    t(lang, 'share_phone'),
    {
      ...Markup.keyboard([
        [Markup.button.contactRequest(lang === 'am' ? '📱 ስልክ ቁጥር ያጋሩ' : '📱 Share Phone Number')],
      ]).resize().oneTime(),
    }
  );
});

bot.on('contact', async (ctx) => {
  const contact = ctx.message.contact;
  if (contact.user_id && String(contact.user_id) !== String(ctx.from.id)) {
    return ctx.reply('Please share your own phone number.');
  }
  await prisma.user.update({
    where: { id: ctx.dbUser.id },
    data: { phone: contact.phone_number },
  });
  const lang = ctx.lang;
  await ctx.reply(
    lang === 'am' ? `✅ ስልክ ቁጥርዎ ተቀምጧል: ${contact.phone_number}` : `✅ Phone saved: ${contact.phone_number}`,
    Markup.removeKeyboard()
  );
});

// ─── Review system ────────────────────────────────────────────────────────────
bot.action(/review_(\d+)_(\d+)/, async (ctx) => {
  const orderId = parseInt(ctx.match[1]);
  const rating = parseInt(ctx.match[2]);
  const lang = ctx.lang;

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId: ctx.dbUser.id, status: 'DELIVERED' },
    include: { vendor: true },
  });
  if (!order) return ctx.answerCbQuery('Order not found');

  const existingReview = await prisma.review.findUnique({ where: { orderId } });
  if (existingReview) return ctx.answerCbQuery(lang === 'am' ? 'ቀደም ብለዋል!' : 'Already reviewed!');

  await prisma.review.create({
    data: { rating, orderId, userId: ctx.dbUser.id, vendorId: order.vendorId },
  });

  // Update vendor rating
  const reviews = await prisma.review.aggregate({ _avg: { rating: true }, _count: true, where: { vendorId: order.vendorId } });
  await prisma.vendor.update({
    where: { id: order.vendorId },
    data: { rating: reviews._avg.rating || 0, reviewCount: reviews._count },
  });

  // Award points for reviewing
  await prisma.user.update({ where: { id: ctx.dbUser.id }, data: { points: { increment: 10 } } });

  await ctx.answerCbQuery(lang === 'am' ? '✅ ምስጋና!' : '✅ Thanks for your review!');
  await ctx.editMessageText(
    lang === 'am'
      ? `${'⭐'.repeat(rating)} ምዘናዎ ለ *${order.vendor.name}* ተቀምጧል!\n\n+10 ነጥቦች አሸነፉ ⭐`
      : `${'⭐'.repeat(rating)} Review saved for *${order.vendor.name}*!\n\n+10 loyalty points earned ⭐`,
    { parse_mode: 'Markdown' }
  );
});

// ─── Approve/reject vendor (admin) ────────────────────────────────────────────
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
  await ctx.reply(`✅ *${vendor.name}* approved!`, { parse_mode: 'Markdown' });

  const ownerLang = vendor.owner.language || 'en';
  bot.telegram.sendMessage(vendor.owner.telegramId, t(ownerLang, 'vendor_approved_notif', vendor.name), { parse_mode: 'Markdown' }).catch(() => {});
});

bot.action(/reject_vendor_(\d+)/, async (ctx) => {
  if (ctx.dbUser.role !== 'ADMIN') return ctx.answerCbQuery('Not authorized');
  const vendorId = parseInt(ctx.match[1]);
  const vendor = await prisma.vendor.update({
    where: { id: vendorId }, data: { active: false }, include: { owner: true },
  });
  await ctx.answerCbQuery('❌ Rejected');
  await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
  const ownerLang = vendor.owner.language || 'en';
  bot.telegram.sendMessage(vendor.owner.telegramId, t(ownerLang, 'vendor_rejected', vendor.name), { parse_mode: 'Markdown' }).catch(() => {});
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

  const isVendor = order.vendor.ownerId === ctx.dbUser.id;
  const isAdmin = ctx.dbUser.role === 'ADMIN';
  if (!isVendor && !isAdmin) return ctx.answerCbQuery('Not authorized');

  await prisma.order.update({ where: { id: orderId }, data: { status: newStatus } });

  // Award loyalty points on delivery
  if (newStatus === 'DELIVERED') {
    const pointsEarned = Math.floor(order.finalTotal / 10);
    await prisma.user.update({ where: { id: order.userId }, data: { points: { increment: pointsEarned } } });
    await prisma.order.update({ where: { id: orderId }, data: { pointsEarned } });
    // Update vendor revenue
    await prisma.vendor.update({ where: { id: order.vendorId }, data: { totalRevenue: { increment: order.finalTotal } } });
  }

  await ctx.answerCbQuery(`Updated to ${newStatus}`);
  await ctx.editMessageReplyMarkup({ inline_keyboard: [] });

  const custLang = order.user.language || 'en';
  const statusMsgs = {
    CONFIRMED: t(custLang, 'order_status_confirmed'),
    PREPARING: t(custLang, 'order_status_preparing'),
    READY: t(custLang, 'order_status_ready'),
    DELIVERED: t(custLang, 'order_status_delivered'),
    CANCELLED: t(custLang, 'order_status_cancelled'),
  };

  let notifMsg = `📦 *${order.orderNumber}*\n${statusMsgs[newStatus]}\n🏪 ${order.vendor.name}`;
  if (newStatus === 'DELIVERED') {
    const pts = Math.floor(order.finalTotal / 10);
    notifMsg += `\n\n${t(custLang, 'points_earned', pts)}`;
    // Send review prompt after delivery
    setTimeout(() => {
      bot.telegram.sendMessage(order.user.telegramId, t(custLang, 'review_prompt', order.orderNumber), {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[
          Markup.button.callback('⭐', `review_${orderId}_1`),
          Markup.button.callback('⭐⭐', `review_${orderId}_2`),
          Markup.button.callback('⭐⭐⭐', `review_${orderId}_3`),
          Markup.button.callback('⭐⭐⭐⭐', `review_${orderId}_4`),
          Markup.button.callback('⭐⭐⭐⭐⭐', `review_${orderId}_5`),
        ]]),
      }).catch(() => {});
    }, 60000); // 1 minute later
  }

  bot.telegram.sendMessage(order.user.telegramId, notifMsg, { parse_mode: 'Markdown' }).catch(() => {});
});

// ─── Vendor orders callback ────────────────────────────────────────────────────
bot.action(/vendor_orders_(\d+)/, async (ctx) => {
  const vendorId = parseInt(ctx.match[1]);
  const vendor = await prisma.vendor.findFirst({ where: { id: vendorId, ownerId: ctx.dbUser.id } });
  if (!vendor) return ctx.answerCbQuery('Not authorized');
  await ctx.answerCbQuery();
  const lang = ctx.lang;

  const orders = await prisma.order.findMany({
    where: { vendorId, status: { in: ['PENDING', 'CONFIRMED', 'PREPARING'] } },
    include: { user: true, items: { include: { product: true } } },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  if (!orders.length) return ctx.reply(lang === 'am' ? 'አሁን ንቁ ትዕዛዞች የሉም።' : 'No active orders right now.');

  for (const order of orders) {
    let text = `📦 \`${order.orderNumber}\`\n`;
    text += `👤 ${order.user.firstName || order.user.username || 'Customer'}\n`;
    text += `💰 ${order.finalTotal.toFixed(2)} ${lang === 'am' ? 'ብር' : 'ETB'}\n`;
    if (order.address) text += `📍 ${order.address}\n`;
    text += `\n`;
    order.items.forEach(item => { text += `• ${item.product.name} ×${item.quantity}\n`; });

    await ctx.reply(text, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback(lang === 'am' ? '✅ አረጋግጥ' : '✅ Confirm', `order_status_${order.id}_CONFIRMED`),
          Markup.button.callback(lang === 'am' ? '👨‍🍳 እያዘጋጀ' : '👨‍🍳 Preparing', `order_status_${order.id}_PREPARING`),
        ],
        [
          Markup.button.callback(lang === 'am' ? '🎁 ዝግጁ' : '🎁 Ready', `order_status_${order.id}_READY`),
          Markup.button.callback(lang === 'am' ? '❌ ሰርዝ' : '❌ Cancel', `order_status_${order.id}_CANCELLED`),
        ],
      ]),
    });
  }
});

// ─── /vendor_dashboard ────────────────────────────────────────────────────────
bot.command('vendor_dashboard', async (ctx) => {
  const lang = ctx.lang;
  const vendor = await prisma.vendor.findUnique({ where: { ownerId: ctx.dbUser.id } });
  if (!vendor) return ctx.reply(lang === 'am' ? 'የሻጭ መለያ የለዎትም። /become_vendor ይጠቀሙ።' : 'No vendor account. Use /become_vendor.');
  if (!vendor.approved) return ctx.reply(t(lang, 'vendor_pending', vendor.name), { parse_mode: 'Markdown' });

  const [products, pendingOrders, weekRevenue, reviews] = await Promise.all([
    prisma.product.count({ where: { vendorId: vendor.id, active: true } }),
    prisma.order.count({ where: { vendorId: vendor.id, status: 'PENDING' } }),
    prisma.order.aggregate({ _sum: { finalTotal: true }, where: { vendorId: vendor.id, createdAt: { gte: new Date(Date.now() - 7 * 86400000) }, status: { not: 'CANCELLED' } } }),
    prisma.review.aggregate({ _avg: { rating: true }, _count: true, where: { vendorId: vendor.id } }),
  ]);

  const wRev = weekRevenue._sum.finalTotal || 0;
  const rating = reviews._avg.rating ? reviews._avg.rating.toFixed(1) : 'N/A';

  const msg = lang === 'am'
    ? `🏪 *${vendor.name} ዳሽቦርድ*\n\n📦 ምርቶች: ${products}\n🆕 ትዕዛዞቾ: ${pendingOrders}\n💰 የሳምንቱ ገቢ: ${wRev.toFixed(2)} ብር\n⭐ ደረጃ: ${rating} (${reviews._count} ግምገማ)`
    : `🏪 *${vendor.name} Dashboard*\n\n📦 Products: ${products}\n🆕 Pending Orders: ${pendingOrders}\n💰 This Week: ${wRev.toFixed(2)} ETB\n⭐ Rating: ${rating} (${reviews._count} reviews)`;

  await ctx.reply(msg, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.webApp(lang === 'am' ? '🛠️ ሱቅ ያስተዳድሩ' : '🛠️ Manage Shop', `${MINI_APP_URL}/vendor`)],
      [Markup.button.callback(lang === 'am' ? '📋 ትዕዛዞቾን ይመልከቱ' : '📋 View Orders', `vendor_orders_${vendor.id}`)],
    ]),
  });
});

// ─── /admin ───────────────────────────────────────────────────────────────────
bot.command('admin', async (ctx) => {
  if (ctx.dbUser.role !== 'ADMIN') return ctx.reply('⛔ Admin access only.');
  const [users, vendors, orders, revenue, pendingVendors] = await Promise.all([
    prisma.user.count(),
    prisma.vendor.count({ where: { approved: true } }),
    prisma.order.count({ where: { createdAt: { gte: new Date(Date.now() - 86400000) } } }),
    prisma.order.aggregate({ _sum: { finalTotal: true }, where: { status: { not: 'CANCELLED' } } }),
    prisma.vendor.count({ where: { approved: false, active: true } }),
  ]);

  await ctx.reply(
    `⚙️ *Hager Gebeya Admin*\n\n👥 Users: ${users}\n🏪 Vendors: ${vendors} (${pendingVendors} pending)\n📦 Orders (24h): ${orders}\n💰 Total Revenue: ${(revenue._sum.finalTotal || 0).toFixed(0)} ETB`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp('🖥️ Admin Panel', `${MINI_APP_URL}/admin`)],
        [Markup.button.callback('🏪 Pending Vendors', 'admin_pending_vendors')],
        [Markup.button.callback('📊 Send Weekly Report Now', 'admin_send_report')],
        [Markup.button.callback('📢 Broadcast', 'admin_broadcast_prompt')],
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
  if (!vendors.length) return ctx.reply('No pending vendors.');
  for (const v of vendors) {
    await ctx.reply(
      `🏪 *${v.name}*\n📝 ${v.description || '—'}\n📂 ${v.category || '—'}\n📞 ${v.phone || '—'}\n👤 @${v.owner.username || v.owner.firstName}`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[
          Markup.button.callback('✅ Approve', `approve_vendor_${v.id}`),
          Markup.button.callback('❌ Reject', `reject_vendor_${v.id}`),
        ]]),
      }
    );
  }
});

bot.action('admin_send_report', async (ctx) => {
  if (ctx.dbUser.role !== 'ADMIN') return ctx.answerCbQuery('Not authorized');
  await ctx.answerCbQuery('⏳ Sending reports...');
  const { sendWeeklyReports } = require('../services/weeklyReport');
  await sendWeeklyReports(bot);
  await ctx.reply('✅ Weekly reports sent!');
});

bot.action('admin_broadcast_prompt', async (ctx) => {
  if (ctx.dbUser.role !== 'ADMIN') return ctx.answerCbQuery('Not authorized');
  await ctx.answerCbQuery();
  await ctx.reply('📢 Use the Admin Panel to send broadcast messages, or use:\n\n`/broadcast Your message here`', { parse_mode: 'Markdown' });
});

// ─── /broadcast (admin) ───────────────────────────────────────────────────────
bot.command('broadcast', async (ctx) => {
  if (ctx.dbUser.role !== 'ADMIN') return ctx.reply('⛔ Admin only.');
  const text = ctx.message.text.replace('/broadcast', '').trim();
  if (!text) return ctx.reply('Usage: /broadcast Your message');
  const users = await prisma.user.findMany({ select: { telegramId: true } });
  let sent = 0, failed = 0;
  for (const u of users) {
    try { await bot.telegram.sendMessage(u.telegramId, text, { parse_mode: 'Markdown' }); sent++; }
    catch { failed++; }
    await new Promise(r => setTimeout(r, 50));
  }
  await ctx.reply(`✅ Sent: ${sent} | ❌ Failed: ${failed}`);
});

// ─── Help ─────────────────────────────────────────────────────────────────────
bot.action('help', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(t(ctx.lang, 'help_text'), { parse_mode: 'Markdown' });
});
bot.help((ctx) => ctx.reply(t(ctx.lang, 'help_text'), { parse_mode: 'Markdown' }));
bot.command('language', (ctx) => ctx.reply(t(ctx.lang, 'choose_language'), {
  ...Markup.inlineKeyboard([[Markup.button.callback('🇬🇧 English', 'lang_en'), Markup.button.callback('🇪🇹 አማርኛ', 'lang_am')]]),
}));

async function setupBotWebhook() {
  const webhookUrl = `${process.env.WEBHOOK_URL}/webhook`;
  await bot.telegram.setWebhook(webhookUrl);
}

module.exports = { bot, setupBotWebhook };
