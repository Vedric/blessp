import { Request, Response, NextFunction } from 'express';
import { NewsletterService } from './newsletter.service';
import { NewsletterSubscribeSchema, NewsletterUnsubscribeSchema } from './newsletter.schema';

export class NewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  subscribe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = NewsletterSubscribeSchema.parse(req.body);
      const result = await this.newsletterService.subscribe(dto.email);

      const statusCode = result.alreadySubscribed ? 200 : 201;
      res.status(statusCode).json({
        data: {
          message: result.alreadySubscribed
            ? 'This email is already subscribed.'
            : 'Successfully subscribed to the newsletter.',
        },
        meta: {
          requestId: req.headers['x-request-id'] as string,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  unsubscribe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = NewsletterUnsubscribeSchema.parse(req.body);
      await this.newsletterService.unsubscribe(dto.email);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
