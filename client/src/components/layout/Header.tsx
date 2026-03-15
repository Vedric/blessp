import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu,
  X,
  Search,
  User,
  ShoppingBag,
  LogOut,
  Package,
  UserCircle,
  Shield,
  Heart,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { SearchOverlay } from '@/components/common/SearchOverlay';
import { cn } from '@/lib/utils';

export function Header() {
  const { t } = useTranslation();
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const { itemCount, openCart } = useCart();
  const { wishlistCount } = useWishlist();
  const navigate = useNavigate();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [visible, setVisible] = useState(true);
  const lastScrollY = useRef(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Show/hide header on scroll direction
  const handleScroll = useCallback(() => {
    const currentY = window.scrollY;
    if (currentY < 10) {
      setVisible(true);
    } else if (currentY > lastScrollY.current && currentY > 80) {
      setVisible(false);
      setUserDropdownOpen(false);
    } else {
      setVisible(true);
    }
    lastScrollY.current = currentY;
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = () => {
    logout();
    setUserDropdownOpen(false);
    navigate('/');
  };

  return (
    <>
      <header
        className={cn(
          'fixed top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-b border-neutral-100 transition-transform duration-300 ease-out-expo',
          visible ? 'translate-y-0' : '-translate-y-full',
        )}
      >
        <div className="container-page flex h-16 items-center justify-between md:h-18">
          {/* Left: hamburger (mobile) */}
          <div className="flex items-center gap-4 md:w-1/3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="text-neutral-700 transition-colors hover:text-neutral-900 md:hidden"
              aria-label="Open menu"
            >
              <Menu size={22} />
            </button>
            <nav className="hidden items-center gap-8 md:flex">
              <Link
                to="/shop"
                className="text-xs font-medium uppercase tracking-widest text-neutral-600 transition-colors hover:text-neutral-900"
              >
                {t('common.shop')}
              </Link>
              <Link
                to="/contact"
                className="text-xs font-medium uppercase tracking-widest text-neutral-600 transition-colors hover:text-neutral-900"
              >
                {t('common.contact')}
              </Link>
            </nav>
          </div>

          {/* Center: brand */}
          <Link
            to="/"
            className="font-display text-xl font-semibold tracking-[0.2em] text-neutral-900 md:text-2xl"
          >
            BLE$$ P
          </Link>

          {/* Right: icons */}
          <div className="flex items-center justify-end gap-5 md:w-1/3">
            <button
              onClick={() => setSearchOpen(true)}
              className="text-neutral-600 transition-colors hover:text-neutral-900"
              aria-label="Search"
            >
              <Search size={20} />
            </button>

            {/* User icon */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() =>
                  isAuthenticated
                    ? setUserDropdownOpen(!userDropdownOpen)
                    : navigate('/signin')
                }
                className="text-neutral-600 transition-colors hover:text-neutral-900"
                aria-label="Account"
              >
                <User size={20} />
              </button>

              <AnimatePresence>
                {userDropdownOpen && isAuthenticated && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-3 w-52 border border-neutral-100 bg-white py-2 shadow-lg"
                  >
                    <div className="border-b border-neutral-100 px-4 pb-2 mb-1">
                      <p className="text-xs text-neutral-500 truncate">
                        {user?.email}
                      </p>
                    </div>

                    <DropdownLink
                      to="/profile"
                      icon={<UserCircle size={16} />}
                      label={t('nav.myProfile')}
                      onClick={() => setUserDropdownOpen(false)}
                    />
                    <DropdownLink
                      to="/profile/orders"
                      icon={<Package size={16} />}
                      label={t('nav.myOrders')}
                      onClick={() => setUserDropdownOpen(false)}
                    />
                    <DropdownLink
                      to="/wishlist"
                      icon={<Heart size={16} />}
                      label={t('nav.myWishlist')}
                      onClick={() => setUserDropdownOpen(false)}
                    />

                    {isAdmin && (
                      <DropdownLink
                        to="/admin"
                        icon={<Shield size={16} />}
                        label={t('nav.admin')}
                        onClick={() => setUserDropdownOpen(false)}
                      />
                    )}

                    <div className="mt-1 border-t border-neutral-100 pt-1">
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
                      >
                        <LogOut size={16} />
                        {t('common.signOut')}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Wishlist */}
            <Link
              to={isAuthenticated ? '/wishlist' : '/signin'}
              className="relative text-neutral-600 transition-colors hover:text-neutral-900"
              aria-label="Wishlist"
            >
              <Heart size={20} />
              {wishlistCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-medium text-white">
                  {wishlistCount > 9 ? '9+' : wishlistCount}
                </span>
              )}
            </Link>

            {/* Cart */}
            <button
              onClick={openCart}
              className="relative text-neutral-600 transition-colors hover:text-neutral-900"
              aria-label="Cart"
            >
              <ShoppingBag size={20} />
              {itemCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-medium text-white">
                  {itemCount > 9 ? '9+' : itemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/30"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.nav
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.35, ease: [0.19, 1, 0.22, 1] }}
              className="fixed left-0 top-0 z-50 flex h-full w-72 flex-col bg-white px-8 py-6"
            >
              <div className="mb-10 flex items-center justify-between">
                <span className="font-display text-lg font-semibold tracking-[0.15em]">
                  BLE$$ P
                </span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close menu"
                  className="text-neutral-500 hover:text-neutral-900"
                >
                  <X size={22} />
                </button>
              </div>

              {/* Search button in mobile menu */}
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  // Small delay so menu close animation completes
                  setTimeout(() => setSearchOpen(true), 200);
                }}
                className="mb-4 flex w-full items-center gap-3 rounded border border-neutral-200 px-4 py-3 text-sm text-neutral-500 transition-colors hover:border-neutral-300 hover:text-neutral-700"
              >
                <Search size={16} />
                {t('nav.searchProducts')}
              </button>

              <div className="flex flex-col gap-6">
                <MobileLink
                  to="/shop"
                  label={t('common.shop')}
                  onClick={() => setMobileMenuOpen(false)}
                  delay={0.05}
                />
                <MobileLink
                  to="/contact"
                  label={t('common.contact')}
                  onClick={() => setMobileMenuOpen(false)}
                  delay={0.1}
                />
                {/* Divider */}
                <div className="h-px bg-neutral-100" />

                {isAuthenticated ? (
                  <>
                    <MobileLink
                      to="/profile"
                      label={t('nav.profile')}
                      onClick={() => setMobileMenuOpen(false)}
                      delay={0.15}
                    />
                    <MobileLink
                      to="/profile/orders"
                      label={t('nav.orders')}
                      onClick={() => setMobileMenuOpen(false)}
                      delay={0.2}
                    />
                    <MobileLink
                      to="/wishlist"
                      label={t('common.wishlist')}
                      onClick={() => setMobileMenuOpen(false)}
                      delay={0.25}
                      badge={wishlistCount > 0 ? wishlistCount : undefined}
                    />
                    {isAdmin && (
                      <MobileLink
                        to="/admin"
                        label={t('nav.admin')}
                        onClick={() => setMobileMenuOpen(false)}
                        delay={0.3}
                      />
                    )}
                    <div className="h-px bg-neutral-100" />
                    <motion.button
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.35 }}
                      onClick={() => {
                        handleLogout();
                        setMobileMenuOpen(false);
                      }}
                      className="text-left text-sm font-medium uppercase tracking-widest text-neutral-400 transition-colors hover:text-neutral-900"
                    >
                      {t('common.signOut')}
                    </motion.button>
                  </>
                ) : (
                  <>
                    <MobileLink
                      to="/signin"
                      label={t('common.signIn')}
                      onClick={() => setMobileMenuOpen(false)}
                      delay={0.15}
                    />
                    <MobileLink
                      to="/signup"
                      label={t('common.signUp')}
                      onClick={() => setMobileMenuOpen(false)}
                      delay={0.2}
                    />
                  </>
                )}
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>

      <SearchOverlay isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}

function DropdownLink({
  to,
  icon,
  label,
  onClick,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-2 text-sm text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
    >
      {icon}
      {label}
    </Link>
  );
}

function MobileLink({
  to,
  label,
  onClick,
  delay = 0,
  badge,
}: {
  to: string;
  label: string;
  onClick: () => void;
  delay?: number;
  badge?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.2 }}
    >
      <Link
        to={to}
        onClick={onClick}
        className="flex items-center justify-between text-sm font-medium uppercase tracking-widest text-neutral-600 transition-colors hover:text-neutral-900"
      >
        {label}
        {badge !== undefined && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-medium text-white">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </Link>
    </motion.div>
  );
}
