import { prisma } from '../../core/database/client';
import { emailService } from '../../core/email/email.service';
import { logger } from '../../core/observability/logger';
import { CreateContactMessageDto } from './contact.schema';

export interface ContactMessageResponse {
  id: string;
  message: string;
}

export class ContactService {
  async submitMessage(dto: CreateContactMessageDto): Promise<ContactMessageResponse> {
    const contactMessage = await prisma.contactMessage.create({
      data: {
        name: dto.name,
        email: dto.email,
        subject: dto.subject,
        message: dto.message,
      },
    });

    // Notify the admin team about the new contact form submission
    emailService.send({
      to: 'admin@blessp.com',
      subject: `New contact form submission: ${dto.subject}`,
      html: `
        <h2>New Contact Message</h2>
        <p><strong>From:</strong> ${dto.name} (${dto.email})</p>
        <p><strong>Subject:</strong> ${dto.subject}</p>
        <p><strong>Message:</strong></p>
        <p>${dto.message}</p>
      `,
    }).catch((err) => {
      logger.error({ err, contactMessageId: contactMessage.id }, 'Failed to send contact notification email');
    });

    logger.info({ contactMessageId: contactMessage.id, email: dto.email }, 'Contact form submitted');

    return {
      id: contactMessage.id,
      message: 'Your message has been received. We will get back to you shortly.',
    };
  }
}
