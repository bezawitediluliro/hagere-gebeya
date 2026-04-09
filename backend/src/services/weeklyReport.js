const { prisma } = require('./db');
const { t } = require('./i18n');

async function sendWeeklyReports(bot) {
  const now = new Date();
  const weekEnd = new Date(now);
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);

  console.log(`📊 Sending weekly reports for ${weekStart.toDateString()} – ${weekEnd.toDateString()}`);

  // ─── Admin Report ─────────────────────────────────────────────────────────
  const [totalOrders, totalRevenue, newUsers, newVendors, topVendors] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: weekStart }, status: { not: 'CANCELLED' } } }),
    prisma.order.aggregate({ _sum: { finalTotal: true }, where: { createdAt: { gte: weekStart }, status: { not: 'CANCELLED' } } }),
    prisma.user.count({ where: { createdAt: { gte: weekStart } } }),
    prisma.vendor.count({ where: { createdAt: { gte: weekStart } } }),
    prisma.order.groupBy({
      by: ['vendorId'],
      _sum: { finalTotal: true },
      _count: true,
      where: { createdAt: { gte: weekStart }, status: { not: 'CANCELLED' } },
      orderBy: { _sum: { finalTotal: 'desc' } },
      take: 5,
    }),
  ]);

  const vendorDetails = await Promise.all(
    topVendors.map(v => prisma.vendor.findUnique({ where: { id: v.vendorId }, select: { name: true } }))
  );

  const revenue = totalRevenue._sum.finalTotal || 0;
  const adminIds = (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(s => s.trim()).filter(Boolean);

  let adminMsg = `📊 *Weekly Admin Report*\n`;
  adminMsg += `📅 ${weekStart.toLocaleDateString()} – ${weekEnd.toLocaleDateString()}\n\n`;
  adminMsg += `📦 Total Orders: *${totalOrders}*\n`;
  adminMsg += `💰 Total Revenue: *${revenue.toFixed(2)} ETB*\n`;
  adminMsg += `👥 New Users: *${newUsers}*\n`;
  adminMsg += `🏪 New Vendors: *${newVendors}*\n\n`;
  adminMsg += `🏆 *Top Vendors:*\n`;
  topVendors.forEach((v, i) => {
    const name = vendorDetails[i]?.name || 'Unknown';
    adminMsg += `${i + 1}. ${name} — ${(v._sum.finalTotal || 0).toFixed(0)} ETB (${v._count} orders)\n`;
  });

  for (const adminId of adminIds) {
    bot.telegram.sendMessage(adminId, adminMsg, { parse_mode: 'Markdown' }).catch(() => {});
  }

  // ─── Per-Vendor Reports ───────────────────────────────────────────────────
  const vendors = await prisma.vendor.findMany({
    where: { approved: true, active: true },
    include: { owner: true },
  });

  for (const vendor of vendors) {
    const [vendorOrders, vendorRevenue, topProducts, newCustomers, reviewStats] = await Promise.all([
      prisma.order.count({ where: { vendorId: vendor.id, createdAt: { gte: weekStart }, status: { not: 'CANCELLED' } } }),
      prisma.order.aggregate({ _sum: { finalTotal: true }, where: { vendorId: vendor.id, createdAt: { gte: weekStart }, status: { not: 'CANCELLED' } } }),
      prisma.orderItem.groupBy({
        by: ['productId'],
        _sum: { quantity: true },
        where: { order: { vendorId: vendor.id, createdAt: { gte: weekStart } } },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 3,
      }),
      prisma.order.findMany({ where: { vendorId: vendor.id, createdAt: { gte: weekStart } }, select: { userId: true }, distinct: ['userId'] }),
      prisma.review.aggregate({ _avg: { rating: true }, _count: true, where: { vendorId: vendor.id, createdAt: { gte: weekStart } } }),
    ]);

    const vRevenue = vendorRevenue._sum.finalTotal || 0;
    if (vendorOrders === 0) continue; // skip vendors with no activity

    const productNames = await Promise.all(
      topProducts.map(p => prisma.product.findUnique({ where: { id: p.productId }, select: { name: true } }))
    );

    const lang = vendor.owner.language || 'en';

    let msg = `📊 *${vendor.name} — ${t(lang, 'vendor_weekly_report').replace('📊 ', '')}*\n`;
    msg += `📅 ${weekStart.toLocaleDateString()} – ${weekEnd.toLocaleDateString()}\n\n`;
    msg += `📦 ${lang === 'am' ? 'ትዕዛዞች' : 'Orders'}: *${vendorOrders}*\n`;
    msg += `💰 ${lang === 'am' ? 'ገቢ' : 'Revenue'}: *${vRevenue.toFixed(2)} ETB*\n`;
    msg += `👥 ${lang === 'am' ? 'ደንበኞች' : 'Customers'}: *${newCustomers.length}*\n`;

    if (reviewStats._count > 0) {
      msg += `⭐ ${lang === 'am' ? 'አማካኝ ደረጃ' : 'Avg Rating'}: *${(reviewStats._avg.rating || 0).toFixed(1)}/5* (${reviewStats._count} reviews)\n`;
    }

    if (topProducts.length) {
      msg += `\n🏆 ${lang === 'am' ? 'ምርጥ ምርቶች' : 'Top Products'}:\n`;
      topProducts.forEach((p, i) => {
        msg += `${i + 1}. ${productNames[i]?.name || '?'} — ${p._sum.quantity || 0} ${lang === 'am' ? 'ተሸጠ' : 'sold'}\n`;
      });
    }

    // Performance tip
    if (vRevenue < 500) {
      msg += `\n💡 ${lang === 'am' ? 'ምክር: ምርቶቾን ለማስተዋወቅ ቅናሽ ኮድ ይፍጠሩ!' : 'Tip: Create a discount code to boost your sales!'}`;
    } else {
      msg += `\n💪 ${lang === 'am' ? 'እናንተ በደንብ አሰሩ! ቀጥሉ!' : 'Great week! Keep it up!'}`;
    }

    bot.telegram.sendMessage(vendor.owner.telegramId, msg, { parse_mode: 'Markdown' }).catch(() => {});

    // Save to DB
    await prisma.weeklyReport.create({
      data: {
        weekStart,
        weekEnd,
        vendorId: vendor.id,
        totalOrders: vendorOrders,
        totalRevenue: vRevenue,
        newCustomers: newCustomers.length,
        topProducts: JSON.stringify(productNames.map(p => p?.name)),
      },
    }).catch(() => {});
  }

  console.log('✅ Weekly reports sent');
}

module.exports = { sendWeeklyReports };
