import { RevokeSessionHandler } from '../application/handlers/revoke-session.handler';
import { RefreshTokenRepository } from '../domain/repositories/refresh-token.repository.interface';
import { RefreshToken } from '../domain/entities/refresh-token.entity';
import { EventPublisherInterface } from '../../../infrastructure/event-publisher.interface';

describe('RevokeSessionHandler', () => {
  let handler: RevokeSessionHandler;
  let refreshRepo: jest.Mocked<RefreshTokenRepository>;
  let events: jest.Mocked<EventPublisherInterface>;

  beforeEach(() => {
    refreshRepo = {
      save: jest.fn(),
      findByTokenHash: jest.fn(),
      findBySessionId: jest.fn(),
      findActiveByUserId: jest.fn(),
      revokeBySessionId: jest.fn(),
      revokeAllByUserId: jest.fn(),
      deleteExpired: jest.fn(),
    };
    events = { publish: jest.fn() };
    handler = new RevokeSessionHandler(refreshRepo, events);
  });

  it('revokes a specific session for the current user', async () => {
    refreshRepo.findActiveByUserId.mockResolvedValue([
      RefreshToken.restore({
        id: 'token-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        tokenHash: 'hash',
        sessionId: 'session-other',
        deviceName: 'Chrome',
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
        ipAddress: '127.0.0.1',
        userAgent: 'test',
        createdAt: new Date(),
      }),
    ]);

    const result = await handler.execute({
      userId: 'user-1',
      tenantId: 'tenant-1',
      sessionId: 'session-other',
      currentSessionId: 'session-current',
    });

    expect(result).toEqual({ revoked: true, wasCurrent: false });
    expect(refreshRepo.revokeBySessionId).toHaveBeenCalledWith('session-other');
    expect(events.publish).toHaveBeenCalled();
  });
});
