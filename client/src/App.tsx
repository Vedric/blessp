import '@/i18n';
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import { WishlistProvider } from '@/context/WishlistContext';
import { CurrencyProvider } from '@/context/CurrencyContext';
import { CompareProvider } from '@/context/CompareContext';
import { Layout } from '@/components/layout/Layout';
import { ProtectedRoute } from '@/components/common/ProtectedRoute';
import { AdminRoute } from '@/components/common/AdminRoute';
import { CookieBanner } from '@/components/common/CookieBanner';
import { RouteMetadata } from '@/components/common/RouteMetadata';
import { ScrollToTop } from '@/components/common/ScrollToTop';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { WelcomeCouponPopup } from '@/components/common/WelcomeCouponPopup';
import { MfaOptInPopup } from '@/components/auth/MfaOptInPopup';
import { DevResetPanel } from '@/components/common/DevResetPanel';
import HomePage from '@/pages/home/HomePage';

/* ── Lazy-loaded page components ── */
const ShopPage = lazy(() => import('@/pages/shop/ShopPage'));
const ProductPage = lazy(() => import('@/pages/product/ProductPage'));
const CheckoutPage = lazy(() => import('@/pages/checkout/CheckoutPage'));
const SignInPage = lazy(() => import('@/pages/auth/SignInPage'));
const VerifyEmailPage = lazy(() => import('@/pages/auth/VerifyEmailPage'));
const GuestOrderPage = lazy(() => import('@/pages/checkout/GuestOrderPage'));
const NewsletterConfirmationPage = lazy(() => import('@/pages/auth/NewsletterConfirmationPage'));
const SignUpPage = lazy(() => import('@/pages/auth/SignUpPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'));
const ProfilePage = lazy(() => import('@/pages/profile/ProfilePage'));
const OrdersPage = lazy(() => import('@/pages/profile/OrdersPage'));
const OrderDetailPage = lazy(() => import('@/pages/profile/OrderDetailPage'));
const AddressesPage = lazy(() => import('@/pages/profile/AddressesPage'));
const LoyaltyPage = lazy(() => import('@/pages/profile/LoyaltyPage'));
const PaymentMethodsPage = lazy(() => import('@/pages/profile/PaymentMethodsPage'));
const EmailPreferencesPage = lazy(() => import('@/pages/profile/EmailPreferencesPage'));
const AdminDashboardPage = lazy(() => import('@/pages/admin/AdminDashboardPage'));
const AdminContactPage = lazy(() => import('@/pages/admin/AdminContactPage'));
const AdminInventoryPage = lazy(() => import('@/pages/admin/AdminInventoryPage'));
const AdminProductsPage = lazy(() => import('@/pages/admin/AdminProductsPage'));
const AdminProductEditPage = lazy(() => import('@/pages/admin/AdminProductEditPage'));
const AdminOrdersPage = lazy(() => import('@/pages/admin/AdminOrdersPage'));
const AdminReviewsPage = lazy(() => import('@/pages/admin/AdminReviewsPage'));
const ContactPage = lazy(() => import('@/pages/contact/ContactPage'));
const TermsPage = lazy(() => import('@/pages/legal/TermsPage'));
const ReturnPolicyPage = lazy(() => import('@/pages/legal/ReturnPolicyPage'));
const PrivacyPolicyPage = lazy(() => import('@/pages/legal/PrivacyPolicyPage'));
const LegalNoticePage = lazy(() => import('@/pages/legal/LegalNoticePage'));
const WishlistPage = lazy(() => import('@/pages/wishlist/WishlistPage'));
const SearchPage = lazy(() => import('@/pages/search/SearchPage'));
const ComparePage = lazy(() => import('@/pages/compare/ComparePage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

function PageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
    <BrowserRouter>
      <ScrollToTop />
      <RouteMetadata />
      <CurrencyProvider>
        <AuthProvider>
          <CartProvider>
            <WishlistProvider>
            <CompareProvider>
              <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route element={<Layout />}>
                  {/* Public routes */}
                  <Route path="/" element={<HomePage />} />
                  <Route path="/shop" element={<ShopPage />} />
                  <Route path="/products/:id" element={<ProductPage />} />
                  <Route path="/search" element={<SearchPage />} />
                  <Route path="/signin" element={<SignInPage />} />
                  <Route path="/verify-email" element={<VerifyEmailPage />} />
                  <Route path="/order-status" element={<GuestOrderPage />} />
                  <Route path="/newsletter/confirm" element={<NewsletterConfirmationPage />} />
                  <Route path="/signup" element={<SignUpPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                  <Route path="/contact" element={<ContactPage />} />
                  <Route path="/terms" element={<TermsPage />} />
                  <Route path="/return-policy" element={<ReturnPolicyPage />} />
                  <Route path="/privacy" element={<PrivacyPolicyPage />} />
                  <Route path="/legal-notice" element={<LegalNoticePage />} />
                  <Route path="/compare" element={<ComparePage />} />

                  {/* Checkout is open to guests and authenticated users alike */}
                  <Route path="/checkout" element={<CheckoutPage />} />

                  {/* Protected routes */}
                  <Route
                    path="/profile"
                    element={
                      <ProtectedRoute>
                        <ProfilePage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/profile/orders"
                    element={
                      <ProtectedRoute>
                        <OrdersPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/profile/orders/:id"
                    element={
                      <ProtectedRoute>
                        <OrderDetailPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/profile/addresses"
                    element={
                      <ProtectedRoute>
                        <AddressesPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/profile/payment-methods"
                    element={
                      <ProtectedRoute>
                        <PaymentMethodsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/profile/email-preferences"
                    element={
                      <ProtectedRoute>
                        <EmailPreferencesPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/profile/loyalty"
                    element={
                      <ProtectedRoute>
                        <LoyaltyPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/wishlist"
                    element={
                      <ProtectedRoute>
                        <WishlistPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Admin routes */}
                  <Route
                    path="/admin"
                    element={
                      <AdminRoute>
                        <AdminDashboardPage />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="/admin/products"
                    element={
                      <AdminRoute>
                        <AdminProductsPage />
                      </AdminRoute>
                    }
                  />
                  <Route path="/admin/contact" element={<AdminRoute><AdminContactPage /></AdminRoute>} />
                  <Route path="/admin/inventory" element={<AdminRoute><AdminInventoryPage /></AdminRoute>} />
                  <Route path="/admin/products/new" element={<AdminRoute><AdminProductEditPage /></AdminRoute>} />
                  <Route
                    path="/admin/products/:id/edit"
                    element={
                      <AdminRoute>
                        <AdminProductEditPage />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="/admin/orders"
                    element={
                      <AdminRoute>
                        <AdminOrdersPage />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="/admin/reviews"
                    element={
                      <AdminRoute>
                        <AdminReviewsPage />
                      </AdminRoute>
                    }
                  />

                  {/* Catch-all 404 */}
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
              </Suspense>
            </CompareProvider>
            </WishlistProvider>

            <CookieBanner />
            <WelcomeCouponPopup />
            <MfaOptInPopup />
            <DevResetPanel />

            <Toaster
              position="bottom-right"
              toastOptions={{
                duration: 3000,
                style: {
                  background: '#171717',
                  color: '#fff',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit',
                  borderRadius: '0',
                  padding: '14px 22px',
                  letterSpacing: '0.02em',
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
                  maxWidth: '420px',
                },
                success: {
                  style: {
                    background: '#171717',
                    borderLeft: '3px solid #a07a52',
                  },
                  iconTheme: {
                    primary: '#a07a52',
                    secondary: '#171717',
                  },
                },
                error: {
                  style: {
                    background: '#171717',
                    borderLeft: '3px solid #ef4444',
                  },
                  iconTheme: {
                    primary: '#ef4444',
                    secondary: '#171717',
                  },
                },
              }}
            />
          </CartProvider>
        </AuthProvider>
      </CurrencyProvider>
    </BrowserRouter>
    </ErrorBoundary>
  );
}
