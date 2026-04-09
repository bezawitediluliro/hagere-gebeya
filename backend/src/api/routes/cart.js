const express = require('express');
const router = express.Router();
const { prisma } = require('../../services/db');

// GET /api/cart
router.get('/', async (req, res) => {
  const items = await prisma.cartItem.findMany({
    where: { userId: req.user.id },
    include: {
      product: {
        include: { vendor: { select: { id: true, name: true } } },
      },
    },
  });
  res.json(items);
});

// POST /api/cart — add or update item
router.post('/', async (req, res) => {
  const { productId, quantity = 1 } = req.body;
  if (!productId) return res.status(400).json({ error: 'productId required' });

  const product = await prisma.product.findFirst({
    where: { id: parseInt(productId), active: true },
  });
  if (!product) return res.status(404).json({ error: 'Product not found' });
  if (product.stock < quantity) return res.status(400).json({ error: 'Not enough stock' });

  const existing = await prisma.cartItem.findUnique({
    where: { userId_productId: { userId: req.user.id, productId: parseInt(productId) } },
  });

  const item = existing
    ? await prisma.cartItem.update({
        where: { userId_productId: { userId: req.user.id, productId: parseInt(productId) } },
        data: { quantity: parseInt(quantity) },
        include: { product: true },
      })
    : await prisma.cartItem.create({
        data: { userId: req.user.id, productId: parseInt(productId), quantity: parseInt(quantity) },
        include: { product: true },
      });

  res.json(item);
});

// DELETE /api/cart/:productId
router.delete('/:productId', async (req, res) => {
  await prisma.cartItem.deleteMany({
    where: { userId: req.user.id, productId: parseInt(req.params.productId) },
  });
  res.json({ success: true });
});

// DELETE /api/cart — clear all
router.delete('/', async (req, res) => {
  await prisma.cartItem.deleteMany({ where: { userId: req.user.id } });
  res.json({ success: true });
});

module.exports = router;
