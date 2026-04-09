const express = require('express');
const router = express.Router();
const { prisma } = require('../../services/db');
const { telegramAuth } = require('../middleware/auth');

// GET /api/reviews/vendor/:vendorId
router.get('/vendor/:vendorId', async (req, res) => {
  const reviews = await prisma.review.findMany({
    where: { vendorId: parseInt(req.params.vendorId) },
    include: { user: { select: { firstName: true, username: true } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  res.json(reviews);
});

// POST /api/reviews — submit review
router.post('/', telegramAuth, async (req, res) => {
  const { orderId, rating, comment } = req.body;
  if (!orderId || !rating) return res.status(400).json({ error: 'orderId and rating required' });
  if (rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be 1-5' });

  const order = await prisma.order.findFirst({
    where: { id: parseInt(orderId), userId: req.user.id, status: 'DELIVERED' },
  });
  if (!order) return res.status(404).json({ error: 'Order not found or not delivered' });

  const existing = await prisma.review.findUnique({ where: { orderId: parseInt(orderId) } });
  if (existing) return res.status(400).json({ error: 'Already reviewed' });

  const review = await prisma.review.create({
    data: { rating: parseInt(rating), comment, orderId: parseInt(orderId), userId: req.user.id, vendorId: order.vendorId },
  });

  // Update vendor rating
  const stats = await prisma.review.aggregate({ _avg: { rating: true }, _count: true, where: { vendorId: order.vendorId } });
  await prisma.vendor.update({ where: { id: order.vendorId }, data: { rating: stats._avg.rating || 0, reviewCount: stats._count } });

  // Award 10 points for reviewing
  await prisma.user.update({ where: { id: req.user.id }, data: { points: { increment: 10 } } });

  res.status(201).json(review);
});

module.exports = router;
