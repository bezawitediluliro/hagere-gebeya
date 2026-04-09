const express = require('express');
const router = express.Router();
const { prisma } = require('../../services/db');
const { requireAdmin } = require('../middleware/auth');

router.use(requireAdmin);

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [
    totalUsers, totalVendors, pendingVendors,
    totalOrders, todayOrders, totalRevenue,
    activeProducts,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.vendor.count({ where: { approved: true } }),
    prisma.vendor.count({ where: { approved: false, active: true } }),
    prisma.order.count(),
    prisma.order.count({ where: { createdAt: { gte: today } } }),
    prisma.order.aggregate({ _sum: { finalTotal: true }, where: { status: { not: 'CANCELLED' } } }),
    prisma.product.count({ where: { active: true } }),
  ]);

  res.json({
    users: totalUsers,
    vendors: { approved: totalVendors, pending: pendingVendors },
    orders: { total: totalOrders, today: todayOrders },
    revenue: totalRevenue._sum.finalTotal || 0,
    products: activeProducts,
  });
});

// GET /api/admin/vendors
router.get('/vendors', async (req, res) => {
  const { approved, page = 1, limit = 20 } = req.query;
  const where = {};
  if (approved !== undefined) where.approved = approved === 'true';

  const [vendors, total] = await Promise.all([
    prisma.vendor.findMany({
      where,
      include: {
        owner: { select: { telegramId: true, username: true, firstName: true } },
        _count: { select: { products: true, orders: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit),
    }),
    prisma.vendor.count({ where }),
  ]);

  res.json({ vendors, total });
});

// PATCH /api/admin/vendors/:id
router.patch('/vendors/:id', async (req, res) => {
  const { approved, active } = req.body;
  const vendor = await prisma.vendor.update({
    where: { id: parseInt(req.params.id) },
    data: {
      approved: approved !== undefined ? approved : undefined,
      active: active !== undefined ? active : undefined,
    },
    include: { owner: true },
  });

  const { bot } = require('../../bot');
  if (approved === true) {
    bot.telegram.sendMessage(
      vendor.owner.telegramId,
      `🎉 Your shop *${vendor.name}* has been approved on Hager Gebeya! Use /vendor_dashboard to manage it.`,
      { parse_mode: 'Markdown' }
    ).catch(() => {});
  }

  res.json(vendor);
});

// GET /api/admin/orders
router.get('/orders', async (req, res) => {
  const { status, vendorId, page = 1, limit = 20 } = req.query;
  const where = {};
  if (status) where.status = status;
  if (vendorId) where.vendorId = parseInt(vendorId);

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        user: { select: { firstName: true, username: true, telegramId: true } },
        vendor: { select: { id: true, name: true } },
        items: { include: { product: { select: { name: true } } } },
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit),
    }),
    prisma.order.count({ where }),
  ]);

  res.json({ orders, total });
});

// PATCH /api/admin/orders/:id/status
router.patch('/orders/:id/status', async (req, res) => {
  const { status } = req.body;
  const order = await prisma.order.update({
    where: { id: parseInt(req.params.id) },
    data: { status },
    include: { user: true, vendor: true },
  });

  const { bot } = require('../../bot');
  bot.telegram.sendMessage(
    order.user.telegramId,
    `📦 Order \`${order.orderNumber}\` status updated to *${status}*`,
    { parse_mode: 'Markdown' }
  ).catch(() => {});

  res.json(order);
});

// GET /api/admin/users
router.get('/users', async (req, res) => {
  const { role, page = 1, limit = 20 } = req.query;
  const where = {};
  if (role) where.role = role;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { vendor: { select: { id: true, name: true, approved: true } } },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit),
    }),
    prisma.user.count({ where }),
  ]);

  res.json({ users, total });
});

// PATCH /api/admin/users/:id/role
router.patch('/users/:id/role', async (req, res) => {
  const { role } = req.body;
  if (!['CUSTOMER', 'VENDOR', 'ADMIN'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  const user = await prisma.user.update({ where: { id: parseInt(req.params.id) }, data: { role } });
  res.json(user);
});

// GET /api/admin/discounts
router.get('/discounts', async (req, res) => {
  const discounts = await prisma.discount.findMany({
    include: { vendor: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(discounts);
});

// POST /api/admin/discounts — create global discount
router.post('/discounts', async (req, res) => {
  const { code, type, value, minOrder, maxUses, expiresAt, vendorId } = req.body;
  if (!code || !type || value === undefined) {
    return res.status(400).json({ error: 'code, type, value required' });
  }

  const discount = await prisma.discount.create({
    data: {
      code: code.toUpperCase(),
      type,
      value: parseFloat(value),
      minOrder: minOrder ? parseFloat(minOrder) : null,
      maxUses: maxUses ? parseInt(maxUses) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      vendorId: vendorId ? parseInt(vendorId) : null,
    },
  });
  res.status(201).json(discount);
});

// DELETE /api/admin/discounts/:id
router.delete('/discounts/:id', async (req, res) => {
  await prisma.discount.update({
    where: { id: parseInt(req.params.id) },
    data: { active: false },
  });
  res.json({ success: true });
});

// POST /api/admin/broadcast — send message to all users
router.post('/broadcast', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });

  const users = await prisma.user.findMany({ select: { telegramId: true } });
  const { bot } = require('../../bot');

  let sent = 0, failed = 0;
  for (const user of users) {
    try {
      await bot.telegram.sendMessage(user.telegramId, message, { parse_mode: 'Markdown' });
      sent++;
    } catch {
      failed++;
    }
    await new Promise(r => setTimeout(r, 50)); // rate limit
  }

  res.json({ sent, failed, total: users.length });
});

module.exports = router;
