import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Minus, Plus, ShoppingBag } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useCurrency } from '@/context/CurrencyContext';
import { useScrollLock } from '@/hooks/useScrollLock';
import { Button } from '@/components/ui/Button';

export function CartDrawer() {
  const {
    items,
    total,
    isOpen,
    closeCart,
    updateQuantity,
    removeItem,
  } = useCart();
  const { formatPrice } = useCurrency();

  useScrollLock(isOpen);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/30"
            onClick={closeCart}
          />

          {/* Drawer */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.35, ease: [0.19, 1, 0.22, 1] }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-5">
              <h2 className="font-display text-lg font-medium">Cart</h2>
              <button
                onClick={closeCart}
                className="text-neutral-400 transition-colors hover:text-neutral-900"
                aria-label="Close cart"
              >
                <X size={20} />
              </button>
            </div>

            {/* Items */}
            {items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
                <ShoppingBag size={40} className="text-neutral-300" />
                <p className="text-sm text-neutral-500">
                  Your cart is empty.
                </p>
                <Button variant="secondary" size="sm" onClick={closeCart}>
                  Continue Shopping
                </Button>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  <ul className="divide-y divide-neutral-100">
                    {items.map((item) => (
                      <li key={item.id} className="flex gap-4 py-5">
                        {/* Image */}
                        <div className="h-24 w-20 flex-shrink-0 overflow-hidden bg-neutral-100">
                          {item.product.picture && (
                            <img
                              src={item.product.picture}
                              alt={item.product.name}
                              className="h-full w-full object-cover"
                            />
                          )}
                        </div>

                        {/* Details */}
                        <div className="flex flex-1 flex-col justify-between">
                          <div>
                            <h3 className="text-sm font-medium text-neutral-900">
                              {item.product.name}
                            </h3>
                            <p className="mt-0.5 text-xs text-neutral-500">
                              {item.size} / {item.color}
                            </p>
                          </div>

                          <div className="flex items-center justify-between">
                            {/* Quantity controls */}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() =>
                                  item.quantity <= 1
                                    ? removeItem(item.id)
                                    : updateQuantity(item.id, item.quantity - 1)
                                }
                                className="flex h-7 w-7 items-center justify-center border border-neutral-200 text-neutral-600 transition-colors hover:border-neutral-400"
                                aria-label="Decrease quantity"
                              >
                                <Minus size={12} />
                              </button>
                              <span className="w-6 text-center text-xs font-medium">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() =>
                                  updateQuantity(item.id, item.quantity + 1)
                                }
                                className="flex h-7 w-7 items-center justify-center border border-neutral-200 text-neutral-600 transition-colors hover:border-neutral-400"
                                aria-label="Increase quantity"
                              >
                                <Plus size={12} />
                              </button>
                            </div>

                            <p className="text-sm font-medium">
                              {formatPrice(
                                item.product.price * item.quantity,
                              )}
                            </p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Footer */}
                <div className="border-t border-neutral-100 px-6 py-5">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-sm text-neutral-600">Subtotal</span>
                    <span className="text-base font-medium">
                      {formatPrice(total)}
                    </span>
                  </div>
                  <Link to="/checkout" onClick={closeCart}>
                    <Button variant="primary" size="lg" className="w-full">
                      Checkout
                    </Button>
                  </Link>
                  <button
                    onClick={closeCart}
                    className="mt-3 block w-full text-center text-xs text-neutral-500 underline-offset-4 transition-colors hover:text-neutral-900 hover:underline"
                  >
                    Continue Shopping
                  </button>
                </div>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
