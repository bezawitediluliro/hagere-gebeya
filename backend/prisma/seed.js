const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { telegramId: 'dev_user' },
    update: {},
    create: {
      telegramId: 'dev_user',
      firstName: 'Admin',
      username: 'admin',
      role: 'ADMIN',
    },
  });

  // Create vendor users
  const vendor1User = await prisma.user.upsert({
    where: { telegramId: 'vendor1' },
    update: {},
    create: {
      telegramId: 'vendor1',
      firstName: 'Abebe',
      username: 'abebe_store',
      role: 'VENDOR',
    },
  });

  const vendor2User = await prisma.user.upsert({
    where: { telegramId: 'vendor2' },
    update: {},
    create: {
      telegramId: 'vendor2',
      firstName: 'Tigist',
      username: 'tigist_fashion',
      role: 'VENDOR',
    },
  });

  // Create vendors
  const vendor1 = await prisma.vendor.upsert({
    where: { ownerId: vendor1User.id },
    update: {},
    create: {
      name: 'Abebe Fresh Market',
      description: 'Fresh fruits, vegetables, and dairy products from local farms',
      category: 'Groceries',
      phone: '0911234567',
      address: 'Bole, Addis Ababa',
      approved: true,
      ownerId: vendor1User.id,
    },
  });

  const vendor2 = await prisma.vendor.upsert({
    where: { ownerId: vendor2User.id },
    update: {},
    create: {
      name: 'Tigist Fashion',
      description: 'Traditional and modern Ethiopian clothing and accessories',
      category: 'Fashion',
      phone: '0922345678',
      address: 'Piazza, Addis Ababa',
      approved: true,
      ownerId: vendor2User.id,
    },
  });

  // Create products for vendor 1
  const products1 = [
    { name: 'Bananas (1kg)', price: 35, category: 'Fruits', stock: 100 },
    { name: 'Tomatoes (1kg)', price: 45, category: 'Vegetables', stock: 80 },
    { name: 'Avocado (3 pcs)', price: 60, category: 'Fruits', stock: 50 },
    { name: 'Fresh Milk (1L)', price: 55, category: 'Dairy', stock: 30 },
    { name: 'Eggs (12 pcs)', price: 85, category: 'Dairy', stock: 40 },
    { name: 'Onions (1kg)', price: 30, category: 'Vegetables', stock: 90 },
  ];

  for (const p of products1) {
    const exists = await prisma.product.findFirst({ where: { name: p.name, vendorId: vendor1.id } });
    if (!exists) {
      await prisma.product.create({ data: { ...p, vendorId: vendor1.id } });
    }
  }

  // Create products for vendor 2
  const products2 = [
    { name: 'Habesha Kemis (White)', price: 850, category: 'Traditional', stock: 20 },
    { name: 'Gabi (Large)', price: 350, category: 'Traditional', stock: 15 },
    { name: 'Modern Dress', price: 650, category: 'Modern', stock: 25 },
    { name: 'Leather Belt', price: 120, category: 'Accessories', stock: 40 },
    { name: 'Traditional Scarf', price: 180, category: 'Traditional', stock: 35 },
  ];

  for (const p of products2) {
    const exists = await prisma.product.findFirst({ where: { name: p.name, vendorId: vendor2.id } });
    if (!exists) {
      await prisma.product.create({ data: { ...p, vendorId: vendor2.id } });
    }
  }

  // Create discount codes
  const discounts = [
    { code: 'WELCOME10', type: 'PERCENTAGE', value: 10, maxUses: 100 },
    { code: 'SAVE50', type: 'FIXED', value: 50, minOrder: 300 },
    { code: 'FRESH20', type: 'PERCENTAGE', value: 20, vendorId: vendor1.id, maxUses: 50 },
  ];

  for (const d of discounts) {
    const exists = await prisma.discount.findUnique({ where: { code: d.code } });
    if (!exists) {
      await prisma.discount.create({ data: d });
    }
  }

  console.log('✅ Seed complete!');
  console.log(`Admin: dev_user`);
  console.log(`Vendors: ${vendor1.name}, ${vendor2.name}`);
  console.log(`Discount codes: WELCOME10, SAVE50, FRESH20`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
