import { WsJwtAuthService } from '../application/services/ws-jwt-auth.service';
import { JwtTokenService } from '../../auth/infrastructure/services/jwt-token.service';
import { SessionCacheService } from '../../../infrastructure/redis/services/session-cache.service';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';

describe('WsJwtAuthService', () => {
  let svc: WsJwtAuthService;
  let jwtTokenService: jest.Mocked<Pick<JwtTokenService, 'verifyAccessToken'>>;
  let sessionCache: jest.Mocked<Pick<SessionCacheService, 'isJtiBlacklisted'>>;

  beforeEach(() => {
    jwtTokenService = { verifyAccessToken: jest.fn() };
    sessionCache = { isJtiBlacklisted: jest.fn().mockResolvedValue(false) };
    svc = new WsJwtAuthService(
      jwtTokenService as unknown as JwtTokenService,
      sessionCache as unknown as SessionCacheService,
    );
  });

  it('rejects missing token', async () => {
    await expect(svc.authenticate(undefined)).rejects.toThrow('requires a JWT');
  });

  it('rejects invalid token', async () => {
    jwtTokenService.verifyAccessToken.mockReturnValue(null);
    await expect(svc.authenticate('bad-token')).rejects.toThrow('Invalid or expired');
  });

  it('rejects blacklisted JTI', async () => {
    jwtTokenService.verifyAccessToken.mockReturnValue(
      new JwtClaimsVO({
        sub: 'user-1',
        tenantId: 'tenant-1',
        branchId: null,
        roles: ['doctor'],
        sessionId: 'sess-1',
        jti: 'jti-revoked',
      }),
    );
    sessionCache.isJtiBlacklisted.mockResolvedValue(true);
    await expect(svc.authenticate('valid-token')).rejects.toThrow('revoked');
  });

  it('returns socket user for valid token', async () => {
    jwtTokenService.verifyAccessToken.mockReturnValue(
      new JwtClaimsVO({
        sub: 'user-1',
        tenantId: 'tenant-1',
        branchId: 'branch-1',
        roles: ['receptionist'],
        sessionId: 'sess-1',
      }),
    );

    const user = await svc.authenticate('valid-token');
    expect(user.sub).toBe('user-1');
    expect(user.tenantId).toBe('tenant-1');
    expect(user.roles).toContain('receptionist');
  });
});
