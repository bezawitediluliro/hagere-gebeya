const cron = require('node-cron');
const { sendWeeklyReports } = require('./weeklyReport');
const { prisma } = require('./db');

function startCronJobs(bot) {
  // Weekly reports — every Monday at 8:00 AM
  cron.schedule('0 8 * * 1', async () => {
    console.log('⏰ Running weekly reports...');
    await sendWeeklyReports(bot).catch(console.error);
  }, { timezone: 'Africa/Addis_Ababa' });

  // Expire discounts check — every hour
  cron.schedule('0 * * * *', async () => {
    await prisma.discount.updateMany({
      where: { expiresAt: { lt: new Date() }, active: true },
      data: { active: false },
    });
  });

  // Review reminders — every day at 10 AM
  // Remind customers to review delivered orders from yesterday
  cron.schedule('0 10 * * *', async () => {
    const yesterday = new Date(Date.now() - 86400000);
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000);

    const unreviewed = await prisma.order.findMany({
      where: {
        status: 'DELIVERED',
        updatedAt: { gte: twoDaysAgo, lte: yesterday },
        review: null,
      },
      include: { user: true },
      take: 100,
    });

    const { Markup } = require('telegraf');
    for (const order of unreviewed) {
      const lang = order.user.language || 'en';
      const { t } = require('./i18n');
      bot.telegram.sendMessage(
        order.user.telegramId,
        t(lang, 'review_prompt', order.orderNumber),
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [1, 2, 3, 4, 5].map(n =>
              Markup.button.callback(`${'⭐'.repeat(n)}`, `review_${order.id}_${n}`)
            ),
          ]),
        }
      ).catch(() => {});
    }
  }, { timezone: 'Africa/Addis_Ababa' });

  // Flash sale expiry notifications — every 30 mins
  cron.schedule('*/30 * * * *', async () => {
    // Notify vendors whose flash sale products are ending in 1 hour
    const soonExpiry = new Date(Date.now() + 3600000);
    // (Placeholder for flash sale product expiry logic)
  });

  console.log('✅ Cron jobs started (Africa/Addis_Ababa timezone)');
}

module.exports = { startCronJobs };
