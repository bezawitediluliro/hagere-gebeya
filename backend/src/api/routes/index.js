const express = require('express');
const router = express.Router();

const { telegramAuth } = require('../middleware/auth');

router.use('/vendors', require('./vendors'));
router.use('/products', require('./products'));
router.use('/cart', telegramAuth, require('./cart'));
router.use('/orders', telegramAuth, require('./orders'));
router.use('/discounts', require('./discounts'));
router.use('/admin', telegramAuth, require('./admin'));
router.use('/user', telegramAuth, require('./user'));
router.use('/payment', telegramAuth, require('./payment'));

module.exports = router;
