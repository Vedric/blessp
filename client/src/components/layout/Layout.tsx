import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { CartDrawer } from './CartDrawer';
import { BackToTop } from '@/components/common/BackToTop';
import { CompareDrawer } from '@/components/common/CompareDrawer';
import { NavigationProgress } from '@/components/common/NavigationProgress';

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main-content" className="sr-only fixed left-4 top-4 z-[100] bg-white p-3 text-neutral-900 focus:not-sr-only">Skip to content / Aller au contenu</a>
      <NavigationProgress />
      <Header />
      <main id="main-content" tabIndex={-1} className="flex-1 pt-16 md:pt-18">
        {/* Keep the active route mounted once: an exiting Outlet reads the new
            router context and can mount then discard a user's next form. */}
        <Outlet />
      </main>
      <Footer />
      <CartDrawer />
      <CompareDrawer />
      <BackToTop />
    </div>
  );
}
