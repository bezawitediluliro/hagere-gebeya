const { Telegraf, Markup } = require('telegraf');
const { prisma } = require('../services/db');
const { t } = require('../services/i18n');
const { nanoid } = require('nanoid');

const bot = new Telegraf(process.env.BOT_TOKEN);
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://your-frontend.vercel.app';

// ─── Conversation state machine ───────────────────────────────────────────────
// Tracks multi-step flows per user: { [telegramId]: { step, data } }
const sessions = new Map();
function getSession(id) { return sessions.get(id) || null; }
function setSession(id, data) { sessions.set(id, data); }
function clearSession(id) { sessions.delete(id); }

// ─── Auto-register & middleware ───────────────────────────────────────────────
bot.use(async (ctx, next) => {
  if (!ctx.from) return next();
  const telegramId = String(ctx.from.id);
  const adminIds = (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(s => s.trim());

  const refCode = nanoid(8).toUpperCase();
  let user = await prisma.user.upsert({
    where: { telegramId },
    update: {
      username: ctx.from.username,
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name,
    },
    create: {
      telegramId,
      username: ctx.from.username,
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name,
      role: adminIds.includes(telegramId) ? 'ADMIN' : 'CUSTOMER',
      language: 'en',
      referralCode: refCode,
    },
  });

  if (user.banned) return ctx.reply('Your account has been suspended. Contact support.');
  ctx.dbUser = user;
  ctx.lang = user.language || 'en';
  return next();
});

// ─── Main menu keyboard ───────────────────────────────────────────────────────
function mainMenu(lang) {
  return Markup.keyboard([
    [lang === 'am' ? '🛍️ ሱቅ ክፈት' : '🛍️ Open Shop', lang === 'am' ? '📦 ትዕዛዞቼ' : '📦 My Orders'],
    [lang === 'am' ? '⭐ ነጥቦቼ' : '⭐ My Points', lang === 'am' ? '🎁 ጓደኞች ጋብዝ' : '🎁 Refer Friends'],
    [lang === 'am' ? '🏪 ሻጭ ሁን' : '🏪 Become Vendor', lang === 'am' ? '👤 መለያ' : '👤 My Profile'],
  ]).resize();
}

function vendorMenu(lang) {
  return Markup.keyboard([
    [lang === 'am' ? '📋 ትዕዛዞች' : '📋 Orders', lang === 'am' ? '📊 ዳሽቦርድ' : '📊 Dashboard'],
    [lang === 'am' ? '🛠️ ሱቅ ያስተዳድሩ' : '🛠️ Manage Shop', lang === 'am' ? '⬅️ ዋና ምናሌ' : '⬅️ Main Menu'],
  ]).resize();
}

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
      await prisma.user.update({ where: { id: ctx.dbUser.id }, data: { referredById: referrer.id } });
      await prisma.user.update({ where: { id: referrer.id }, data: { points: { increment: 50 } } });
      bot.telegram.sendMessage(referrer.telegramId, t(referrer.language || 'en', 'referral_bonus', name), { parse_mode: 'Markdown' }).catch(() => {});
    }
  }

  await ctx.reply(
    t(lang, 'welcome', name),
    { parse_mode: 'Markdown', ...mainMenu(lang) }
  );
});

// ─── /menu ────────────────────────────────────────────────────────────────────
bot.command('menu', async (ctx) => {
  clearSession(ctx.from.id);
  const vendor = await prisma.vendor.findUnique({ where: { ownerId: ctx.dbUser.id } });
  const lang = ctx.lang;
  if (vendor?.approved) {
    await ctx.reply(lang === 'am' ? '📋 የሻጭ ምናሌ' : '📋 Vendor Menu', vendorMenu(lang));
  } else {
    await ctx.reply(lang === 'am' ? '📋 ዋና ምናሌ' : '📋 Main Menu', mainMenu(lang));
  }
});

// ─── Handle reply keyboard buttons ───────────────────────────────────────────
bot.hears(['🛍️ Open Shop', '🛍️ ሱቅ ክፈት'], (ctx) =>
  ctx.reply(t(ctx.lang, 'open_shop'), {
    ...Markup.inlineKeyboard([[Markup.button.webApp(t(ctx.lang, 'open_shop'), MINI_APP_URL)]]),
  })
);

bot.hears(['📦 My Orders', '📦 ትዕዛዞቼ'], async (ctx) => { await showOrders(ctx); });
bot.hears(['⭐ My Points', '⭐ ነጥቦቼ'], async (ctx) => { await showPoints(ctx); });
bot.hears(['🎁 Refer Friends', '🎁 ጓደኞች ጋብዝ'], async (ctx) => { await showReferral(ctx); });
bot.hears(['🏪 Become Vendor', '🏪 ሻጭ ሁን'], async (ctx) => { await startVendorFlow(ctx); });
bot.hears(['👤 My Profile', '👤 መለያ'], async (ctx) => { await showProfile(ctx); });
bot.hears(['📋 Orders', '📋 ትዕዛዞች'], async (ctx) => { await showVendorOrders(ctx); });
bot.hears(['📊 Dashboard', '📊 ዳሽቦርድ'], async (ctx) => { await showVendorDashboard(ctx); });
bot.hears(['🛠️ Manage Shop', '🛠️ ሱቅ ያስተዳድሩ'], (ctx) =>
  ctx.reply(
    ctx.lang === 'am' ? 'ሱቅዎን ለማስተዳደር:' : 'Manage your shop:',
    Markup.inlineKeyboard([[Markup.button.webApp(ctx.lang === 'am' ? '🛠️ ሱቅ ክፈት' : '🛠️ Open Shop Manager', `${MINI_APP_URL}/vendor`)]])
  )
);
bot.hears(['⬅️ Main Menu', '⬅️ ዋና ምናሌ'], async (ctx) => {
  clearSession(ctx.from.id);
  await ctx.reply(ctx.lang === 'am' ? '📋 ዋና ምናሌ' : '📋 Main Menu', mainMenu(ctx.lang));
});

