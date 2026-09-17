import { PrismaClient } from '@prisma/client';
import { hash } from 'argon2';

const prisma = new PrismaClient();

const isProduction = process.env.NODE_ENV === 'production';

const MIN_ADMIN_PASSWORD_LENGTH = 16;

async function seedAdminUser(): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;

  // In production the admin account must come from the environment: a
  // credential committed to the repository is public knowledge the moment the
  // code ships, so we refuse to seed one.
  if (isProduction) {
    if (!adminEmail || !adminPassword) {
      throw new Error(
        'Refusing to seed the admin account in production without ADMIN_EMAIL and ADMIN_PASSWORD. ' +
          'Set both environment variables and run the seed again.',
      );
    }
    if (adminPassword.length < MIN_ADMIN_PASSWORD_LENGTH) {
      throw new Error(
        `Refusing to seed the admin account in production: ADMIN_PASSWORD must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters long.`,
      );
    }
  }

  // Outside production a known dev-only account keeps local setup
  // frictionless, but env-provided credentials always take precedence so the
  // same seed can be exercised with production-like configuration.
  const email = adminEmail || 'admin@blessp.com';
  const password = adminPassword || 'Admin123456!';

  const passwordHash = await hash(password, {
    type: 2, // argon2id
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  // Re-running the seed preserves existing credentials. Use the authenticated
  // password-change/reset flow to rotate credentials and revoke sessions.
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      firstName: 'Admin',
      lastName: 'Blessp',
      isAdmin: true,
      emailVerifiedAt: new Date(),
    },
  });

  console.log(`Admin user ensured: ${email}`);
}

