import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, Package, Pause, Play, Ruler, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import type { Product } from '@/lib/types';
import { RecentlyViewed } from '@/components/common/RecentlyViewed';
import { ProductCard } from '@/components/common/ProductCard';
import { SizeGuide } from '@/components/common/SizeGuide';

const collections = [
  { category: 'Hoodies', image: '/img/black_hoody_1.jpeg', key: 'hoodies', number: '01' },
  { category: 'Pants', image: '/img/blue_pants_1.jpeg', key: 'pants', number: '02' },
  { category: 'Sets', image: '/img/pink_hoody_n_pants_1.jpeg', key: 'sets', number: '03' },
];

export default function HomePage() {
  const { t } = useTranslation();
  const [featured, setFeatured] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  const [playHero, setPlayHero] = useState(false);
  const [heroPlaying, setHeroPlaying] = useState(false);
  const [heroUnavailable, setHeroUnavailable] = useState(false);
  const [heroReady, setHeroReady] = useState(false);
  const [useOriginalCover, setUseOriginalCover] = useState(false);
  const heroVideo = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 768px)');
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      clearTimeout(timer);
      setPlayHero(false);
      heroVideo.current?.pause();
      if (!desktop.matches || reducedMotion || (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return;
      timer = setTimeout(() => setPlayHero(true), 1500);
    };
    update(); desktop.addEventListener('change', update);
    return () => { clearTimeout(timer); desktop.removeEventListener('change', update); };
  }, [reducedMotion]);

  useEffect(() => {
    const video = heroVideo.current;
    if (!video) return;
    let active = true;
    setHeroUnavailable(false);
    setHeroReady(false);
    // A dynamically inserted <source> is not reliably reselected by browsers.
    // Loading explicitly also releases the old media when mobile mode removes it.
    video.load();
    if (playHero) void video.play().catch(() => { if (active) setHeroPlaying(false); });
    else video.pause();
    return () => { active = false; };
  }, [playHero]);

  useDocumentMeta({ description: t('home.editorial.description') });
  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true); setFailed(false);
    api.get<Product[]>('/products/featured', { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setFeatured(data.slice(0, 4)); })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); })
      .finally(() => { if (!controller.signal.aborted) setIsLoading(false); });
    return () => controller.abort();
  }, [attempt]);

  return (
    <div className="min-h-screen bg-[#fcfbf8]">
      <section className="campaign-hero">
        <img src={useOriginalCover ? '/img/blessp_story.jpeg' : '/img/blessp_story-cover.webp'} alt="" aria-hidden="true" width={2048} height={1574} fetchPriority="high" decoding="async" onError={() => setUseOriginalCover(true)} className="absolute inset-0 h-full w-full object-cover" />
        <video ref={heroVideo} autoPlay={playHero} onPlay={() => setHeroPlaying(true)} onPlaying={() => setHeroReady(true)} onPause={() => setHeroPlaying(false)} preload="none" aria-hidden="true" muted loop playsInline style={{ opacity: heroReady ? 1 : 0 }} className="absolute inset-0 h-full w-full object-cover">
          {playHero && <>
            <source src="/video/blessp_video.webm" type="video/webm" />
            <source src="/video/blessp_video.mp4" type="video/mp4" onError={() => {
              heroVideo.current?.pause();
              setHeroPlaying(false);
              setHeroReady(false);
              setHeroUnavailable(true);
            }} />
          </>}
        </video>
        <div className="campaign-shade absolute inset-0" />
        <div className="relative z-10 mx-auto flex w-full max-w-[1440px] flex-1 flex-col justify-between px-6 py-10 sm:px-10 md:py-14 lg:px-16">
          <div className="flex items-center justify-between gap-5 border-b border-white/30 pb-5 text-[10px] font-medium uppercase tracking-[0.22em] text-white">
            <p>{t('home.editorial.eyebrow')}</p><span className="hidden sm:block">{t('home.editorial.signature')}</span>
          </div>
          <div className="py-14 md:py-16">
            <h1 className="font-display text-[clamp(4rem,12vw,10.5rem)] font-medium leading-none tracking-[-0.06em] text-white">BLE$$ P</h1>
            <p className="mt-6 max-w-xl font-display text-3xl italic leading-snug text-[#eee4d4] sm:text-4xl md:text-5xl">{t('home.editorial.headline')}</p>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-white">{t('home.editorial.description')}</p>
            <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-5">
              <Link to="/shop" className="inline-flex min-h-12 items-center gap-8 bg-[#f2e8d7] px-6 py-4 text-xs font-semibold uppercase tracking-widest text-neutral-950 transition-colors hover:bg-white">{t('home.shopCollection')}<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link>
              <Link to="/shop?category=Sets" className="inline-flex min-h-11 items-center gap-3 border-b border-white/70 py-2 text-xs font-medium uppercase tracking-widest text-white">{t('home.editorial.shopSets')}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
            </div>
          </div>
          <div className="flex items-end justify-between gap-4 border-t border-white/30 pt-5">
            <p className="max-w-[70%] text-[10px] uppercase leading-relaxed tracking-[0.2em] text-white">{t('home.editorial.footer')}</p>
            {playHero && !heroUnavailable && <button type="button" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/70 bg-black/40 text-white hover:bg-black/70" aria-label={heroPlaying ? t('home.pauseVideo') : t('home.playVideo')} onClick={() => {
              const video = heroVideo.current; if (!video) return;
              if (video.paused) void video.play().catch(() => setHeroPlaying(false)); else video.pause();
            }}>{heroPlaying ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}</button>}
          </div>
        </div>
      </section>

      <nav aria-label={t('home.editorial.services')} className="border-b border-neutral-200 bg-[#f3f1eb]">
        <div className="mx-auto grid max-w-7xl divide-y divide-neutral-200 px-6 md:grid-cols-3 md:divide-x md:divide-y-0">
          <button onClick={() => setSizeGuideOpen(true)} className="service-link"><Ruler className="h-4 w-4" aria-hidden="true" />{t('product.sizeGuide')}<ArrowUpRight className="ml-auto h-4 w-4" aria-hidden="true" /></button>
          <Link to="/order-status" className="service-link"><Package className="h-4 w-4" aria-hidden="true" />{t('footer.trackOrder')}<ArrowUpRight className="ml-auto h-4 w-4" aria-hidden="true" /></Link>
          <Link to="/contact#faq" className="service-link"><MessageCircle className="h-4 w-4" aria-hidden="true" />{t('home.editorial.help')}<ArrowUpRight className="ml-auto h-4 w-4" aria-hidden="true" /></Link>
        </div>
      </nav>

      <section className="mx-auto max-w-7xl px-6 py-16 md:px-10 md:py-24">
        <div className="mb-9 flex flex-wrap items-end justify-between gap-5">
          <div><p className="editorial-eyebrow">01 / {t('home.editorial.explore')}</p><h2 className="editorial-title mt-4">{t('home.editorial.collections')}</h2></div>
          <p className="max-w-xs text-sm leading-relaxed text-neutral-600">{t('home.editorial.collectionDescription')}</p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {collections.map(({ category, image, key, number }) => <Link key={key} to={`/shop?category=${category}`} aria-label={t(`shop.categories.${key}`)} className="group relative block overflow-hidden bg-[#e9e7e1]">
            <div className="aspect-[4/3] overflow-hidden md:aspect-[3/4]"><img src={image} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04] motion-reduce:transform-none" /></div>
            <div className="flex items-center gap-4 border-t border-neutral-200 bg-[#f3f1eb] px-5 py-5"><span className="text-[10px] text-neutral-600">{number}</span><h3 className="font-display text-2xl text-neutral-950">{t(`shop.categories.${key}`)}</h3><ArrowUpRight className="ml-auto h-5 w-5 text-neutral-700" aria-hidden="true" /></div>
          </Link>)}
        </div>
      </section>

      <section className="border-y border-neutral-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-16 md:px-10 md:py-24">
          <div className="mb-9 flex flex-wrap items-end justify-between gap-5"><div><p className="editorial-eyebrow">02 / {t('home.editorial.selected')}</p><h2 className="editorial-title mt-4">{t('home.newArrivals')}</h2></div><Link to="/shop" className="editorial-link">{t('home.exploreCollection')}<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link></div>
          {isLoading ? <div aria-label={t('common.loading')} className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <div key={i} className="aspect-[3/4] animate-pulse bg-neutral-100" />)}</div>
            : failed ? <div role="alert" className="border border-neutral-200 p-8 text-center"><p>{t('common.loadError')}</p><button className="mt-4 min-h-11 underline underline-offset-4" onClick={() => setAttempt(value => value + 1)}>{t('common.retry')}</button></div>
            : featured.length === 0 ? <p className="py-8 text-neutral-600">{t('home.editorial.noFeatured')}</p>
            : <div className="grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-4">{featured.map(product => <ProductCard key={product.id} product={product} />)}</div>}
        </div>
      </section>

      <section className="bg-[#eae5db]">
        <div className="mx-auto grid max-w-[1440px] lg:grid-cols-2">
          {/* The hero already loads this photo. Lazy loading it again makes WebKit request it twice. */}
          <div className="relative min-h-80 overflow-hidden lg:min-h-[600px]"><img src={useOriginalCover ? '/img/blessp_story.jpeg' : '/img/blessp_story-cover.webp'} alt={t('home.brandStoryImageAlt')} decoding="async" onError={() => setUseOriginalCover(true)} width={2048} height={1574} className="h-full min-h-80 w-full object-cover" /><span aria-hidden="true" className="absolute bottom-7 left-7 font-display text-5xl italic text-white [text-shadow:0_2px_12px_rgba(0,0,0,.8)]">BLE$$ P</span></div>
          <div className="flex flex-col justify-center px-6 py-16 sm:px-10 lg:px-16"><p className="editorial-eyebrow">03 / {t('home.editorial.identity')}</p><h2 className="editorial-title mt-5">{t('home.editorial.storyTitle')}</h2><p className="mt-7 max-w-lg text-base leading-relaxed text-neutral-700">{t('home.editorial.storyBody')}</p><Link to="/shop" className="editorial-link mt-9 self-start">{t('home.exploreCollection')}<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link></div>
        </div>
      </section>
      <RecentlyViewed />
      <SizeGuide isOpen={sizeGuideOpen} onClose={() => setSizeGuideOpen(false)} />
    </div>
  );
}