// ─── /shop, /points, /refer, /orders, /profile commands ─────────────────────
bot.command('shop', (ctx) =>
  ctx.reply(t(ctx.lang, 'open_shop'), {
    ...Markup.inlineKeyboard([[Markup.button.webApp(t(ctx.lang, 'open_shop'), MINI_APP_URL)]]),
  })
);
bot.command('points', async (ctx) => { await showPoints(ctx); });
bot.command('refer', async (ctx) => { await showReferral(ctx); });
bot.command('orders', async (ctx) => { await showOrders(ctx); });
bot.command('profile', async (ctx) => { await showProfile(ctx); });
bot.command('become_vendor', async (ctx) => { await startVendorFlow(ctx); });
bot.command('vendor_dashboard', async (ctx) => { await showVendorDashboard(ctx); });
bot.command('vendor_orders', async (ctx) => { await showVendorOrders(ctx); });

// ─── /language ────────────────────────────────────────────────────────────────
bot.command('language', (ctx) => ctx.reply(
  t(ctx.lang, 'choose_language'),
  Markup.inlineKeyboard([
    [Markup.button.callback('🇬🇧 English', 'lang_en')],
    [Markup.button.callback('🇪🇹 አማርኛ', 'lang_am')],
  ])
));

bot.action('choose_language', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(t(ctx.lang, 'choose_language'),
    Markup.inlineKeyboard([
      [Markup.button.callback('🇬🇧 English', 'lang_en')],
      [Markup.button.callback('🇪🇹 አማርኛ', 'lang_am')],
    ])
  );
});

bot.action(/lang_(en|am)/, async (ctx) => {
  const lang = ctx.match[1];
  await prisma.user.update({ where: { id: ctx.dbUser.id }, data: { language: lang } });
  ctx.lang = lang;
  await ctx.answerCbQuery(lang === 'am' ? '✅ አማርኛ ተመረጠ' : '✅ English selected');
  await ctx.reply(t(lang, 'language_set'), mainMenu(lang));
});

// ─── Shared feature functions ─────────────────────────────────────────────────
async function showPoints(ctx) {
  const lang = ctx.lang;
  const user = await prisma.user.findUnique({ where: { id: ctx.dbUser.id } });
  const ptValue = (user.points * 0.1).toFixed(2);
  const msg = lang === 'am'
    ? `⭐ *የቅናሽ ነጥቦችዎ*\n\nነጥቦች: *${user.points}*\nዋጋ: *${ptValue} ብር*\n\n100 ነጥቦች = 10 ብር ቅናሽ\nሲፈልጉ በሱቅ ውስጥ ሲከፍሉ ይጠቀሙ።`
    : `⭐ *Your Loyalty Points*\n\nPoints: *${user.points}*\nValue: *${ptValue} ETB*\n\n100 pts = 10 ETB discount\nApply them at checkout in the shop.`;
  await ctx.reply(msg, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([[Markup.button.webApp(lang === 'am' ? '🛍️ ሱቅ ውስጥ ይጠቀሙ' : '🛍️ Use in Shop', MINI_APP_URL)]]),
  });
}

async function showReferral(ctx) {
  const lang = ctx.lang;
  const user = await prisma.user.findUnique({ where: { id: ctx.dbUser.id } });
  const link = `https://t.me/${ctx.botInfo.username}?start=ref_${user.referralCode}`;
  const referredCount = await prisma.user.count({ where: { referredById: user.id } });
  const msg = lang === 'am'
    ? `🎁 *የሪፈራል ፕሮግራም*\n\n👥 ጋብዘዋቸው: *${referredCount}* ሰዎች\n⭐ ያሸነፉ: *${referredCount * 50}* ነጥቦች\n\nጓደኞቾን ሃገር ገበያ ሲቀላቀሉ *50 ነጥቦች* ያሸናሉ!\n\n🔗 ሊንክዎ:\n${link}`
    : `🎁 *Referral Program*\n\n👥 Friends invited: *${referredCount}*\n⭐ Points earned: *${referredCount * 50}*\n\nEarn *50 points* for each friend who joins!\n\n🔗 Your link:\n${link}`;
  await ctx.reply(msg, { parse_mode: 'Markdown' });
}

