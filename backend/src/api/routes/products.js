const express = require('express');
const router = express.Router();
const { prisma } = require('../../services/db');

// GET /api/products — search/browse all products
router.get('/', async (req, res) => {
  const { search, category, vendorId, minPrice, maxPrice, page = 1, limit = 20 } = req.query;

  const where = { active: true, vendor: { approved: true, active: true } };
  if (search) where.name = { contains: search };
  if (category) where.category = category;
  if (vendorId) where.vendorId = parseInt(vendorId);
  if (minPrice || maxPrice) {
    where.price = {};
    if (minPrice) where.price.gte = parseFloat(minPrice);
    if (maxPrice) where.price.lte = parseFloat(maxPrice);
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { vendor: { select: { id: true, name: true, logoUrl: true } } },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit),
    }),
    prisma.product.count({ where }),
  ]);

  res.json({ products, total, page: parseInt(page), limit: parseInt(limit) });
});

// GET /api/products/categories
router.get('/categories', async (req, res) => {
  const products = await prisma.product.findMany({
    where: { active: true, category: { not: null } },
    select: { category: true },
    distinct: ['category'],
  });
  res.json([...new Set(products.map(p => p.category).filter(Boolean))]);
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
  const product = await prisma.product.findFirst({
    where: { id: parseInt(req.params.id), active: true },
    include: { vendor: { select: { id: true, name: true, logoUrl: true, description: true } } },
  });
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

module.exports = router;
