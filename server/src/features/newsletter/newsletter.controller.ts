import { Request, Response, NextFunction } from 'express';
import { NewsletterService } from './newsletter.service';
import { NewsletterSubscribeSchema, NewsletterUnsubscribeSchema } from './newsletter.schema';
import { sendSuccess, sendCreated, sendNoContent } from '../../core/types/response';

export class NewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  subscribe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = NewsletterSubscribeSchema.parse(req.body);
      const result = await this.newsletterService.subscribe(dto.email);

      const message = result.alreadySubscribed
        ? 'This email is already subscribed.'
        : 'Successfully subscribed to the newsletter.';

      if (result.alreadySubscribed) {
        sendSuccess(res, req, { message });
      } else {
        sendCreated(res, req, { message });
      }
    } catch (error) {
      next(error);
    }
  };

  unsubscribe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = NewsletterUnsubscribeSchema.parse(req.body);
      await this.newsletterService.unsubscribe(dto.email);

      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  };
}