async function showProfile(ctx) {
  const lang = ctx.lang;
  const user = await prisma.user.findUnique({
    where: { id: ctx.dbUser.id },
    include: { vendor: true },
  });
  const ptValue = (user.points * 0.1).toFixed(2);
  const orders = await prisma.order.count({ where: { userId: user.id } });
  const role = user.role === 'ADMIN' ? '⚙️ Admin' : user.vendor?.approved ? '🏪 Vendor' : '🛍️ Customer';

  const msg = lang === 'am'
    ? `👤 *${user.firstName || user.username || 'User'}*\n\n${user.username ? `@${user.username}\n` : ''}📱 ${user.phone || 'ስልክ አልተቀመጠም'}\n🏷️ ${role}\n\n⭐ ነጥቦች: *${user.points}* (${ptValue} ብር)\n📦 ትዕዛዞች: *${orders}*\n🔑 ሪፈራል ኮድ: \`${user.referralCode}\``
    : `👤 *${user.firstName || user.username || 'User'}*\n\n${user.username ? `@${user.username}\n` : ''}📱 ${user.phone || 'No phone saved'}\n🏷️ ${role}\n\n⭐ Points: *${user.points}* (${ptValue} ETB)\n📦 Orders: *${orders}*\n🔑 Referral code: \`${user.referralCode}\``;

  const buttons = [
    [Markup.button.callback(lang === 'am' ? '🌐 ቋንቋ ቀይር' : '🌐 Change Language', 'choose_language')],
  ];
  if (!user.phone) {
    buttons.push([Markup.button.callback(lang === 'am' ? '📱 ስልክ ቁጥር አስቀምጥ' : '📱 Save Phone Number', 'request_phone')]);
  }
  buttons.push([Markup.button.webApp(lang === 'am' ? '✏️ መገለጫ አርትዕ' : '✏️ Edit Profile', `${MINI_APP_URL}/profile/edit`)]);

  await ctx.reply(msg, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) });
}

// ─── Phone sharing ────────────────────────────────────────────────────────────
bot.action('request_phone', async (ctx) => {
  await ctx.answerCbQuery();
  const lang = ctx.lang;
  await ctx.reply(
    t(lang, 'share_phone'),
    Markup.keyboard([[Markup.button.contactRequest(lang === 'am' ? '📱 ስልክ ቁጥር ያጋሩ' : '📱 Share Phone Number')]]).resize().oneTime()
  );
});

bot.command('share_phone', async (ctx) => {
  const lang = ctx.lang;
  await ctx.reply(
    t(lang, 'share_phone'),
    Markup.keyboard([[Markup.button.contactRequest(lang === 'am' ? '📱 ስልክ ቁጥር ያጋሩ' : '📱 Share Phone Number')]]).resize().oneTime()
  );
});

bot.on('contact', async (ctx) => {
  const contact = ctx.message.contact;
  if (contact.user_id && String(contact.user_id) !== String(ctx.from.id)) {
    return ctx.reply('Please share your own phone number.');
  }
  await prisma.user.update({ where: { id: ctx.dbUser.id }, data: { phone: contact.phone_number } });
  const lang = ctx.lang;
  await ctx.reply(
    lang === 'am' ? `✅ ስልክ ቁጥርዎ ተቀምጧል: ${contact.phone_number}` : `✅ Phone saved: ${contact.phone_number}`,
    { ...Markup.removeKeyboard(), ...mainMenu(lang) }
  );
});

// ─── Orders display ───────────────────────────────────────────────────────────
bot.command('orders', async (ctx) => { await showOrders(ctx); });
bot.action('my_orders', async (ctx) => { await ctx.answerCbQuery(); await showOrders(ctx); });

async function showOrders(ctx) {
  const lang = ctx.lang;
  const orders = await prisma.order.findMany({
    where: { userId: ctx.dbUser.id },
    include: { vendor: true, items: { include: { product: true } } },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  if (!orders.length) {
    return ctx.reply(
      lang === 'am' ? 'እስካሁን ምንም ትዕዛዝ አልሰጡም።\n\nአሁን ይሸምቱ!' : "You haven't placed any orders yet.\n\nShop now!",
      {
        ...Markup.inlineKeyboard([[Markup.button.webApp(t(lang, 'open_shop'), MINI_APP_URL)]]),
      }
    );
  }

  const statusEmoji = { PENDING: '⏳', CONFIRMED: '✅', PREPARING: '👨‍🍳', READY: '🎁', DELIVERED: '🏠', CANCELLED: '❌' };
  const statusLabel = {
    en: { PENDING: 'Pending', CONFIRMED: 'Confirmed', PREPARING: 'Preparing', READY: 'Ready', DELIVERED: 'Delivered', CANCELLED: 'Cancelled' },
    am: { PENDING: 'በመጠባበቅ', CONFIRMED: 'ተረጋግጧል', PREPARING: 'እየተዘጋጀ', READY: 'ዝግጁ', DELIVERED: 'ተደርሷል', CANCELLED: 'ተሰርዟል' },
  };

  let text = lang === 'am' ? '📦 *የቅርብ ጊዜ ትዕዛዞቾ:*\n\n' : '📦 *Your Recent Orders:*\n\n';
  for (const o of orders) {
    text += `${statusEmoji[o.status] || '📦'} \`${o.orderNumber}\` — ${statusLabel[lang]?.[o.status] || o.status}\n`;
    text += `   🏪 ${o.vendor.name}\n`;
    text += `   💰 ${o.finalTotal.toFixed(2)} ${lang === 'am' ? 'ብር' : 'ETB'}\n`;
    if (o.address) text += `   📍 ${o.address}\n`;
    const items = o.items.map(i => `${i.product.name} ×${i.quantity}`).join(', ');
    text += `   🛒 ${items}\n\n`;
  }

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([[Markup.button.webApp(lang === 'am' ? 'ሁሉንም ይመልከቱ' : 'View All Orders', `${MINI_APP_URL}/orders`)]]),
  });
}

