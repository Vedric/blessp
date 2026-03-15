jest.mock('@core/database/client', () => ({
  prisma: {
    contactMessage: {
      create: jest.fn(),
    },
  },
}));
jest.mock('@core/config/env', () => ({
  Env: {},
}));
jest.mock('@core/observability/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('@core/email/email.service', () => ({
  emailService: {
    send: jest.fn().mockResolvedValue(undefined),
  },
}));

import { ContactService } from '@features/contact/contact.service';
import { prisma } from '@core/database/client';
import { emailService } from '@core/email/email.service';

const mockContactMessageCreate = prisma.contactMessage.create as jest.Mock;
const mockEmailSend = emailService.send as jest.Mock;

describe('ContactService', () => {
  let service: ContactService;

  const validDto = {
    name: 'Jean Dupont',
    email: 'jean@example.com',
    subject: 'Order Inquiry',
    message: 'I would like to know more about my recent order status.',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ContactService();
  });

  describe('submitMessage', () => {
    it('stores the contact message in the database', async () => {
      mockContactMessageCreate.mockResolvedValueOnce({
        id: 'cm_001',
        ...validDto,
        createdAt: new Date('2026-03-15T10:00:00Z'),
      });

      await service.submitMessage(validDto);

      expect(mockContactMessageCreate).toHaveBeenCalledWith({
        data: {
          name: validDto.name,
          email: validDto.email,
          subject: validDto.subject,
          message: validDto.message,
        },
      });
    });

    it('returns a confirmation response with the message id', async () => {
      mockContactMessageCreate.mockResolvedValueOnce({
        id: 'cm_002',
        ...validDto,
        createdAt: new Date('2026-03-15T10:00:00Z'),
      });

      const result = await service.submitMessage(validDto);

      expect(result.id).toBe('cm_002');
      expect(result.message).toContain('received');
    });

    it('sends an admin notification email after storing the message', async () => {
      mockContactMessageCreate.mockResolvedValueOnce({
        id: 'cm_003',
        ...validDto,
        createdAt: new Date('2026-03-15T10:00:00Z'),
      });

      await service.submitMessage(validDto);

      expect(mockEmailSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'admin@blessp.com',
          subject: expect.stringContaining(validDto.subject),
        }),
      );
    });

    it('does not throw when the admin notification email fails', async () => {
      mockContactMessageCreate.mockResolvedValueOnce({
        id: 'cm_004',
        ...validDto,
        createdAt: new Date('2026-03-15T10:00:00Z'),
      });
      mockEmailSend.mockRejectedValueOnce(new Error('SMTP connection failed'));

      const result = await service.submitMessage(validDto);

      expect(result.id).toBe('cm_004');
    });

    it('includes the sender name and email in the notification body', async () => {
      mockContactMessageCreate.mockResolvedValueOnce({
        id: 'cm_005',
        ...validDto,
        createdAt: new Date('2026-03-15T10:00:00Z'),
      });

      await service.submitMessage(validDto);

      const emailCall = mockEmailSend.mock.calls[0][0];
      expect(emailCall.html).toContain(validDto.name);
      expect(emailCall.html).toContain(validDto.email);
      expect(emailCall.html).toContain(validDto.message);
    });
  });
});
