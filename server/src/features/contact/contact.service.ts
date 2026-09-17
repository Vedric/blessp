import { escapeHtml } from '../../core/email/html';
import { transaction } from '../../core/database/transaction';
import { Env } from '../../core/config/env';
import { enqueueEmail } from '../../core/email/outbox';
import { logger } from '../../core/observability/logger';
import { CreateContactMessageDto } from './contact.schema';

export interface ContactMessageResponse {
  id: string;
  message: string;
}

export class ContactService {
  async submitMessage(dto: CreateContactMessageDto): Promise<ContactMessageResponse> {
    const contactMessage = await transaction(async tx => {
      const message = await tx.contactMessage.create({
        data: {
          name: dto.name,
          email: dto.email,
          subject: dto.subject,
          message: dto.message,
        },
      });

      // The message and its notification are committed together; delivery retries durably.
      await enqueueEmail(tx, {
        to: Env.SUPPORT_EMAIL ?? 'support@example.invalid',
        subject: `New contact form submission: ${dto.subject}`,
        html: `
          <h2>New Contact Message</h2>
          <p><strong>From:</strong> ${escapeHtml(dto.name)} (${escapeHtml(dto.email)})</p>
          <p><strong>Subject:</strong> ${escapeHtml(dto.subject)}</p>
          <p><strong>Message:</strong></p>
          <p>${escapeHtml(dto.message)}</p>
        `,
      }, `contact:${message.id}`);
      return message;
    });

    logger.info({ contactMessageId: contactMessage.id }, 'Contact form submitted');

    return {
      id: contactMessage.id,
      message: 'Your message has been received. We will get back to you shortly.',
    };
  }
}