// ─── Vendor registration flow ─────────────────────────────────────────────────
const VENDOR_CATEGORIES = ['Groceries','Fashion','Electronics','Food & Drinks','Beauty','Health','Home & Garden','Books','Sports','Services','Art & Crafts','Other'];
const VENDOR_STEPS = ['name','category','phone','address','description','confirm'];

async function startVendorFlow(ctx) {
  const lang = ctx.lang;
  const existing = await prisma.vendor.findUnique({ where: { ownerId: ctx.dbUser.id } });
  if (existing) {
    const status = existing.approved
      ? (lang === 'am' ? '✅ ጸድቋል' : '✅ Approved')
      : (lang === 'am' ? '⏳ ፍቃድ እየጠበቀ ነው' : '⏳ Pending approval');
    return ctx.reply(
      lang === 'am'
        ? `የሻጭ መለያ አለዎት (${status}): *${existing.name}*\n\nሱቅዎን ለማስተዳደር:`
        : `You already have a vendor account (${status}): *${existing.name}*\n\nTo manage your shop:`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.webApp(lang === 'am' ? '🛠️ ሱቅ ያስተዳድሩ' : '🛠️ Manage Shop', `${MINI_APP_URL}/vendor`)]]),
      }
    );
  }

  setSession(ctx.from.id, { flow: 'vendor_register', step: 'name', data: {} });
  await ctx.reply(
    lang === 'am'
      ? '🏪 *ሻጭ ለመሆን ማመልከቻ*\n\nቀላል ጥያቄዎችን እንጠይቅዎታለን። ለማቆም /menu ይፃፉ።\n\n*ደረጃ 1/5* — የሱቅ ስምዎ ምን ይሆናል?'
      : '🏪 *Vendor Application*\n\nWe\'ll ask you a few quick questions. Send /menu to cancel.\n\n*Step 1/5* — What is your shop name?',
    { parse_mode: 'Markdown', ...Markup.removeKeyboard() }
  );
}

// ─── Category selection during vendor flow ────────────────────────────────────
bot.action(/vendor_cat_(.+)/, async (ctx) => {
  const category = ctx.match[1];
  const session = getSession(ctx.from.id);
  if (!session || session.flow !== 'vendor_register' || session.step !== 'category') {
    return ctx.answerCbQuery('Session expired. Use /become_vendor to restart.');
  }
  await ctx.answerCbQuery();
  session.data.category = category;
  session.step = 'phone';
  setSession(ctx.from.id, session);
  const lang = ctx.lang;
  await ctx.editMessageText(
    lang === 'am'
      ? `📂 ምድብ: *${category}* ✅\n\n*ደረጃ 3/5* — ስልክ ቁጥርዎ ምን ነው? (+251...)`
      : `📂 Category: *${category}* ✅\n\n*Step 3/5* — What's your phone number? (+251...)`,
    { parse_mode: 'Markdown' }
  );
});

bot.action('vendor_skip_phone', async (ctx) => {
  const session = getSession(ctx.from.id);
  if (!session || session.flow !== 'vendor_register' || session.step !== 'phone') return ctx.answerCbQuery('Session expired.');
  await ctx.answerCbQuery();
  session.data.phone = '';
  session.step = 'address';
  setSession(ctx.from.id, session);
  const lang = ctx.lang;
  await ctx.reply(
    lang === 'am'
      ? '*ደረጃ 4/5* — ሱቅዎ የሚገኝበት አድራሻ ወይም ቦታ ይፃፉ (ለምሳሌ: ቦሌ, አዲስ አበባ)\n\nAir ለመዝለል "skip" ይፃፉ'
      : '*Step 4/5* — Where is your shop located? (e.g. Bole, Addis Ababa)\n\nSend "skip" to skip',
    { parse_mode: 'Markdown' }
  );
});

bot.action('vendor_skip_address', async (ctx) => {
  const session = getSession(ctx.from.id);
  if (!session || session.flow !== 'vendor_register' || session.step !== 'address') return ctx.answerCbQuery('Session expired.');
  await ctx.answerCbQuery();
  session.data.address = '';
  session.step = 'description';
  setSession(ctx.from.id, session);
  const lang = ctx.lang;
  await ctx.reply(
    lang === 'am'
      ? '*ደረጃ 5/5* — ሱቅዎን ይግለጹ (አማራጭ)\n\nAir ለመዝለል "skip" ይፃፉ'
      : '*Step 5/5* — Describe your shop (optional)\n\nSend "skip" to skip',
    { parse_mode: 'Markdown' }
  );
});

