const express = require('express');
const router = express.Router();
const { prisma } = require('../../services/db');

// POST /api/payment/telebirr/initiate
// TeleBirr integration stub — ready for when you get TeleBirr merchant credentials
router.post('/telebirr/initiate', async (req, res) => {
  const { orderId } = req.body;
  if (!orderId) return res.status(400).json({ error: 'orderId required' });

  const order = await prisma.order.findFirst({
    where: { id: parseInt(orderId), userId: req.user.id },
    include: { payment: true },
  });
  if (!order) return res.status(404).json({ error: 'Order not found' });

  // TODO: Integrate TeleBirr API
  // const TELEBIRR_APP_ID = process.env.TELEBIRR_APP_ID;
  // const TELEBIRR_APP_KEY = process.env.TELEBIRR_APP_KEY;
  // const TELEBIRR_SHORT_CODE = process.env.TELEBIRR_SHORT_CODE;
  // const TELEBIRR_PUBLIC_KEY = process.env.TELEBIRR_PUBLIC_KEY;
  //
  // Steps:
  // 1. Build the ussd push payload
  // 2. Encrypt with TeleBirr public key
  // 3. POST to https://196.188.120.3:38443/payment/v1/toPay
  // 4. Redirect user to the returned toPayUrl

  res.status(503).json({
    error: 'TeleBirr payment coming soon',
    message: 'TeleBirr integration is ready to be connected. Please use Cash on Delivery for now.',
  });
});

// POST /api/payment/telebirr/callback — TeleBirr webhook
router.post('/telebirr/callback', async (req, res) => {
  // TODO: verify signature, update order payment status
  const { outTradeNo, tradeNo, transactionAmount } = req.body;
  console.log('TeleBirr callback:', req.body);
  res.json({ code: '200', message: 'success' });
});

// POST /api/payment/cash/confirm — admin/vendor confirms cash payment
router.post('/cash/confirm', async (req, res) => {
  const { orderId } = req.body;
  const order = await prisma.order.findFirst({
    where: { id: parseInt(orderId) },
    include: { vendor: true, user: true, payment: true },
  });
  if (!order) return res.status(404).json({ error: 'Order not found' });

  // Only vendor owner or admin can confirm
  const isVendorOwner = order.vendor.ownerId === req.user.id;
  const isAdmin = req.user.role === 'ADMIN';
  if (!isVendorOwner && !isAdmin) return res.status(403).json({ error: 'Not authorized' });

  await prisma.payment.update({
    where: { orderId: order.id },
    data: { status: 'PAID' },
  });

  const { bot } = require('../../bot');
  bot.telegram.sendMessage(
    order.user.telegramId,
    `💵 Cash payment confirmed for order \`${order.orderNumber}\`!`,
    { parse_mode: 'Markdown' }
  ).catch(() => {});

  res.json({ success: true });
});

module.exports = router;
