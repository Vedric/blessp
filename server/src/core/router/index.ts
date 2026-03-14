import { Router } from 'express';
import { authRouter } from '../../features/auth/auth.router';
import { usersRouter } from '../../features/users/users.router';
import { productsRouter } from '../../features/products/products.router';
import { cartRouter } from '../../features/cart/cart.router';
import { ordersRouter } from '../../features/orders/orders.router';
import { paymentsRouter } from '../../features/payments/payments.router';
import { wishlistRouter } from '../../features/wishlist/wishlist.router';
import { couponsRouter } from '../../features/coupons/coupons.router';
import { currencyRouter } from '../../features/currency/currency.router';
import { reviewsRouter } from '../../features/reviews/reviews.router';
import { newsletterRouter } from '../../features/newsletter/newsletter.router';
import { loyaltyRouter } from '../../features/loyalty/loyalty.router';
import { analyticsRouter } from '../../features/analytics/analytics.router';

const router = Router();

router.use('/auth', authRouter);
router.use('/users', usersRouter);
router.use('/products', productsRouter);
router.use('/cart', cartRouter);
router.use('/orders', ordersRouter);
router.use('/payments', paymentsRouter);
router.use('/wishlist', wishlistRouter);
router.use('/coupons', couponsRouter);
router.use('/currencies', currencyRouter);
router.use('/reviews', reviewsRouter);
router.use('/newsletter', newsletterRouter);
router.use('/loyalty', loyaltyRouter);
router.use('/analytics', analyticsRouter);

export { router as apiRouter };
