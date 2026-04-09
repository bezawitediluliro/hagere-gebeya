const express = require('express');
const router = express.Router();
const { prisma } = require('../../services/db');
const { generateOrderNumber } = require('../../services/orderNumber');

// GET /api/orders — user's orders
router.get('/', async (req, res) => {
  const { status } = req.query;
  const where = { userId: req.user.id };
  if (status) where.status = status;

  const orders = await prisma.order.findMany({
    where,
    include: {
      vendor: { select: { id: true, name: true, logoUrl: true } },
      items: { include: { product: { select: { id: true, name: true, imageUrl: true } } } },
      payment: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(orders);
});

// GET /api/orders/:id
router.get('/:id', async (req, res) => {
  const order = await prisma.order.findFirst({
    where: { id: parseInt(req.params.id), userId: req.user.id },
    include: {
      vendor: true,
      items: { include: { product: true } },
      payment: true,
    },
  });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

// POST /api/orders — place order from cart
router.post('/', async (req, res) => {
  const { vendorId, discountCode, address, notes, paymentMethod = 'CASH' } = req.body;
  if (!vendorId) return res.status(400).json({ error: 'vendorId required' });

  const cartItems = await prisma.cartItem.findMany({
    where: { userId: req.user.id, product: { vendorId: parseInt(vendorId) } },
    include: { product: true },
  });

  if (!cartItems.length) return res.status(400).json({ error: 'Cart is empty for this vendor' });

  // Validate stock
  for (const item of cartItems) {
    if (item.product.stock < item.quantity) {
      return res.status(400).json({ error: `${item.product.name} is out of stock` });
    }
  }

  const total = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  let discountAmount = 0;
  let discountId = null;

  // Apply discount code
  if (discountCode) {
    const discount = await prisma.discount.findFirst({
      where: {
        code: discountCode.toUpperCase(),
        active: true,
        OR: [{ vendorId: parseInt(vendorId) }, { vendorId: null }],
        AND: [
          { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
          { OR: [{ maxUses: null }, { usedCount: { lt: prisma.discount.fields.maxUses } }] },
        ],
      },
    });

    if (!discount) return res.status(400).json({ error: 'Invalid or expired discount code' });
    if (discount.minOrder && total < discount.minOrder) {
      return res.status(400).json({ error: `Minimum order ${discount.minOrder} ETB required for this discount` });
    }

    discountAmount = discount.type === 'PERCENTAGE'
      ? (total * discount.value) / 100
      : discount.value;
    discountId = discount.id;
  }

  const finalTotal = Math.max(0, total - discountAmount);

  // Create order in transaction
  const order = await prisma.$transaction(async (tx) => {
    const newOrder = await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId: req.user.id,
        vendorId: parseInt(vendorId),
        total,
        discount: discountAmount,
        finalTotal,
        address: address || null,
        notes: notes || null,
        discountId,
        items: {
          create: cartItems.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.product.price,
          })),
        },
        payment: {
          create: {
            method: paymentMethod,
            amount: finalTotal,
            status: paymentMethod === 'CASH' ? 'PENDING' : 'PENDING',
          },
        },
      },
      include: { items: true, payment: true },
    });

    // Update stock
    for (const item of cartItems) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    // Increment discount usage
    if (discountId) {
      await tx.discount.update({ where: { id: discountId }, data: { usedCount: { increment: 1 } } });
    }

    // Clear cart for this vendor
    await tx.cartItem.deleteMany({
      where: { userId: req.user.id, product: { vendorId: parseInt(vendorId) } },
    });

    return newOrder;
  });

  // Notify vendor via bot
  const fullOrder = await prisma.order.findUnique({
    where: { id: order.id },
    include: { vendor: { include: { owner: true } }, user: true, items: { include: { product: true } } },
  });

  const { bot } = require('../../bot');
  let vendorMsg = `🆕 *New Order!* \`${fullOrder.orderNumber}\`\n\n`;
  fullOrder.items.forEach(item => {
    vendorMsg += `• ${item.product.name} x${item.quantity} — ${(item.price * item.quantity).toFixed(2)} ETB\n`;
  });
  vendorMsg += `\n💰 Total: *${finalTotal.toFixed(2)} ETB*`;
  if (discountAmount > 0) vendorMsg += ` (discount: -${discountAmount.toFixed(2)} ETB)`;
  if (address) vendorMsg += `\n📍 ${address}`;
  if (notes) vendorMsg += `\n📝 ${notes}`;

  const { Markup } = require('telegraf');
  bot.telegram.sendMessage(fullOrder.vendor.owner.telegramId, vendorMsg, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('✅ Confirm', `order_status_${order.id}_CONFIRMED`)],
      [Markup.button.callback('❌ Cancel', `order_status_${order.id}_CANCELLED`)],
    ]),
  }).catch(() => {});

  res.status(201).json(order);
});

// GET /api/orders/number/:orderNumber
router.get('/number/:orderNumber', async (req, res) => {
  const order = await prisma.order.findFirst({
    where: { orderNumber: req.params.orderNumber, userId: req.user.id },
    include: { vendor: true, items: { include: { product: true } }, payment: true },
  });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

module.exports = router;
