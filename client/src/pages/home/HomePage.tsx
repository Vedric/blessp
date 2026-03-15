import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Gem, Truck, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { useCurrency } from '@/context/CurrencyContext';
import type { Product } from '@/lib/types';
import { RecentlyViewed } from '@/components/common/RecentlyViewed';
import { CompareButton } from '@/components/common/CompareButton';

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.8, ease: 'easeOut' as const } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' as const } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.12 } },
};

const socialImages = [
  '/img/black_hoody_1.jpeg',
  '/img/blue_hoody_1.jpeg',
  '/img/pink_hoody_1.jpeg',
  '/img/black_hoody_n_pants_1.jpeg',
  '/img/blue_hoody_n_pants_1.jpeg',
  '/img/pink_hoody_n_pants_1.jpeg',
];

export default function HomePage() {
  const { t } = useTranslation();
  const { formatPrice } = useCurrency();
  const [featured, setFeatured] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const data = await api.get<Product[]>('/products/featured');
        setFeatured(data);
      } catch {
        // Graceful fallback: show nothing
      } finally {
        setIsLoading(false);
      }
    };
    fetchFeatured();
  }, []);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative h-screen w-full overflow-hidden">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        >
          <source src="/video/blessp_video.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-black/50" />

        <motion.div
          className="relative z-10 flex h-full flex-col items-center justify-center px-4 text-center"
          initial="hidden"
          animate="visible"
          variants={stagger}
        >
          <motion.h1
            className="font-display text-hero font-bold tracking-tight text-white"
            variants={fadeIn}
          >
            BLE$$ P
          </motion.h1>
          <motion.p
            className="mt-4 text-lg tracking-[0.25em] text-white/80 uppercase md:text-xl"
            variants={fadeIn}
          >
            {t('home.heroSubtitle')}
          </motion.p>
          <motion.div variants={fadeUp}>
            <Link
              to="/shop"
              className="mt-10 inline-flex items-center gap-2 border border-white px-10 py-4 text-sm font-medium tracking-widest text-white uppercase transition-all duration-300 hover:bg-white hover:text-black"
            >
              {t('home.shopCollection')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-10 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
        >
          <div className="h-10 w-[1px] bg-white/40" />
        </motion.div>
      </section>

      {/* Featured Products */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={stagger}
        >
          <motion.h2
            className="font-display text-3xl font-light tracking-tight text-neutral-900 md:text-4xl"
            variants={fadeUp}
          >
            {t('home.newArrivals')}
          </motion.h2>
          <motion.div className="mt-2 h-px w-12 bg-brand-500" variants={fadeUp} />

          {isLoading ? (
            <div className="mt-12 grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-[3/4] bg-neutral-100" />
                  <div className="mt-3 h-4 w-3/4 bg-neutral-100" />
                  <div className="mt-2 h-4 w-1/4 bg-neutral-100" />
                </div>
              ))}
            </div>
          ) : (
            <motion.div
              className="mt-12 grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-4"
              variants={stagger}
            >
              {featured.map((product) => (
                <motion.div key={product.id} variants={fadeUp} className="relative">
                  <CompareButton productId={product.id} />
                  <Link to={`/products/${product.id}`} className="group block">
                    <div className="aspect-[3/4] overflow-hidden bg-neutral-100">
                      <img
                        src={product.picture || product.images?.[0]}
                        alt={product.name}
                        className="h-full w-full bg-neutral-100 scale-[1.02] object-cover transition-transform duration-700 ease-out-expo group-hover:scale-[1.07]"
                      />
                    </div>
                    <div className="mt-4">
                      <h3 className="text-sm font-medium text-neutral-900">
                        {product.name}
                      </h3>
                      <p className="mt-1 text-sm text-neutral-500">
                        {formatPrice(product.price)}
                      </p>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          )}
        </motion.div>
      </section>

      {/* Brand Story */}
      <section className="bg-neutral-50">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <motion.div
            className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={stagger}
          >
            <motion.div className="aspect-[4/5] overflow-hidden" variants={fadeUp}>
              <img
                src="/img/black_hoody_n_pants_1.jpeg"
                alt="BLE$$ P lifestyle"
                className="h-full w-full object-cover"
              />
            </motion.div>
            <motion.div className="max-w-lg" variants={fadeUp}>
              <h2 className="font-display text-3xl font-light tracking-tight text-neutral-900 md:text-4xl">
                {t('home.brandStoryTitle')}
              </h2>
              <div className="mt-2 h-px w-12 bg-brand-500" />
              <p className="mt-8 text-base leading-relaxed text-neutral-600">
                {t('home.brandStoryP1')}
              </p>
              <p className="mt-4 text-base leading-relaxed text-neutral-600">
                {t('home.brandStoryP2')}
              </p>
              <Link
                to="/shop"
                className="mt-10 inline-flex items-center gap-2 text-sm font-medium tracking-widest text-neutral-900 uppercase transition-colors hover:text-brand-600"
              >
                {t('home.exploreCollection')}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Why BLE$$ P */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <motion.div
          className="grid gap-6 md:grid-cols-3"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={stagger}
        >
          {[
            {
              icon: Gem,
              title: t('home.premiumMaterials'),
              description: t('home.premiumMaterialsDesc'),
            },
            {
              icon: Truck,
              title: t('home.freeShipping'),
              description: t('home.freeShippingDesc'),
            },
            {
              icon: RotateCcw,
              title: t('home.easyReturns'),
              description: t('home.easyReturnsDesc'),
            },
          ].map((feature) => (
            <motion.div
              key={feature.title}
              variants={fadeUp}
              className="group flex flex-col items-center border border-neutral-100 px-8 py-12 text-center transition-colors hover:border-neutral-200"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-neutral-200 text-[#c8a97e] transition-colors group-hover:border-[#c8a97e]/40">
                <feature.icon className="h-6 w-6" strokeWidth={1.5} />
              </div>
              <h3 className="mt-6 text-sm font-medium tracking-widest text-neutral-900 uppercase">
                {feature.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-neutral-500">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Social / Instagram Grid */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={stagger}
        >
          <motion.div className="text-center" variants={fadeUp}>
            <h2 className="font-display text-3xl font-light tracking-tight text-neutral-900 md:text-4xl">
              {t('home.followUs')}
            </h2>
            <p className="mt-2 text-sm tracking-widest text-neutral-500 uppercase">
              @blessp
            </p>
          </motion.div>

          <motion.div
            className="mt-12 grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3"
            variants={stagger}
          >
            {socialImages.map((src, i) => (
              <motion.div
                key={i}
                className="group aspect-square overflow-hidden"
                variants={fadeUp}
              >
                <img
                  src={src}
                  alt={`BLE$$ P lookbook ${i + 1}`}
                  className="h-full w-full scale-[1.02] object-cover transition-transform duration-700 ease-out-expo group-hover:scale-[1.07]"
                />
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* Recently Viewed */}
      <RecentlyViewed />
    </div>
  );
}
