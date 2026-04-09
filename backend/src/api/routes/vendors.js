const express = require('express');
const router = express.Router();
const { prisma } = require('../../services/db');
const { telegramAuth, requireVendor } = require('../middleware/auth');

// GET /api/vendors — list approved vendors
router.get('/', async (req, res) => {
  const { category, search } = req.query;
  const where = { approved: true, active: true };
  if (category) where.category = category;
  if (search) where.name = { contains: search };

  const vendors = await prisma.vendor.findMany({
    where,
    include: {
      _count: { select: { products: { where: { active: true } } } },
    },
    orderBy: { name: 'asc' },
  });

  res.json(vendors.map(v => ({
    id: v.id,
    name: v.name,
    description: v.description,
    logoUrl: v.logoUrl,
    category: v.category,
    address: v.address,
    productCount: v._count.products,
  })));
});

// GET /api/vendors/categories — list unique categories
router.get('/categories', async (req, res) => {
  const vendors = await prisma.vendor.findMany({
    where: { approved: true, active: true, category: { not: null } },
    select: { category: true },
    distinct: ['category'],
  });
  res.json([...new Set(vendors.map(v => v.category).filter(Boolean))]);
});

// PATCH /api/vendors/:id — update own vendor profile
router.patch('/:id', telegramAuth, requireVendor, async (req, res) => {
  const vendorId = parseInt(req.params.id);
  if (req.vendor.id !== vendorId) return res.status(403).json({ error: 'Forbidden' });

  const { name, description, category, phone, address, logoUrl, bannerUrl } = req.body;
  const vendor = await prisma.vendor.update({
    where: { id: vendorId },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(description !== undefined && { description }),
      ...(category !== undefined && { category }),
      ...(phone !== undefined && { phone }),
      ...(address !== undefined && { address }),
      ...(logoUrl !== undefined && { logoUrl }),
      ...(bannerUrl !== undefined && { bannerUrl }),
    },
  });
  res.json(vendor);
});

// GET /api/vendors/:id — vendor details
router.get('/:id', async (req, res) => {
  const vendor = await prisma.vendor.findFirst({
    where: { id: parseInt(req.params.id), approved: true, active: true },
    include: {
      products: {
        where: { active: true },
        orderBy: { name: 'asc' },
      },
      discounts: {
        where: { active: true, expiresAt: { gt: new Date() } },
        select: { code: true, type: true, value: true, minOrder: true },
      },
    },
  });
  if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
  res.json(vendor);
});

// GET /api/vendors/:id/products — vendor products grouped by category
router.get('/:id/products', async (req, res) => {
  const { category } = req.query;
  const where = { vendorId: parseInt(req.params.id), active: true };
  if (category) where.category = category;

  const products = await prisma.product.findMany({
    where,
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });
  res.json(products);
});

// POST /api/vendors/:id/products — vendor adds product (vendor auth)
router.post('/:id/products', telegramAuth, requireVendor, async (req, res) => {
  const vendorId = parseInt(req.params.id);
  if (req.vendor?.id !== vendorId && req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Not your vendor' });
  }

  const { name, description, price, imageUrl, category, stock } = req.body;
  if (!name || !price) return res.status(400).json({ error: 'name and price required' });

  const product = await prisma.product.create({
    data: {
      name,
      description,
      price: parseFloat(price),
      imageUrl,
      category,
      stock: stock ? parseInt(stock) : 999,
      vendorId,
    },
  });
  res.status(201).json(product);
});

// PUT /api/vendors/:id/products/:productId
router.put('/:id/products/:productId', telegramAuth, requireVendor, async (req, res) => {
  const product = await prisma.product.findFirst({
    where: { id: parseInt(req.params.productId), vendorId: parseInt(req.params.id) },
  });
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const { name, description, price, imageUrl, category, stock, active } = req.body;
  const updated = await prisma.product.update({
    where: { id: product.id },
    data: {
      name: name ?? product.name,
      description: description ?? product.description,
      price: price ? parseFloat(price) : product.price,
      imageUrl: imageUrl ?? product.imageUrl,
      category: category ?? product.category,
      stock: stock !== undefined ? parseInt(stock) : product.stock,
      active: active !== undefined ? active : product.active,
    },
  });
  res.json(updated);
});

// DELETE /api/vendors/:id/products/:productId
router.delete('/:id/products/:productId', telegramAuth, requireVendor, async (req, res) => {
  const product = await prisma.product.findFirst({
    where: { id: parseInt(req.params.productId), vendorId: parseInt(req.params.id) },
  });
  if (!product) return res.status(404).json({ error: 'Product not found' });

  await prisma.product.update({ where: { id: product.id }, data: { active: false } });
  res.json({ success: true });
});

// GET /api/vendors/:id/discounts (vendor manage discounts)
router.get('/:id/discounts', telegramAuth, requireVendor, async (req, res) => {
  const discounts = await prisma.discount.findMany({
    where: { vendorId: parseInt(req.params.id) },
    orderBy: { createdAt: 'desc' },
  });
  res.json(discounts);
});

// POST /api/vendors/:id/discounts
router.post('/:id/discounts', telegramAuth, requireVendor, async (req, res) => {
  const { code, type, value, minOrder, maxUses, expiresAt } = req.body;
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
      vendorId: parseInt(req.params.id),
    },
  });
  res.status(201).json(discount);
});

// GET /api/vendors/:id/orders (vendor orders)
router.get('/:id/orders', telegramAuth, requireVendor, async (req, res) => {
  const { status } = req.query;
  const where = { vendorId: parseInt(req.params.id) };
  if (status) where.status = status;

  const orders = await prisma.order.findMany({
    where,
    include: {
      user: { select: { firstName: true, username: true, phone: true } },
      items: { include: { product: { select: { name: true } } } },
      payment: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(orders);
});

// PATCH /api/vendors/:id/orders/:orderId/status
router.patch('/:id/orders/:orderId/status', telegramAuth, requireVendor, async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['CONFIRMED', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const order = await prisma.order.findFirst({
    where: { id: parseInt(req.params.orderId), vendorId: parseInt(req.params.id) },
    include: { user: true, vendor: true },
  });
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const updated = await prisma.order.update({ where: { id: order.id }, data: { status } });

  // Bot notification
  const { bot } = require('../../bot');
  const msgs = {
    CONFIRMED: '✅ Your order has been confirmed!',
    PREPARING: '👨‍🍳 Your order is being prepared!',
    READY: '🎁 Your order is ready!',
    DELIVERED: '🏠 Order delivered. Enjoy!',
    CANCELLED: '❌ Your order was cancelled.',
  };
  bot.telegram.sendMessage(
    order.user.telegramId,
    `📦 *${order.orderNumber}* — ${msgs[status]}\n🏪 ${order.vendor.name}`,
    { parse_mode: 'Markdown' }
  ).catch(() => {});

  res.json(updated);
});

module.exports = router;
