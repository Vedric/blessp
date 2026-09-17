import { Router } from 'express';
import { NewsletterController } from './newsletter.controller';
import { NewsletterService } from './newsletter.service';
import { NewsletterRepository } from './newsletter.repository';
import { authRateLimiter } from '../../core/middleware/rate.limit';

const newsletterRepository = new NewsletterRepository();
const newsletterService = new NewsletterService(newsletterRepository);
const newsletterController = new NewsletterController(newsletterService);

const router = Router();

// Rate limit to block email enumeration and subscription spam. The strict
// authRateLimiter (10 req / 15 min per IP) is sufficient for a newsletter
// form that is only meant to be used a handful of times per user per day.
router.post('/subscribe', authRateLimiter, newsletterController.subscribe);
router.post('/confirm', authRateLimiter, newsletterController.confirm);
router.post('/unsubscribe', authRateLimiter, newsletterController.unsubscribe);

export { router as newsletterRouter };
