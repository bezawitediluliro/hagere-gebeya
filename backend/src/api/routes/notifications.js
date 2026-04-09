const express = require('express');
const router = express.Router();
const { prisma } = require('../../services/db');

// GET /api/notifications — user's notifications
router.get('/', async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  const unread = notifications.filter(n => !n.read).length;
  res.json({ notifications, unread });
});

// PATCH /api/notifications/read-all
router.patch('/read-all', async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.user.id, read: false }, data: { read: true } });
  res.json({ ok: true });
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req, res) => {
  await prisma.notification.update({ where: { id: parseInt(req.params.id) }, data: { read: true } });
  res.json({ ok: true });
});

module.exports = router;