bot.action('vendor_confirm', async (ctx) => {
  const session = getSession(ctx.from.id);
  if (!session || session.flow !== 'vendor_register') return ctx.answerCbQuery('Session expired.');
  await ctx.answerCbQuery('⏳ Submitting...');

  const { name, category, phone, address, description } = session.data;
  try {
    await prisma.vendor.create({
      data: {
        name, category, phone, address, description,
        ownerId: ctx.dbUser.id,
        approved: false,
      },
    });
    await prisma.user.update({ where: { id: ctx.dbUser.id }, data: { role: 'VENDOR' } });
  } catch (e) {
    clearSession(ctx.from.id);
    return ctx.reply('❌ Failed to submit. Please try again with /become_vendor');
  }

  clearSession(ctx.from.id);
  const lang = ctx.lang;
  await ctx.editMessageText(
    lang === 'am'
      ? `✅ *ማመልከቻ ቀርቧል!*\n\nሱቅዎ "${name}" ለክለሳ ተልኳል።\nብዙ ጊዜ በ24 ሰዓት ውስጥ ሲጸድቅ በቴሌግራም እናሳውቅዎታለን።`
      : `✅ *Application Submitted!*\n\nYour shop "${name}" has been sent for review.\nWe'll notify you via Telegram once approved — usually within 24 hours.`,
    { parse_mode: 'Markdown' }
  );

  // Notify admin
  const adminIds = (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  for (const adminId of adminIds) {
    bot.telegram.sendMessage(
      adminId,
      `🆕 *New Vendor Application*\n\n🏪 ${name}\n📂 ${category}\n📞 ${phone || '—'}\n📍 ${address || '—'}\n📝 ${description || '—'}\n👤 @${ctx.from.username || ctx.from.first_name}`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[
          Markup.button.callback('✅ Approve', `approve_vendor_new_${ctx.dbUser.id}`),
          Markup.button.callback('❌ Reject', `reject_vendor_new_${ctx.dbUser.id}`),
        ]]),
      }
    ).catch(() => {});
  }
});

bot.action('vendor_edit', async (ctx) => {
  const session = getSession(ctx.from.id);
  if (!session || session.flow !== 'vendor_register') return ctx.answerCbQuery('Session expired.');
  await ctx.answerCbQuery();
  session.step = 'name';
  setSession(ctx.from.id, session);
  const lang = ctx.lang;
  await ctx.reply(
    lang === 'am' ? '✏️ *ደረጃ 1/5* — አዲስ የሱቅ ስም ያስፈልጋል:' : '✏️ *Step 1/5* — Enter new shop name:',
    { parse_mode: 'Markdown' }
  );
});

// ─── Vendor dashboard ─────────────────────────────────────────────────────────
async function showVendorDashboard(ctx) {
  const lang = ctx.lang;
  const vendor = await prisma.vendor.findUnique({ where: { ownerId: ctx.dbUser.id } });
  if (!vendor) {
    return ctx.reply(
      lang === 'am' ? 'የሻጭ መለያ የለዎትም።' : 'No vendor account.',
      Markup.inlineKeyboard([[Markup.button.callback(lang === 'am' ? '🏪 ሻጭ ለመሆን' : '🏪 Become a Vendor', 'become_vendor_start')]])
    );
  }
  if (!vendor.approved) {
    return ctx.reply(t(lang, 'vendor_pending', vendor.name), { parse_mode: 'Markdown' });
  }

  const [products, pendingOrders, todayRevenue, weekRevenue, reviews] = await Promise.all([
    prisma.product.count({ where: { vendorId: vendor.id, active: true } }),
    prisma.order.count({ where: { vendorId: vendor.id, status: 'PENDING' } }),
    prisma.order.aggregate({ _sum: { finalTotal: true }, where: { vendorId: vendor.id, createdAt: { gte: new Date(new Date().setHours(0,0,0,0)) }, status: { not: 'CANCELLED' } } }),
    prisma.order.aggregate({ _sum: { finalTotal: true }, where: { vendorId: vendor.id, createdAt: { gte: new Date(Date.now() - 7 * 86400000) }, status: { not: 'CANCELLED' } } }),
    prisma.review.aggregate({ _avg: { rating: true }, _count: true, where: { vendorId: vendor.id } }),
  ]);

  const todayRev = todayRevenue._sum.finalTotal || 0;
  const weekRev = weekRevenue._sum.finalTotal || 0;
  const rating = reviews._avg.rating ? reviews._avg.rating.toFixed(1) : '—';

  const msg = lang === 'am'
    ? `🏪 *${vendor.name}* ዳሽቦርድ\n\n📦 ምርቶች: *${products}*\n🆕 አዲስ ትዕዛዞቾ: *${pendingOrders}*\n💰 ዛሬ: *${todayRev.toFixed(2)} ብር*\n📅 ሳምንት: *${weekRev.toFixed(2)} ብር*\n💼 ጠቅላላ: *${(vendor.totalRevenue || 0).toFixed(2)} ብር*\n⭐ ደረጃ: *${rating}* (${reviews._count})`
    : `🏪 *${vendor.name}* Dashboard\n\n📦 Products: *${products}*\n🆕 Pending Orders: *${pendingOrders}*\n💰 Today: *${todayRev.toFixed(2)} ETB*\n📅 This Week: *${weekRev.toFixed(2)} ETB*\n💼 Total: *${(vendor.totalRevenue || 0).toFixed(2)} ETB*\n⭐ Rating: *${rating}* (${reviews._count})`;

  await ctx.reply(msg, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback(lang === 'am' ? '📋 ትዕዛዞቾን ይመልከቱ' : '📋 View Active Orders', `vendor_orders_${vendor.id}`)],
      [Markup.button.webApp(lang === 'am' ? '🛠️ ሙሉ ዳሽቦርድ' : '🛠️ Full Dashboard', `${MINI_APP_URL}/vendor`)],
    ]),
  });
}

