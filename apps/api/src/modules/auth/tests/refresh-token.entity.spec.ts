import { RefreshToken } from '../domain/entities/refresh-token.entity';

describe('RefreshToken entity', () => {
  const future = new Date(Date.now() + 86400_000);
  const past = new Date(Date.now() - 1000);

  it('creates a token with hashed rawToken', () => {
    const token = RefreshToken.create({
      userId: 'u1', tenantId: 't1', rawToken: 'raw123', sessionId: 's1', deviceName: 'Chrome',
      expiresAt: future, ipAddress: '1.1.1.1', userAgent: 'ua',
    });
    expect(token.tokenHash).not.toBe('raw123');
    expect(token.tokenHash).toHaveLength(64);
    expect(token.isValid()).toBe(true);
    expect(token.tenantId).toBe('t1');
  });

  it('detects expired tokens', () => {
    const token = RefreshToken.restore({
      id: '1', userId: 'u1', tenantId: 't1', tokenHash: 'h', sessionId: 's1', deviceName: null,
      expiresAt: past, revokedAt: null, ipAddress: null, userAgent: null, createdAt: new Date(),
    });
    expect(token.isExpired()).toBe(true);
    expect(token.isValid()).toBe(false);
  });

  it('detects revoked tokens', () => {
    const token = RefreshToken.restore({
      id: '1', userId: 'u1', tenantId: 't1', tokenHash: 'h', sessionId: 's1', deviceName: null,
      expiresAt: future, revokedAt: new Date(), ipAddress: null, userAgent: null, createdAt: new Date(),
    });
    expect(token.isRevoked()).toBe(true);
    expect(token.isValid()).toBe(false);
  });

  it('hash is consistent', () => {
    expect(RefreshToken.hash('abc')).toBe(RefreshToken.hash('abc'));
    expect(RefreshToken.hash('abc')).not.toBe(RefreshToken.hash('xyz'));
  });

  it('revoke() returns new instance with revokedAt set', () => {
    const original = RefreshToken.create({
      userId: 'u1', tenantId: 't1', rawToken: 'raw', sessionId: 's1', deviceName: null,
      expiresAt: future, ipAddress: null, userAgent: null,
    });
    const revoked = original.revoke();
    expect(revoked.revokedAt).not.toBeNull();
    expect(original.revokedAt).toBeNull(); // immutable
  });
});
