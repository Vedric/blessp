import { Request, Response, NextFunction } from 'express';
import { ContactService } from './contact.service';
import { CreateContactMessageSchema } from './contact.schema';
import { sendCreated } from '../../core/types/response';

export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  submit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = CreateContactMessageSchema.parse(req.body);
      const result = await this.contactService.submitMessage(dto);

      sendCreated(res, req, result);
    } catch (error) {
      next(error);
    }
  };
}