// ─── Vendor orders (active) ───────────────────────────────────────────────────
async function showVendorOrders(ctx) {
  const lang = ctx.lang;
  const vendor = await prisma.vendor.findUnique({ where: { ownerId: ctx.dbUser.id } });
  if (!vendor?.approved) return ctx.reply(lang === 'am' ? 'ጸድቃ የሻጭ መለያ ያስፈልጋል።' : 'You need an approved vendor account.');

  const orders = await prisma.order.findMany({
    where: { vendorId: vendor.id, status: { in: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY'] } },
    include: { user: true, items: { include: { product: true } } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  if (!orders.length) {
    return ctx.reply(lang === 'am' ? '🎉 አሁን ምንም ንቁ ትዕዛዝ የለም።' : '🎉 No active orders right now.');
  }

  const STATUS_NEXT = { PENDING: 'CONFIRMED', CONFIRMED: 'PREPARING', PREPARING: 'READY', READY: 'DELIVERED' };
  const STATUS_LABEL = {
    en: { PENDING: '✅ Confirm', CONFIRMED: '👨‍🍳 Preparing', PREPARING: '🎁 Ready', READY: '🏠 Delivered' },
    am: { PENDING: '✅ አረጋግጥ', CONFIRMED: '👨‍🍳 እያዘጋጀ', PREPARING: '🎁 ዝግጁ', READY: '🏠 ደርሷል' },
  };

  for (const order of orders) {
    const statusEmoji = { PENDING: '⏳', CONFIRMED: '✅', PREPARING: '👨‍🍳', READY: '🎁' };
    let text = `${statusEmoji[order.status]} \`${order.orderNumber}\`\n`;
    text += `👤 ${order.user.firstName || order.user.username || 'Customer'}${order.user.phone ? ` • ${order.user.phone}` : ''}\n`;
    text += `💰 ${order.finalTotal.toFixed(2)} ${lang === 'am' ? 'ብር' : 'ETB'}\n`;
    if (order.address) text += `📍 ${order.address}\n`;
    text += `\n`;
    order.items.forEach(item => { text += `• ${item.product.name} ×${item.quantity} — ${(item.price * item.quantity).toFixed(2)} ETB\n`; });

    const nextStatus = STATUS_NEXT[order.status];
    const buttons = [];
    if (nextStatus) {
      buttons.push([Markup.button.callback(STATUS_LABEL[lang]?.[order.status] || nextStatus, `order_status_${order.id}_${nextStatus}`)]);
    }
    if (order.status === 'PENDING') {
      buttons.push([Markup.button.callback(lang === 'am' ? '❌ ሰርዝ' : '❌ Cancel', `order_status_${order.id}_CANCELLED`)]);
    }

    await ctx.reply(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) });
  }
}

bot.action(/vendor_orders_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery();
  await showVendorOrders(ctx);
});

// ─── General text handler (multi-step flows) ──────────────────────────────────
bot.on('text', async (ctx) => {
  const session = getSession(ctx.from.id);
  if (!session) return; // No active flow, ignore

  const text = ctx.message.text.trim();
  const lang = ctx.lang;

  // Vendor registration flow
  if (session.flow === 'vendor_register') {
    if (text === '/menu' || text === '⬅️ Main Menu' || text === '⬅️ ዋና ምናሌ') {
      clearSession(ctx.from.id);
      return ctx.reply(lang === 'am' ? 'ማመልከቻ ተሰርዟል።' : 'Application cancelled.', mainMenu(lang));
    }

    switch (session.step) {
      case 'name': {
        if (text.length < 2) return ctx.reply(lang === 'am' ? 'ስሙ በጣም አጭር ነው። እንደገና ይሞክሩ:' : 'Name is too short. Try again:');
        session.data.name = text;
        session.step = 'category';
        setSession(ctx.from.id, session);

        const catRows = [];
        for (let i = 0; i < VENDOR_CATEGORIES.length; i += 3) {
          catRows.push(VENDOR_CATEGORIES.slice(i, i + 3).map(cat =>
            Markup.button.callback(cat, `vendor_cat_${cat}`)
          ));
        }

        await ctx.reply(
          lang === 'am'
            ? `✅ ስም: *${text}*\n\n*ደረጃ 2/5* — ምን ዓይነት ምርቶች ይሸጣሉ? ምድብ ይምረጡ:`
            : `✅ Name: *${text}*\n\n*Step 2/5* — What do you sell? Choose a category:`,
          { parse_mode: 'Markdown', ...Markup.inlineKeyboard(catRows) }
        );
        break;
      }

      case 'phone': {
        const skip = text.toLowerCase() === 'skip';
        session.data.phone = skip ? '' : text;
        session.step = 'address';
        setSession(ctx.from.id, session);
        await ctx.reply(
          lang === 'am'
            ? `*ደረጃ 4/5* — ሱቅዎ የሚገኝበት አድራሻ (ለምሳሌ: ቦሌ, አዲስ አበባ)\n\nለመዝለል "skip" ይፃፉ`
            : `*Step 4/5* — Where is your shop? (e.g. Bole, Addis Ababa)\n\nSend "skip" to skip`,
          { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback(lang === 'am' ? 'ዝለል' : 'Skip', 'vendor_skip_address')]]) }
        );
        break;
      }

      case 'address': {
        const skip = text.toLowerCase() === 'skip';
        session.data.address = skip ? '' : text;
        session.step = 'description';
        setSession(ctx.from.id, session);
        await ctx.reply(
          lang === 'am'
            ? `*ደረጃ 5/5* — ሱቅዎን ይግለጹ (ለደንበኞቾ)\n\nለመዝለል "skip" ይፃፉ`
            : `*Step 5/5* — Describe your shop for customers\n\nSend "skip" to skip`,
          { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback(lang === 'am' ? 'ዝለል' : 'Skip', 'vendor_skip_desc')]]) }
        );
        break;
      }

      case 'description': {
        const skip = text.toLowerCase() === 'skip';
        session.data.description = skip ? '' : text;
        session.step = 'confirm';
        setSession(ctx.from.id, session);

        const { name, category, phone, address, description } = session.data;
        const summary = lang === 'am'
          ? `📋 *ማመልከቻ ማጠቃለያ*\n\n🏪 ስም: *${name}*\n📂 ምድብ: *${category}*\n📞 ስልክ: *${phone || '—'}*\n📍 አድራሻ: *${address || '—'}*\n📝 መግለጫ: *${description || '—'}*\n\nሁሉም ነገር ትክክለኛ ነው?`
          : `📋 *Application Summary*\n\n🏪 Name: *${name}*\n📂 Category: *${category}*\n📞 Phone: *${phone || '—'}*\n📍 Address: *${address || '—'}*\n📝 Description: *${description || '—'}*\n\nDoes everything look correct?`;

        await ctx.reply(summary, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback(lang === 'am' ? '✅ አስቀምጥ' : '✅ Submit', 'vendor_confirm')],
            [Markup.button.callback(lang === 'am' ? '✏️ አርትዕ' : '✏️ Edit', 'vendor_edit')],
          ]),
        });
        break;
      }

      default:
        clearSession(ctx.from.id);
        await ctx.reply(lang === 'am' ? 'ክፍለ ጊዜ ጊዜ አልፎት ወጣ።' : 'Session expired.', mainMenu(lang));
    }
  }
});

