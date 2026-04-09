const express = require('express');
const router = express.Router();
const { prisma } = require('../../services/db');
const { telegramAuth, requireAdmin, requireVendor } = require('../middleware/auth');

// GET /api/ads/active — get active ads (for Mini App display)
router.get('/active', async (req, res) => {
  const now = new Date();
  const ads = await prisma.ad.findMany({
    where: { active: true, startDate: { lte: now }, endDate: { gte: now } },
    include: {
      vendor: { select: { id: true, name: true, logoUrl: true } },
      product: { select: { id: true, name: true, price: true, imageUrl: true } },
    },
    orderBy: { impressions: 'asc' },
    take: 10,
  });

  // Track impressions
  for (const ad of ads) {
    prisma.ad.update({ where: { id: ad.id }, data: { impressions: { increment: 1 } } }).catch(() => {});
  }

  res.json(ads);
});

// GET /api/ads/featured-vendors — featured vendor ads
router.get('/featured-vendors', async (req, res) => {
  const vendors = await prisma.vendor.findMany({
    where: { approved: true, active: true, featured: true },
    take: 5,
    orderBy: { rating: 'desc' },
  });
  res.json(vendors);
});

// POST /api/ads/:id/click — track click
router.post('/:id/click', async (req, res) => {
  await prisma.ad.update({ where: { id: parseInt(req.params.id) }, data: { clicks: { increment: 1 } } }).catch(() => {});
  res.json({ ok: true });
});

// POST /api/ads — vendor creates ad (boost product/shop)
router.post('/', telegramAuth, requireVendor, async (req, res) => {
  const { title, description, imageUrl, type, productId, durationDays = 7, budget = 0 } = req.body;
  if (!title || !type) return res.status(400).json({ error: 'title and type required' });

  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + durationDays * 86400000);

  const vendor = req.vendor || await prisma.vendor.findUnique({ where: { ownerId: req.user.id } });

  const ad = await prisma.ad.create({
    data: {
      title,
      description,
      imageUrl,
      type,
      startDate,
      endDate,
      budget: parseFloat(budget),
      vendorId: vendor.id,
      productId: productId ? parseInt(productId) : null,
    },
  });

  // Featured vendor promotion
  if (type === 'featured_vendor') {
    await prisma.vendor.update({ where: { id: vendor.id }, data: { featured: true } });
    // Schedule un-featuring
    setTimeout(async () => {
      await prisma.vendor.update({ where: { id: vendor.id }, data: { featured: false } }).catch(() => {});
    }, durationDays * 86400000);
  }

  res.status(201).json(ad);
});

// GET /api/ads/mine — vendor's own ads
router.get('/mine', telegramAuth, requireVendor, async (req, res) => {
  const vendor = req.vendor || await prisma.vendor.findUnique({ where: { ownerId: req.user.id } });
  const ads = await prisma.ad.findMany({
    where: { vendorId: vendor.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json(ads);
});

// Admin: manage all ads
router.get('/admin/all', telegramAuth, requireAdmin, async (req, res) => {
  const ads = await prisma.ad.findMany({
    include: { vendor: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(ads);
});

router.patch('/admin/:id', telegramAuth, requireAdmin, async (req, res) => {
  const ad = await prisma.ad.update({ where: { id: parseInt(req.params.id) }, data: req.body });
  res.json(ad);
});

module.exports = router;
