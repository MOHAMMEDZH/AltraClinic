import { validateJwtSigningSecrets } from '../config/jwt-secrets.config';

describe('jwt-secrets.config — signing secret fail-closed (Phase 49 K2)', () => {
  const access = 'clinic-access-secret-min-32-characters-aa';
  const refresh = 'clinic-refresh-secret-min-32-characters-bb';

  it('accepts independent non-placeholder secrets', () => {
    expect(validateJwtSigningSecrets(access, refresh)).toEqual({
      accessSecret: access,
      refreshSecret: refresh,
    });
  });

  it('rejects short secrets', () => {
    expect(() => validateJwtSigningSecrets('short', refresh)).toThrow(
      /JWT_ACCESS_SECRET must be at least 32/,
    );
    expect(() => validateJwtSigningSecrets(access, 'short')).toThrow(
      /JWT_REFRESH_SECRET must be at least 32/,
    );
  });

  it('rejects known .env.example placeholders', () => {
    expect(() =>
      validateJwtSigningSecrets(
        'change-this-access-secret-min-32-chars-use-crypto-random',
        refresh,
      ),
    ).toThrow(/JWT_ACCESS_SECRET must not be a known placeholder/);
    expect(() =>
      validateJwtSigningSecrets(
        access,
        'change-this-refresh-secret-min-32-chars-different-from-access',
      ),
    ).toThrow(/JWT_REFRESH_SECRET must not be a known placeholder/);
  });

  it('rejects identical access and refresh secrets', () => {
    expect(() => validateJwtSigningSecrets(access, access)).toThrow(
      /must be different/,
    );
  });

  it('error messages never echo secret material', () => {
    const secret = 'super-secret-key-material-that-must-not-leak!!';
    try {
      validateJwtSigningSecrets(secret, secret);
      throw new Error('expected throw');
    } catch (err) {
      const msg = String(err);
      expect(msg).not.toContain(secret);
      expect(msg).toMatch(/JWT_/);
    }
  });
});