bot.action('vendor_skip_desc', async (ctx) => {
  const session = getSession(ctx.from.id);
  if (!session || session.flow !== 'vendor_register') return ctx.answerCbQuery('Session expired.');
  await ctx.answerCbQuery();
  session.data.description = '';
  session.step = 'confirm';
  setSession(ctx.from.id, session);
  const lang = ctx.lang;
  const { name, category, phone, address } = session.data;
  const summary = lang === 'am'
    ? `📋 *ማመልከቻ ማጠቃለያ*\n\n🏪 ስም: *${name}*\n📂 ምድብ: *${category}*\n📞 ስልክ: *${phone || '—'}*\n📍 አድራሻ: *${address || '—'}*\n📝 መግለጫ: *—*\n\nሁሉም ነገር ትክክለኛ ነው?`
    : `📋 *Application Summary*\n\n🏪 Name: *${name}*\n📂 Category: *${category}*\n📞 Phone: *${phone || '—'}*\n📍 Address: *${address || '—'}*\n📝 Description: *—*\n\nDoes everything look correct?`;
  await ctx.reply(summary, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback(lang === 'am' ? '✅ አስቀምጥ' : '✅ Submit', 'vendor_confirm')],
      [Markup.button.callback(lang === 'am' ? '✏️ አርትዕ' : '✏️ Edit', 'vendor_edit')],
    ]),
  });
});

bot.action('become_vendor_start', async (ctx) => {
  await ctx.answerCbQuery();
  await startVendorFlow(ctx);
});

// ─── Approve/reject vendor (admin) — by vendor ID ────────────────────────────
bot.action(/approve_vendor_(\d+)/, async (ctx) => {
  if (ctx.dbUser.role !== 'ADMIN') return ctx.answerCbQuery('Not authorized');
  const vendorId = parseInt(ctx.match[1]);
  const vendor = await prisma.vendor.update({
    where: { id: vendorId },
    data: { approved: true },
    include: { owner: true },
  });
  await ctx.answerCbQuery('✅ Approved!');
  await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
  await ctx.reply(`✅ *${vendor.name}* approved!`, { parse_mode: 'Markdown' });
  const ownerLang = vendor.owner.language || 'en';
  bot.telegram.sendMessage(vendor.owner.telegramId, t(ownerLang, 'vendor_approved_notif', vendor.name), {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([[Markup.button.webApp(ownerLang === 'am' ? '🛠️ ሱቅ ያስተዳድሩ' : '🛠️ Manage Shop', `${MINI_APP_URL}/vendor`)]]),
  }).catch(() => {});
});

// ─── Approve/reject vendor — by owner user ID (from inline application) ──────
bot.action(/approve_vendor_new_(\d+)/, async (ctx) => {
  if (ctx.dbUser.role !== 'ADMIN') return ctx.answerCbQuery('Not authorized');
  const ownerId = parseInt(ctx.match[1]);
  const vendor = await prisma.vendor.findUnique({ where: { ownerId }, include: { owner: true } });
  if (!vendor) return ctx.answerCbQuery('Vendor not found');
  await prisma.vendor.update({ where: { id: vendor.id }, data: { approved: true } });
  await ctx.answerCbQuery('✅ Approved!');
  await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
  await ctx.reply(`✅ *${vendor.name}* approved!`, { parse_mode: 'Markdown' });
  const ownerLang = vendor.owner.language || 'en';
  bot.telegram.sendMessage(vendor.owner.telegramId, t(ownerLang, 'vendor_approved_notif', vendor.name), {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([[Markup.button.webApp(ownerLang === 'am' ? '🛠️ ሱቅ ያስተዳድሩ' : '🛠️ Manage Shop', `${MINI_APP_URL}/vendor`)]]),
  }).catch(() => {});
});

