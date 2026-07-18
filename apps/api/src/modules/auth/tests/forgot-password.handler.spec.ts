import { ForgotPasswordHandler } from '../application/handlers/forgot-password.handler';
import { UserRepository } from '../../identity/domain/user.repository.interface';
import { PasswordResetTokenRepository } from '../domain/repositories/password-reset-token.repository.interface';
import { EmailSenderPort } from '../infrastructure/services/email-sender.port';
import { EventPublisherInterface } from '../../../infrastructure/event-publisher.interface';
import { User } from '../../identity/domain/user.entity';
import { makeTestUser, mockUserRepository } from '../../../test-support/user-test.factory';

const makeUser = () => makeTestUser({ id: 'u1', email: 'test@example.com', tenantId: 't1', firstName: 'A', lastName: 'B' });

describe('ForgotPasswordHandler', () => {
  let handler: ForgotPasswordHandler;
  let userRepo: jest.Mocked<UserRepository>;
  let tokenRepo: jest.Mocked<PasswordResetTokenRepository>;
  let emailSender: jest.Mocked<EmailSenderPort>;
  let events: jest.Mocked<EventPublisherInterface>;

  beforeEach(() => {
    userRepo = mockUserRepository();
    tokenRepo = { save: jest.fn(), findByTokenHash: jest.fn(), invalidateAllForUser: jest.fn() };
    emailSender = { sendPasswordReset: jest.fn(), sendEmailVerification: jest.fn(), sendLoginAlert: jest.fn() };
    events = { publish: jest.fn() };

    const rateLimiter = { increment: jest.fn().mockResolvedValue(1), getCount: jest.fn(), reset: jest.fn() };
    handler = new ForgotPasswordHandler(userRepo, tokenRepo, emailSender, rateLimiter, events);
  });

  it('sends reset email for valid user', async () => {
    userRepo.findByEmail.mockResolvedValue(makeUser());

    await handler.execute({ email: 'test@example.com', tenantId: 't1', ipAddress: '1.1.1.1' });

    expect(tokenRepo.invalidateAllForUser).toHaveBeenCalledWith('u1');
    expect(tokenRepo.save).toHaveBeenCalledTimes(1);
    expect(emailSender.sendPasswordReset).toHaveBeenCalledWith(
      'test@example.com',
      expect.any(String),
    );
    expect(events.publish).toHaveBeenCalledTimes(1);
  });

  it('does not reveal whether user exists (silently succeeds)', async () => {
    userRepo.findByEmail.mockResolvedValue(null);

    await expect(
      handler.execute({ email: 'unknown@example.com', tenantId: 't1', ipAddress: '1.1.1.1' }),
    ).resolves.toBeUndefined();

    expect(emailSender.sendPasswordReset).not.toHaveBeenCalled();
    expect(tokenRepo.save).not.toHaveBeenCalled();
  });

  it('does not send email for inactive user', async () => {
    const inactiveUser = makeTestUser({ id: 'u1', email: 'test@example.com', tenantId: 't1', isActive: false, firstName: 'A', lastName: 'B' });
    userRepo.findByEmail.mockResolvedValue(inactiveUser);

    await handler.execute({ email: 'test@example.com', tenantId: 't1', ipAddress: '1.1.1.1' });

    expect(emailSender.sendPasswordReset).not.toHaveBeenCalled();
  });
});
