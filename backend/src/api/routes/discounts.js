const express = require('express');
const router = express.Router();
const { prisma } = require('../../services/db');
const { telegramAuth } = require('../middleware/auth');

// POST /api/discounts/validate — validate a code before checkout
router.post('/validate', telegramAuth, async (req, res) => {
  const { code, vendorId, orderTotal } = req.body;
  if (!code) return res.status(400).json({ error: 'code required' });

  const discount = await prisma.discount.findFirst({
    where: {
      code: code.toUpperCase(),
      active: true,
      OR: [
        { vendorId: vendorId ? parseInt(vendorId) : undefined },
        { vendorId: null },
      ],
      AND: [
        { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      ],
    },
  });

  if (!discount) return res.status(404).json({ error: 'Invalid or expired discount code' });

  if (discount.maxUses && discount.usedCount >= discount.maxUses) {
    return res.status(400).json({ error: 'Discount code has reached its limit' });
  }

  if (discount.minOrder && orderTotal && orderTotal < discount.minOrder) {
    return res.status(400).json({
      error: `Minimum order amount of ${discount.minOrder} ETB required`,
      minOrder: discount.minOrder,
    });
  }

  const discountAmount = discount.type === 'PERCENTAGE'
    ? (orderTotal * discount.value) / 100
    : discount.value;

  res.json({
    valid: true,
    discount: {
      code: discount.code,
      type: discount.type,
      value: discount.value,
      discountAmount: orderTotal ? discountAmount : null,
    },
  });
});

module.exports = router;
