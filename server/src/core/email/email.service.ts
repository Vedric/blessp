import { logger } from '../observability/logger';

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

export class EmailService {
  async send(payload: EmailPayload): Promise<void> {
    // In production, this would use an SMTP service (SendGrid, SES, etc.)
    // For development, we log the email content for verification
    logger.info(
      { to: payload.to, subject: payload.subject },
      'Email sent (dev mode)',
    );

    if (process.env.LOG_LEVEL === 'debug') {
      logger.debug({ html: payload.html }, 'Email HTML content');
    }
  }
}

export const emailService = new EmailService();
