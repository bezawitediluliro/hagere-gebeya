require('dotenv').config();
require('express-async-errors');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const { bot, setupBotWebhook } = require('./bot');
const apiRoutes = require('./api/routes');
const { errorHandler } = require('./api/middleware/errorHandler');
const { prisma } = require('./services/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API routes
app.use('/api', apiRoutes);

// Telegram webhook
if (process.env.NODE_ENV === 'production' && process.env.WEBHOOK_URL) {
  app.use(bot.webhookCallback('/webhook'));
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'hager-gebeya' });
});

// Error handler (must be last)
app.use(errorHandler);

async function start() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected');

    if (process.env.NODE_ENV === 'production' && process.env.WEBHOOK_URL) {
      await setupBotWebhook();
      console.log('✅ Bot webhook set');
    } else {
      bot.launch();
      console.log('✅ Bot polling started');
    }

    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`📱 Mini App URL: ${process.env.MINI_APP_URL || 'not set'}`);
    });
  } catch (err) {
    console.error('❌ Startup error:', err);
    process.exit(1);
  }
}

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

start();