async function main(): Promise<void> {
  console.log('Seeding database...');

  await seedAdminUser();

  // The catalog and coupons below are demo fixtures for development and
  // staging. Production data is managed through the admin interface, so the
  // seed stops here to avoid overwriting live products with sample content.
  if (isProduction) {
    console.log('Production environment: skipping catalog and coupon demo data.');
    console.log('Database seeding complete');
    return;
  }

  // Seed products
  const products = [
    {
      name: 'Classic Black Hoodie',
      price: 8999,
      description:
        'Elevate your everyday look with the Classic Black Hoodie. Crafted from premium heavyweight cotton, ' +
        'this piece delivers an effortlessly refined silhouette with a relaxed, oversized fit. ' +
        'The deep black finish resists fading wash after wash.',
      details:
        '100% heavyweight organic cotton, 400 GSM. Ribbed cuffs and hem. Embroidered BLE$$ P logo on chest. ' +
        'Kangaroo pocket with reinforced stitching. Pre-shrunk fabric. Machine wash cold.',
      picture: '/img/black_hoody_1.jpeg',
      images: [
        '/img/black_hoody_1.jpeg',
        '/img/black_hoody_2.jpeg',
        '/img/black_hoody_3.jpeg',
      ],
      category: 'hoodies',
      colors: ['Black'],
      sizes: ['S', 'M', 'L', 'XL'],
      onfrontOrder: 1,
    },
    {
      name: 'Ocean Blue Hoodie',
      price: 8999,
      description:
        'Make a statement with the Ocean Blue Hoodie. The rich, saturated blue tone brings a bold yet ' +
        'sophisticated edge to the classic hoodie silhouette. Built for comfort and durability, ' +
        'this is a wardrobe staple that stands out in any crowd.',
      details:
        '100% heavyweight organic cotton, 400 GSM. Ribbed cuffs and hem. Embroidered BLE$$ P logo on chest. ' +
        'Kangaroo pocket with reinforced stitching. Pre-shrunk fabric. Machine wash cold.',
      picture: '/img/blue_hoody_1.jpeg',
      images: ['/img/blue_hoody_1.jpeg', '/img/blue_hoody_2.jpeg'],
      category: 'hoodies',
      colors: ['Blue'],
      sizes: ['S', 'M', 'L', 'XL'],
      onfrontOrder: 2,
    },
    {
      name: 'Rose Pink Hoodie',
      price: 8999,
      description:
        'Redefine streetwear with the Rose Pink Hoodie. This distinctive colorway combines soft, ' +
        'muted pink tones with the same premium construction you expect from BLE$$ P. ' +
        'Perfect for those who appreciate understated luxury with a modern twist.',
      details:
        '100% heavyweight organic cotton, 400 GSM. Ribbed cuffs and hem. Embroidered BLE$$ P logo on chest. ' +
        'Kangaroo pocket with reinforced stitching. Pre-shrunk fabric. Machine wash cold.',
      picture: '/img/pink_hoody_2.jpeg',
      images: ['/img/pink_hoody_2.jpeg', '/img/pink_hoody_1.png'],
      category: 'hoodies',
      colors: ['Pink'],
      sizes: ['S', 'M', 'L', 'XL'],
      onfrontOrder: 3,
    },
    {
      name: 'Rose Pink Pants',
      price: 6999,
      description:
        'Complete your look with the Rose Pink Pants. Featuring the same premium heavyweight cotton ' +
        'and distinctive rose pink colorway, these jogger pants deliver comfort and style in equal measure. ' +
        'The BLE$$ P shooting star embroidery adds a signature touch.',
      details:
        '100% heavyweight organic cotton, 380 GSM. Elastic waistband with woven drawstring. ' +
        'Side pockets and rear patch pocket. Embroidered BLE$$ P logo on left thigh. ' +
        'Crystal-studded accents. Ribbed ankle cuffs. Machine wash cold.',
      picture: '/img/pink_hoody_1.png',
      images: ['/img/pink_hoody_1.png'],
      category: 'pants',
      colors: ['Pink'],
      sizes: ['S', 'M', 'L', 'XL'],
      onfrontOrder: null,
    },
    {
      name: 'Essential Blue Pants',
      price: 6999,
      description:
        'The Essential Blue Pants bring the same premium craftsmanship to your lower half. ' +
        'Featuring a tapered fit with an elastic waistband and adjustable drawstring, ' +
        'these pants transition seamlessly from street to lounge.',
      details:
        '100% heavyweight organic cotton, 380 GSM. Elastic waistband with woven drawstring. ' +
        'Side pockets and rear patch pocket. Embroidered BLE$$ P logo on left thigh. ' +
        'Ribbed ankle cuffs. Machine wash cold.',
      picture: '/img/blue_pants_1.jpeg',
      images: ['/img/blue_pants_1.jpeg'],
      category: 'pants',
      colors: ['Blue'],
      sizes: ['S', 'M', 'L', 'XL'],
      onfrontOrder: null,
    },
    {
      name: 'Black Hoodie & Pants Set',
      price: 14999,
      description:
        'The ultimate coordinated look. The Black Hoodie & Pants Set pairs our best-selling ' +
        'Classic Black Hoodie with matching jogger pants for a cohesive, head-to-toe silhouette. ' +
        'Save compared to purchasing each piece individually.',
      details:
        'Includes one Classic Black Hoodie and one pair of matching Black Pants. ' +
        '100% heavyweight organic cotton, 400 GSM hoodie and 380 GSM pants. ' +
        'Embroidered BLE$$ P branding on both pieces. Machine wash cold.',
      picture: '/img/black_hoody_n_pants_1.jpeg',
      images: [
        '/img/black_hoody_n_pants_1.jpeg',
        '/img/black_hoody_n_pants_2.jpeg',
      ],
      category: 'sets',
      colors: ['Black'],
      sizes: ['S', 'M', 'L', 'XL'],
      onfrontOrder: 4,
    },
    {
      name: 'Blue Hoodie & Pants Set',
      price: 14999,
      description:
        'Stand out with the Blue Hoodie & Pants Set. This coordinated ensemble delivers ' +
        'the same premium quality in a striking ocean blue colorway. ' +
        'Designed for those who value a polished, put-together aesthetic.',
      details:
        'Includes one Ocean Blue Hoodie and one pair of matching Blue Pants. ' +
        '100% heavyweight organic cotton, 400 GSM hoodie and 380 GSM pants. ' +
        'Embroidered BLE$$ P branding on both pieces. Machine wash cold.',
      picture: '/img/blue_hoody_n_pants_1.jpeg',
      images: ['/img/blue_hoody_n_pants_1.jpeg'],
      category: 'sets',
      colors: ['Blue'],
      sizes: ['S', 'M', 'L', 'XL'],
      onfrontOrder: null,
    },
    {
      name: 'Pink Hoodie & Pants Set',
      price: 14999,
      description:
        'Complete your collection with the Pink Hoodie & Pants Set. ' +
        'The rose pink colorway brings a fresh, contemporary feel to the coordinated set format. ' +
        'Soft to the touch, bold in presence.',
      details:
        'Includes one Rose Pink Hoodie and one pair of matching Pink Pants. ' +
        '100% heavyweight organic cotton, 400 GSM hoodie and 380 GSM pants. ' +
        'Embroidered BLE$$ P branding on both pieces. Machine wash cold.',
      picture: '/img/pink_hoody_n_pants_1.jpeg',
      images: [
        '/img/pink_hoody_n_pants_1.jpeg',
        '/img/pink_hoody_n_pants_2.jpeg',
      ],
      category: 'sets',
      colors: ['Pink'],
      sizes: ['S', 'M', 'L', 'XL'],
      onfrontOrder: null,
    },
  ];

  for (const product of products) {
    // Check if a product with the same name already exists to make the seed idempotent
    const existing = await prisma.product.findFirst({
      where: { name: product.name },
    });

    const seeded = existing
      ? await prisma.product.update({
        where: { id: existing.id },
        data: product,
      })
      : await prisma.product.create({
        data: product,
      });

    // Demo inventory only (production exits above). Preserve stock on reruns:
    // seeding must never replenish units already sold or manually adjusted.
    for (const size of product.sizes.length ? product.sizes : ['']) {
      for (const color of product.colors.length ? product.colors : ['']) {
        await prisma.productVariant.upsert({
          where: { productId_size_color: { productId: seeded.id, size, color } },
          update: {},
          create: { productId: seeded.id, size, color, stock: 20 },
        });
      }
    }
  }

  console.log(`${products.length} products seeded`);

  // Seed coupons
  const coupons = [
    {
      code: 'WELCOME10',
      discountType: 'percentage',
      discountValue: 10,
      minOrderCents: null,
      maxUses: null,
      isActive: true,
      expiresAt: null,
    },
    {
      code: 'BLESSP20',
      discountType: 'percentage',
      discountValue: 20,
      minOrderCents: 10000,
      maxUses: 50,
      isActive: true,
      expiresAt: null,
    },
    {
      code: 'FREESHIP',
      discountType: 'fixed',
      discountValue: 995,
      minOrderCents: null,
      maxUses: null,
      isActive: true,
      expiresAt: null,
    },
  ];

  for (const coupon of coupons) {
    await prisma.coupon.upsert({
      where: { code: coupon.code },
      update: {},
      create: coupon,
    });
  }

  console.log(`${coupons.length} coupons seeded`);
  console.log('Database seeding complete');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