bot.action(/reject_vendor_(\d+)/, async (ctx) => {
  if (ctx.dbUser.role !== 'ADMIN') return ctx.answerCbQuery('Not authorized');
  const vendorId = parseInt(ctx.match[1]);
  const vendor = await prisma.vendor.update({ where: { id: vendorId }, data: { active: false }, include: { owner: true } });
  await ctx.answerCbQuery('❌ Rejected');
  await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
  const ownerLang = vendor.owner.language || 'en';
  bot.telegram.sendMessage(vendor.owner.telegramId, t(ownerLang, 'vendor_rejected', vendor.name), { parse_mode: 'Markdown' }).catch(() => {});
});

bot.action(/reject_vendor_new_(\d+)/, async (ctx) => {
  if (ctx.dbUser.role !== 'ADMIN') return ctx.answerCbQuery('Not authorized');
  const ownerId = parseInt(ctx.match[1]);
  const vendor = await prisma.vendor.findUnique({ where: { ownerId }, include: { owner: true } });
  if (!vendor) return ctx.answerCbQuery('Vendor not found');
  await prisma.vendor.update({ where: { id: vendor.id }, data: { active: false } });
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

  if (newStatus === 'DELIVERED') {
    const pointsEarned = Math.floor(order.finalTotal / 10);
    await prisma.user.update({ where: { id: order.userId }, data: { points: { increment: pointsEarned } } });
    await prisma.order.update({ where: { id: orderId }, data: { pointsEarned } });
    await prisma.vendor.update({ where: { id: order.vendorId }, data: { totalRevenue: { increment: order.finalTotal } } });
  }

  await ctx.answerCbQuery(`✅ Marked as ${newStatus}`);
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
    }, 60000);
  }

  bot.telegram.sendMessage(order.user.telegramId, notifMsg, { parse_mode: 'Markdown' }).catch(() => {});
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

  await prisma.review.create({ data: { rating, orderId, userId: ctx.dbUser.id, vendorId: order.vendorId } });
  const reviews = await prisma.review.aggregate({ _avg: { rating: true }, _count: true, where: { vendorId: order.vendorId } });
  await prisma.vendor.update({ where: { id: order.vendorId }, data: { rating: reviews._avg.rating || 0, reviewCount: reviews._count } });
  await prisma.user.update({ where: { id: ctx.dbUser.id }, data: { points: { increment: 10 } } });

  await ctx.answerCbQuery(lang === 'am' ? '✅ ምስጋና!' : '✅ Thanks!');
  await ctx.editMessageText(
    lang === 'am'
      ? `${'⭐'.repeat(rating)} ምዘናዎ ለ *${order.vendor.name}* ተቀምጧል!\n\n+10 ነጥቦች አሸነፉ ⭐`
      : `${'⭐'.repeat(rating)} Review saved for *${order.vendor.name}*!\n\n+10 loyalty points earned ⭐`,
    { parse_mode: 'Markdown' }
  );
});

// ─── Admin commands ───────────────────────────────────────────────────────────
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
        [Markup.button.callback('📊 Send Weekly Report', 'admin_send_report')],
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
  if (!vendors.length) return ctx.reply('✅ No pending vendors.');
  for (const v of vendors) {
    await ctx.reply(
      `🏪 *${v.name}*\n📂 ${v.category || '—'}\n📝 ${v.description || '—'}\n📞 ${v.phone || '—'}\n📍 ${v.address || '—'}\n👤 @${v.owner.username || v.owner.firstName}`,
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
  await ctx.answerCbQuery('⏳ Sending...');
  const { sendWeeklyReports } = require('../services/weeklyReport');
  await sendWeeklyReports(bot);
  await ctx.reply('✅ Weekly reports sent!');
});

bot.action('admin_broadcast_prompt', async (ctx) => {
  if (ctx.dbUser.role !== 'ADMIN') return ctx.answerCbQuery('Not authorized');
  await ctx.answerCbQuery();
  await ctx.reply('📢 Use:\n\n`/broadcast Your message here`', { parse_mode: 'Markdown' });
});

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

// ─── /vendors command ─────────────────────────────────────────────────────────
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

// ─── Help ─────────────────────────────────────────────────────────────────────
bot.action('help', async (ctx) => { await ctx.answerCbQuery(); await ctx.reply(t(ctx.lang, 'help_text'), { parse_mode: 'Markdown' }); });
bot.help((ctx) => ctx.reply(t(ctx.lang, 'help_text'), { parse_mode: 'Markdown' }));

// ─── Webhook / polling setup ──────────────────────────────────────────────────
async function setupBotWebhook() {
  const webhookUrl = `${process.env.WEBHOOK_URL}/webhook`;
  await bot.telegram.setWebhook(webhookUrl);
}

module.exports = { bot, setupBotWebhook };
