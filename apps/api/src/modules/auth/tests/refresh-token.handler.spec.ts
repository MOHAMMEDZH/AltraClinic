import { RefreshTokenHandler } from '../application/handlers/refresh-token.handler';
import { RefreshToken } from '../domain/entities/refresh-token.entity';
import { UserRepository } from '../../identity/domain/user.repository.interface';
import { RefreshTokenRepository } from '../domain/repositories/refresh-token.repository.interface';
import { JwtTokenService } from '../infrastructure/services/jwt-token.service';
import { TokenPairVO } from '../domain/value-objects/token-pair.vo';
import { RefreshTokenClaimsVO } from '../domain/value-objects/jwt-claims.vo';
import { TokenInvalidException, AccountInactiveException } from '../domain/exceptions/auth.exceptions';
import { User } from '../../identity/domain/user.entity';
import { makeTestUser, mockUserRepository } from '../../../test-support/user-test.factory';

const makeUser = () => makeTestUser({ id: 'u1', email: 'a@b.com', tenantId: 't1', firstName: 'A', lastName: 'B' });

const makeToken = (overrides: Partial<{revokedAt: Date | null; expiresAt: Date}> = {}) =>
  RefreshToken.restore({
    id: 'rt1', userId: 'u1', tenantId: 't1', tokenHash: 'hash123', sessionId: 'session-1',
    deviceName: 'Chrome', expiresAt: overrides.expiresAt ?? new Date(Date.now() + 86400000),
    revokedAt: overrides.revokedAt ?? null, ipAddress: '1.1.1.1', userAgent: 'ua', createdAt: new Date(),
  });

describe('RefreshTokenHandler', () => {
  let handler: RefreshTokenHandler;
  let userRepo: jest.Mocked<UserRepository>;
  let refreshRepo: jest.Mocked<RefreshTokenRepository>;
  let jwtService: jest.Mocked<JwtTokenService>;

  const validClaims: RefreshTokenClaimsVO = { sub: 'u1', sessionId: 'session-1', type: 'refresh' };

  beforeEach(() => {
    userRepo = mockUserRepository();
    refreshRepo = {
      save: jest.fn(), findByTokenHash: jest.fn(), findBySessionId: jest.fn(),
      findActiveByUserId: jest.fn(), revokeBySessionId: jest.fn(),
      revokeAllByUserId: jest.fn(), deleteExpired: jest.fn(),
    };
    jwtService = {
      verifyRefreshToken: jest.fn().mockReturnValue(validClaims),
      issueTokenPair: jest.fn().mockReturnValue(
        new TokenPairVO({ accessToken: 'new_access', refreshToken: 'new_refresh', accessExpiresIn: 900, sessionId: 'session-2' }),
      ),
      generateSessionId: jest.fn().mockReturnValue('session-2'),
      getRefreshExpiresAt: jest.fn().mockReturnValue(new Date(Date.now() + 86400000)),
      verifyAccessToken: jest.fn(),
    } as unknown as jest.Mocked<JwtTokenService>;

    handler = new RefreshTokenHandler(userRepo, refreshRepo, jwtService);
  });

  it('rotates refresh token and returns new pair', async () => {
    const token = makeToken();
    refreshRepo.findByTokenHash.mockResolvedValue(token);
    userRepo.findById.mockResolvedValue(makeUser());

    const result = await handler.execute('raw_token', '1.1.1.1', 'ua');

    expect(result.accessToken).toBe('new_access');
    expect(refreshRepo.revokeBySessionId).toHaveBeenCalledWith('session-1');
    expect(refreshRepo.save).toHaveBeenCalledTimes(1);
  });

  it('throws TokenInvalid when JWT signature is bad', async () => {
    jwtService.verifyRefreshToken.mockReturnValue(null);
    await expect(handler.execute('bad_token', '1.1.1.1', 'ua')).rejects.toThrow(TokenInvalidException);
  });

  it('revokes all sessions when token hash not found (replay attack)', async () => {
    refreshRepo.findByTokenHash.mockResolvedValue(null);
    await expect(handler.execute('raw_token', '1.1.1.1', 'ua')).rejects.toThrow(TokenInvalidException);
    expect(refreshRepo.revokeAllByUserId).toHaveBeenCalledWith('u1');
  });

  it('revokes all sessions when token already revoked (replay)', async () => {
    const token = makeToken({ revokedAt: new Date(Date.now() - 1000) });
    refreshRepo.findByTokenHash.mockResolvedValue(token);
    await expect(handler.execute('raw_token', '1.1.1.1', 'ua')).rejects.toThrow(TokenInvalidException);
    expect(refreshRepo.revokeAllByUserId).toHaveBeenCalledWith('u1');
  });

  it('throws AccountInactive when user not found after token lookup', async () => {
    const token = makeToken();
    refreshRepo.findByTokenHash.mockResolvedValue(token);
    userRepo.findById.mockResolvedValue(null);
    await expect(handler.execute('raw_token', '1.1.1.1', 'ua')).rejects.toThrow(AccountInactiveException);
  });
});
