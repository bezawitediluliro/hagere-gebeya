const express = require('express');
const router = express.Router();
const { prisma } = require('../../services/db');

// GET /api/user/me
router.get('/me', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: {
      vendor: {
        select: { id: true, name: true, approved: true, active: true },
      },
    },
  });
  res.json(user);
});

// PATCH /api/user/me
router.patch('/me', async (req, res) => {
  const { phone, firstName } = req.body;
  const updated = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      phone: phone ?? req.user.phone,
      firstName: firstName ?? req.user.firstName,
    },
  });
  res.json(updated);
});

// POST /api/user/vendor-apply
router.post('/vendor-apply', async (req, res) => {
  const existing = await prisma.vendor.findUnique({ where: { ownerId: req.user.id } });
  if (existing) return res.status(400).json({ error: 'You already have a vendor account', vendor: existing });

  const { name, description, category, phone, address } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  const vendor = await prisma.vendor.create({
    data: {
      name,
      description,
      category,
      phone,
      address,
      ownerId: req.user.id,
    },
  });

  await prisma.user.update({ where: { id: req.user.id }, data: { role: 'VENDOR' } });

  // Notify admins
  const { bot } = require('../../bot');
  const { Markup } = require('telegraf');
  const adminIds = (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  for (const adminId of adminIds) {
    bot.telegram.sendMessage(
      adminId,
      `🆕 *New Vendor Application*\n🏪 *${vendor.name}*\n📝 ${vendor.description || 'No description'}\n📂 ${vendor.category || 'No category'}`,
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

  res.status(201).json(vendor);
});

module.exports = router;
