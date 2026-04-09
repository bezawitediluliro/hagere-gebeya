# 🛍️ Hager Gebeya — Multi-Vendor Telegram Marketplace

A full-stack Telegram Mini App marketplace for local shops with multi-vendor support, discounts, order management, and an admin panel.

---

## Project Structure

```
hager-gebeya/
├── backend/          ← Node.js + Express + Telegraf + Prisma (SQLite)
├── frontend/         ← React + Vite (Telegram Mini App)
└── admin/            ← React + Vite (Admin Panel)
```

---

## Quick Start

### 1. Create your Telegram Bot

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. `/newbot` → give it a name and username
3. Copy the **Bot Token**
4. Enable the Mini App: `/newapp` or use `/mybots` → Bot Settings → Menu Button → set your frontend URL

### 2. Set up the Backend

```bash
cd backend
cp .env.example .env
# Edit .env and fill in:
#   BOT_TOKEN=your_bot_token
#   ADMIN_TELEGRAM_IDS=your_telegram_id (find with @userinfobot)
#   MINI_APP_URL=https://your-frontend.vercel.app

npm install
npm run db:push        # Create the SQLite database
npm run db:seed        # Add sample vendors, products, discount codes
npm run dev            # Start backend on port 3000
```

### 3. Set up the Mini App (Frontend)

```bash
cd frontend
cp .env.example .env
# VITE_API_URL=https://your-backend.railway.app/api  (or leave blank for proxy in dev)

npm install
npm run dev            # Starts on http://localhost:5173
```

### 4. Set up the Admin Panel

```bash
cd admin
npm install
npm run dev            # Starts on http://localhost:5174
```

---

## Features

### 🛒 Customer (Mini App)
- Browse vendors by category / search
- View products per vendor, add to cart
- Multi-vendor cart with per-vendor checkout
- Apply discount codes at checkout
- Cash on Delivery payment (TeleBirr ready)
- Real-time order tracking with status updates
- Telegram notifications for every order update

### 🏪 Vendor
- Apply to become a vendor (via bot or Mini App)
- Manage products (add/edit/deactivate)
- Create discount codes for your shop
- View and update orders (Confirm → Preparing → Ready → Delivered)
- Get notified instantly when a new order arrives

### ⚙️ Admin Panel
- Dashboard with live stats (users, vendors, orders, revenue)
- Approve / reject / deactivate vendors
- View and update all orders across vendors
- Manage all users and roles
- Create global discount codes
- Broadcast messages to all users via Telegram

### 🤖 Bot Commands
| Command | Description |
|---|---|
| `/start` | Welcome screen with Mini App button |
| `/shop` | Open the Mini App |
| `/vendors` | List active vendors |
| `/orders` | View your recent orders |
| `/become_vendor` | Start vendor application |
| `/register_vendor Name \| Description \| Category \| Phone` | Quick vendor registration |
| `/vendor_dashboard` | Vendor management (approved vendors only) |
| `/admin` | Admin dashboard (admins only) |

---

## Environment Variables

### Backend `.env`
```env
DATABASE_URL="file:./dev.db"
BOT_TOKEN="your_bot_token"
ADMIN_TELEGRAM_IDS="123456789"        # Comma-separated Telegram IDs
PORT=3000
JWT_SECRET="change_this_in_production"
MINI_APP_URL="https://your-frontend.vercel.app"

# TeleBirr (fill when ready)
TELEBIRR_APP_ID=""
TELEBIRR_APP_KEY=""
TELEBIRR_SHORT_CODE=""
TELEBIRR_PUBLIC_KEY=""
TELEBIRR_NOTIFY_URL=""
```

### Frontend `.env`
```env
VITE_API_URL=/api       # or https://your-backend.railway.app/api
```

---

## Deployment

### Recommended Stack (Free tiers available)
| Service | Use |
|---|---|
| [Railway](https://railway.app) | Backend (Node.js + SQLite or Postgres) |
| [Vercel](https://vercel.com) | Frontend Mini App |
| [Vercel](https://vercel.com) | Admin Panel |

### Deploy Backend to Railway
1. Push code to GitHub
2. New Railway project → Deploy from GitHub → select `backend/`
3. Set environment variables in Railway dashboard
4. Set `WEBHOOK_URL=https://your-railway-app.up.railway.app`
5. Change `DATABASE_URL` to a Postgres URL for production

### Deploy Frontend to Vercel
1. `cd frontend && npm run build`
2. Deploy `frontend/` folder to Vercel
3. Set `VITE_API_URL=https://your-railway-app.up.railway.app/api`
4. Set the deployed URL as your bot's Mini App URL

### Register Mini App with BotFather
```
/mybots → select your bot → Bot Settings → Menu Button
Set URL: https://your-frontend.vercel.app
```

---

## TeleBirr Integration (Coming Soon)

The TeleBirr payment stub is in `backend/src/api/routes/payment.js`.

When you get your TeleBirr merchant credentials, fill in:
```env
TELEBIRR_APP_ID=your_app_id
TELEBIRR_APP_KEY=your_app_key
TELEBIRR_SHORT_CODE=your_short_code
TELEBIRR_PUBLIC_KEY=your_public_key
TELEBIRR_NOTIFY_URL=https://your-backend.com/api/payment/telebirr/callback
```

Then implement the payment flow in `payment.js`:
1. Build the USSD push payload
2. Encrypt with TeleBirr RSA public key
3. POST to TeleBirr API endpoint
4. Redirect user to returned `toPayUrl`
5. Handle webhook callback to confirm payment

---

## Database

Uses **SQLite** by default (zero setup). Switch to **PostgreSQL** for production:
```env
DATABASE_URL="postgresql://user:pass@host:5432/dbname"
```
Change `provider = "sqlite"` to `provider = "postgresql"` in `prisma/schema.prisma`.

### Sample Data (after seeding)
- 2 approved vendors: *Abebe Fresh Market* (Groceries) and *Tigist Fashion* (Fashion)
- 11 products across both vendors
- Discount codes: `WELCOME10` (10% off), `SAVE50` (50 ETB off orders 300+), `FRESH20` (20% off Abebe's shop)

---

## Architecture

```
Telegram User
     ↓
[Telegram Bot / Mini App]
     ↓ (HTTP)
[Express API]  ←→  [Prisma ORM]  ←→  [SQLite / PostgreSQL]
     ↓
[Bot notifications via Telegraf]
     ↓
Vendor / Customer gets Telegram message
```
