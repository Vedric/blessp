import { Request, Response, NextFunction } from 'express';
import { NewsletterService } from './newsletter.service';
import { NewsletterSubscribeSchema, NewsletterUnsubscribeSchema } from './newsletter.schema';
import { sendSuccess, sendNoContent } from '../../core/types/response';

export class NewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  subscribe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = NewsletterSubscribeSchema.parse(req.body);
      await this.newsletterService.subscribe(dto.email);
      res.status(202).json({ data: { message: 'Check your email to confirm your subscription.' } });
    } catch (error) {
      next(error);
    }
  };

  confirm = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try { const { token } = NewsletterUnsubscribeSchema.parse(req.body); await this.newsletterService.confirm(token); sendSuccess(res, req, { message: 'Subscription confirmed.' }); } catch (error) { next(error); }
  };

  unsubscribe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = NewsletterUnsubscribeSchema.parse(req.body);
      await this.newsletterService.unsubscribe(dto.token);

      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  };
}
