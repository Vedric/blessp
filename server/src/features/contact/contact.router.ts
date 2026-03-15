import { Router, type RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';

const contactService = new ContactService();
const contactController = new ContactController(contactService);

const isTest = process.env.NODE_ENV === 'test';

// Tight rate limit to prevent abuse of the public contact form:
// 5 submissions per 15-minute window per IP
const contactRateLimiter: RequestHandler = isTest
  ? (_req, _res, next) => next()
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 5,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many contact submissions. Please wait before trying again.',
        },
      },
    });

const router = Router();

router.post('/', contactRateLimiter, contactController.submit);

export { router as contactRouter };
