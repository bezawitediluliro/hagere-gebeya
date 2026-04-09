const { prisma } = require('../../services/db');
const crypto = require('crypto');

// Validate Telegram Mini App initData
function validateTelegramData(initData, botToken) {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  params.delete('hash');

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  return computedHash === hash;
}

// Middleware: authenticate Telegram Mini App user
async function telegramAuth(req, res, next) {
  const initData = req.headers['x-telegram-init-data'];

  if (!initData) {
    return res.status(401).json({ error: 'No authentication data' });
  }

  // In dev mode, allow a mock user
  if (process.env.NODE_ENV === 'development' && initData === 'dev') {
    const devUser = await prisma.user.findFirst({ where: { telegramId: 'dev_user' } }) ||
      await prisma.user.create({
        data: {
          telegramId: 'dev_user',
          firstName: 'Dev',
          username: 'devuser',
          role: 'ADMIN',
        },
      });
    req.user = devUser;
    return next();
  }

  try {
    const isValid = validateTelegramData(initData, process.env.BOT_TOKEN);
    if (!isValid) return res.status(401).json({ error: 'Invalid authentication' });

    const params = new URLSearchParams(initData);
    const userData = JSON.parse(params.get('user') || '{}');
    const telegramId = String(userData.id);

    let user = await prisma.user.findUnique({ where: { telegramId } });
    if (!user) {
      const adminIds = (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(s => s.trim());
      user = await prisma.user.create({
        data: {
          telegramId,
          username: userData.username,
          firstName: userData.first_name,
          lastName: userData.last_name,
          role: adminIds.includes(telegramId) ? 'ADMIN' : 'CUSTOMER',
        },
      });
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Authentication failed' });
  }
}

// Middleware: require admin role
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Admin access required' });
  next();
}

// Middleware: require vendor role or admin
async function requireVendor(req, res, next) {
  if (req.user?.role === 'ADMIN') return next();
  const vendor = await prisma.vendor.findUnique({ where: { ownerId: req.user.id } });
  if (!vendor || !vendor.approved) return res.status(403).json({ error: 'Vendor access required' });
  req.vendor = vendor;
  next();
}

module.exports = { telegramAuth, requireAdmin, requireVendor };
