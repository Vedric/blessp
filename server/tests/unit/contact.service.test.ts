jest.mock('@core/database/client', () => ({ prisma: { $transaction: jest.fn(), contactMessage: { create: jest.fn() }, emailOutbox: { upsert: jest.fn() } } }));
jest.mock('@core/config/env', () => ({ Env: { SUPPORT_EMAIL: 'support@example.com' } }));
jest.mock('@core/observability/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('@core/email/email.service', () => ({ emailService: { send: jest.fn() } }));
import { ContactService } from '@features/contact/contact.service';
import { prisma } from '@core/database/client';
import { emailService } from '@core/email/email.service';
const dto = { name: 'Jean Dupont', email: 'jean@example.com', subject: 'Order Inquiry', message: 'Please help with my recent order.' };
beforeEach(() => {
  jest.resetAllMocks();
  (prisma.$transaction as jest.Mock).mockImplementation(work => work(prisma));
  (prisma.contactMessage.create as jest.Mock).mockResolvedValue({ id: 'message-1', ...dto });
  (prisma.emailOutbox.upsert as jest.Mock).mockResolvedValue({});
});
it('stores the contact and queues the notification in one transaction', async () => {
  const result = await new ContactService().submitMessage(dto);
  expect(result.id).toBe('message-1');
  expect(prisma.contactMessage.create).toHaveBeenCalledWith({ data: dto });
  expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  expect(prisma.emailOutbox.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'contact:message-1' }, create: expect.objectContaining({ payload: expect.objectContaining({ to: 'support@example.com' }) }) }));
  expect(emailService.send).not.toHaveBeenCalled();
});
it('does not report success when persisting the notification fails', async () => {
  (prisma.emailOutbox.upsert as jest.Mock).mockRejectedValue(new Error('Database unavailable'));
  await expect(new ContactService().submitMessage(dto)).rejects.toThrow('Database unavailable');
});
it('escapes customer content in the queued HTML', async () => {
  await new ContactService().submitMessage({ ...dto, name: '<img src=x>', message: '<script>bad()</script> & details' });
  const payload = (prisma.emailOutbox.upsert as jest.Mock).mock.calls[0][0].create.payload;
  expect(payload.html).toContain('&lt;script&gt;bad()&lt;/script&gt; &amp; details');
  expect(payload.html).toContain('&lt;img src=x&gt;');
  expect(payload.html).not.toContain('<script>');
});
