import { PrismaClient } from '@prisma/client';
import { hash } from 'argon2';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('Seeding database...');

  // Seed admin user
  const passwordHash = await hash('Admin123456!', {
    type: 2, // argon2id
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  await prisma.user.upsert({
    where: { email: 'admin@blessp.com' },
    update: {},
    create: {
      email: 'admin@blessp.com',
      passwordHash,
      firstName: 'Admin',
      lastName: 'Blessp',
      isAdmin: true,
    },
  });

  console.log('Admin user created: admin@blessp.com');

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
      images: ['/img/pink_hoody_2.jpeg', '/img/pink_hoody_1.jpeg'],
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
      picture: '/img/pink_hoody_1.jpeg',
      images: ['/img/pink_hoody_1.jpeg'],
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

    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: product,
      });
    } else {
      await prisma.product.create({
        data: product,
      });
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
