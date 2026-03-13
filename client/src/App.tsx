import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import { WishlistProvider } from '@/context/WishlistContext';
import { CurrencyProvider } from '@/context/CurrencyContext';
import { Layout } from '@/components/layout/Layout';
import { ProtectedRoute } from '@/components/common/ProtectedRoute';
import { AdminRoute } from '@/components/common/AdminRoute';
import { CookieBanner } from '@/components/common/CookieBanner';
import { ScrollToTop } from '@/components/common/ScrollToTop';

/* ── Lazy-loaded page components ── */
const HomePage = lazy(() => import('@/pages/home/HomePage'));
const ShopPage = lazy(() => import('@/pages/shop/ShopPage'));
const ProductPage = lazy(() => import('@/pages/product/ProductPage'));
const CheckoutPage = lazy(() => import('@/pages/checkout/CheckoutPage'));
const SignInPage = lazy(() => import('@/pages/auth/SignInPage'));
const SignUpPage = lazy(() => import('@/pages/auth/SignUpPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'));
const ProfilePage = lazy(() => import('@/pages/profile/ProfilePage'));
const OrdersPage = lazy(() => import('@/pages/profile/OrdersPage'));
const OrderDetailPage = lazy(() => import('@/pages/profile/OrderDetailPage'));
const AddressesPage = lazy(() => import('@/pages/profile/AddressesPage'));
const AdminDashboardPage = lazy(() => import('@/pages/admin/AdminDashboardPage'));
const AdminProductsPage = lazy(() => import('@/pages/admin/AdminProductsPage'));
const AdminProductEditPage = lazy(() => import('@/pages/admin/AdminProductEditPage'));
const AdminOrdersPage = lazy(() => import('@/pages/admin/AdminOrdersPage'));
const ContactPage = lazy(() => import('@/pages/contact/ContactPage'));
const TermsPage = lazy(() => import('@/pages/legal/TermsPage'));
const ReturnPolicyPage = lazy(() => import('@/pages/legal/ReturnPolicyPage'));
const WishlistPage = lazy(() => import('@/pages/wishlist/WishlistPage'));
const SearchPage = lazy(() => import('@/pages/search/SearchPage'));
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
    <BrowserRouter>
      <ScrollToTop />
      <CurrencyProvider>
        <AuthProvider>
          <CartProvider>
            <WishlistProvider>
              <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route element={<Layout />}>
                  {/* Public routes */}
                  <Route path="/" element={<HomePage />} />
                  <Route path="/shop" element={<ShopPage />} />
                  <Route path="/products/:id" element={<ProductPage />} />
                  <Route path="/search" element={<SearchPage />} />
                  <Route path="/signin" element={<SignInPage />} />
                  <Route path="/signup" element={<SignUpPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                  <Route path="/contact" element={<ContactPage />} />
                  <Route path="/terms" element={<TermsPage />} />
                  <Route path="/return-policy" element={<ReturnPolicyPage />} />

                  {/* Protected routes */}
                  <Route
                    path="/checkout"
                    element={
                      <ProtectedRoute>
                        <CheckoutPage />
                      </ProtectedRoute>
                    }
                  />
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

                  {/* Catch-all 404 */}
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
              </Suspense>
            </WishlistProvider>

            <CookieBanner />

            <Toaster
              position="bottom-right"
              toastOptions={{
                duration: 3000,
                style: {
                  background: '#171717',
                  color: '#fff',
                  fontSize: '0.875rem',
                  borderRadius: '0',
                  padding: '12px 20px',
                },
              }}
            />
          </CartProvider>
        </AuthProvider>
      </CurrencyProvider>
    </BrowserRouter>
  );
}
