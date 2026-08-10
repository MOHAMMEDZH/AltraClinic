/**
 * Phase 46b — secure storage for patient portal session tokens only.
 * Explicit allowlist; arbitrary credential keys remain forbidden.
 */

export interface SecureStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
}

const ALLOWED_KEYS = new Set([
  'portal.accessToken',
  'portal.refreshToken',
  'portal.sessionId',
  'portal.tenantId',
  'portal.locale',
]);

const FORBIDDEN_KEYS = /password|secret|credential/i;

export class MemorySecureStorage implements SecureStorage {
  private readonly store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) ?? null) : null;
  }

  setItem(key: string, value: string): void {
    if (FORBIDDEN_KEYS.test(key) && !ALLOWED_KEYS.has(key)) {
      throw new Error('Credential persistence is not permitted');
    }
    if (!ALLOWED_KEYS.has(key) && /token|session/i.test(key)) {
      throw new Error('Only approved portal session keys may be stored');
    }
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

export class SessionSecureStorage implements SecureStorage {
  getItem(key: string): string | null {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage.getItem(key);
  }

  setItem(key: string, value: string): void {
    if (FORBIDDEN_KEYS.test(key) && !ALLOWED_KEYS.has(key)) {
      throw new Error('Credential persistence is not permitted');
    }
    if (!ALLOWED_KEYS.has(key) && /token|session/i.test(key)) {
      throw new Error('Only approved portal session keys may be stored');
    }
    sessionStorage.setItem(key, value);
  }

  removeItem(key: string): void {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.removeItem(key);
  }

  clear(): void {
    for (const key of ALLOWED_KEYS) {
      this.removeItem(key);
    }
  }
}

export function createSecureStorage(): SecureStorage {
  if (typeof sessionStorage !== 'undefined') {
    return new SessionSecureStorage();
  }
  return new MemorySecureStorage();
}
