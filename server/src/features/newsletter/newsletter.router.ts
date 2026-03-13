import { Router } from 'express';
import { NewsletterController } from './newsletter.controller';
import { NewsletterService } from './newsletter.service';
import { NewsletterRepository } from './newsletter.repository';

const newsletterRepository = new NewsletterRepository();
const newsletterService = new NewsletterService(newsletterRepository);
const newsletterController = new NewsletterController(newsletterService);

const router = Router();

router.post('/subscribe', newsletterController.subscribe);
router.post('/unsubscribe', newsletterController.unsubscribe);

export { router as newsletterRouter };
