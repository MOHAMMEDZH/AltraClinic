import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import { useI18n } from '@booking/i18n/react';
import { useSuperAdminConfig } from '../app/providers/ConfigProvider';
import {
  createPlatformAuthClient,
  PlatformAuthApiError,
  type PlatformAuthClient,
  type PlatformPrincipal,
} from './platform-auth-api';
import { startPlatformActivitySignal } from './platform-activity';

export type AuthStatus =
  | 'loading'
  | 'unauthenticated'
  | 'mfa_enrollment_required'
  | 'mfa_challenge_required'
  | 'authenticated';

interface PlatformAuthContextValue {
  status: AuthStatus;
  principal: PlatformPrincipal | null;
  error: string | null;
  /** Email surfaced by login when a brand-new account still needs MFA enrollment. */
  enrollmentEmail: string | null;
  /** One-time recovery codes — must be acknowledged before this clears. Never persisted. */
  recoveryCodes: string[] | null;
  client: PlatformAuthClient;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  beginEnrollment: () => Promise<{ otpauthUrl: string; secret: string }>;
  confirmEnrollment: (code: string, deviceLabel?: string) => Promise<void>;
  submitMfaChallenge: (code: string, deviceLabel?: string) => Promise<void>;
  /** Starts mandatory MFA enrollment after accepting a platform invitation. */
  beginInvitedEnrollment: (preauthToken: string, email: string) => void;
  acknowledgeRecoveryCodes: () => void;
  clearError: () => void;
  getAccessToken: () => string | null;
  /**
   * Runs an authenticated call with the current access token. On a 401 it
   * refreshes the session once (via the HttpOnly refresh cookie) and retries.
   */
  withAccessToken: <T>(fn: (accessToken: string) => Promise<T>) => Promise<T>;
}

const PlatformAuthContext = createContext<PlatformAuthContextValue | null>(null);

/**
 * In-memory only — never localStorage/sessionStorage. Module-level so the
 * current access token can be read synchronously outside React render.
 */
let memoryAccessToken: string | null = null;
let memoryPreauthToken: string | null = null;

export function PlatformAuthProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const config = useSuperAdminConfig();
  const client = useMemo(
    () => createPlatformAuthClient(config.apiBaseUrl),
    [config.apiBaseUrl],
  );

  const [status, setStatus] = useState<AuthStatus>('loading');
  const [principal, setPrincipal] = useState<PlatformPrincipal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enrollmentEmail, setEnrollmentEmail] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  const clientRef = useRef(client);
  clientRef.current = client;

  const bootstrap = useCallback(async (authClient: PlatformAuthClient) => {
    try {
      const refreshed = await authClient.refresh();
      memoryAccessToken = refreshed.accessToken;
      const me = await authClient.me(refreshed.accessToken);
      setPrincipal(me);
      setStatus('authenticated');
    } catch {
      memoryAccessToken = null;
      setPrincipal(null);
      setStatus('unauthenticated');
    }
  }, []);

  useEffect(() => {
    void bootstrap(client);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootstrap, client]);

  // Interactive activity only — never bootstrap, refresh, or polling.
  useEffect(() => {
    if (status !== 'authenticated') return undefined;
    return startPlatformActivitySignal({
      getAccessToken: () => memoryAccessToken,
      isAuthenticated: () => memoryAccessToken !== null,
      recordActivity: (accessToken) => client.recordActivity(accessToken),
    });
  }, [status, client]);

  const login = useCallback(
    async (email: string, password: string) => {
      setError(null);
      try {
        const result = await client.login(email.trim(), password);
        memoryPreauthToken = result.preauthToken;
        if (result.kind === 'mfa_enrollment_required') {
          setEnrollmentEmail(result.email);
          setStatus('mfa_enrollment_required');
        } else {
          setEnrollmentEmail(null);
          setStatus('mfa_challenge_required');
        }
      } catch (err) {
        memoryPreauthToken = null;
        setStatus('unauthenticated');
        if (err instanceof PlatformAuthApiError && err.status === 429) {
          setError(t('pages.login.tooManyAttempts', 'Too many attempts. Please try again later.'));
        } else {
          setError(t('pages.login.invalidCredentials', 'Invalid email or password.'));
        }
        throw err;
      }
    },
    [client, t],
  );

  const logout = useCallback(async () => {
    const token = memoryAccessToken;
    memoryAccessToken = null;
    memoryPreauthToken = null;
    setPrincipal(null);
    setEnrollmentEmail(null);
    setRecoveryCodes(null);
    setStatus('unauthenticated');
    setError(null);
    if (token) {
      try {
        await client.logout(token);
      } catch {
        /* idempotent */
      }
    }
  }, [client]);

  const beginEnrollment = useCallback(async () => {
    if (!memoryPreauthToken) {
      throw new PlatformAuthApiError(t('pages.mfa.sessionExpired', 'Your session has expired. Please sign in again.'), 401);
    }
    const result = await client.beginEnrollment(memoryPreauthToken);
    return { otpauthUrl: result.otpauthUrl, secret: result.secret };
  }, [client, t]);

  const confirmEnrollment = useCallback(
    async (code: string, deviceLabel?: string) => {
      setError(null);
      if (!memoryPreauthToken) {
        setStatus('unauthenticated');
        const message = t('pages.mfa.sessionExpired', 'Your session has expired. Please sign in again.');
        setError(message);
        throw new PlatformAuthApiError(message, 401);
      }
      try {
        const result = await client.confirmEnrollment(memoryPreauthToken, code, deviceLabel);
        memoryAccessToken = result.accessToken;
        memoryPreauthToken = null;
        setEnrollmentEmail(null);
        setRecoveryCodes(result.recoveryCodes);
        const me = await client.me(result.accessToken);
        setPrincipal(me);
        setStatus('authenticated');
      } catch (err) {
        setError(err instanceof PlatformAuthApiError ? err.message : t('pages.mfa.enroll.verifyError', 'Unable to verify code. Try again.'));
        throw err;
      }
    },
    [client, t],
  );

  const submitMfaChallenge = useCallback(
    async (code: string, deviceLabel?: string) => {
      setError(null);
      if (!memoryPreauthToken) {
        setStatus('unauthenticated');
        const message = t('pages.mfa.sessionExpired', 'Your session has expired. Please sign in again.');
        setError(message);
        throw new PlatformAuthApiError(message, 401);
      }
      try {
        const tokens = await client.mfaChallenge(memoryPreauthToken, code, deviceLabel);
        memoryAccessToken = tokens.accessToken;
        memoryPreauthToken = null;
        const me = await client.me(tokens.accessToken);
        setPrincipal(me);
        setStatus('authenticated');
      } catch (err) {
        setError(err instanceof PlatformAuthApiError ? err.message : t('pages.mfa.challenge.verifyError', 'Unable to verify code. Try again.'));
        throw err;
      }
    },
    [client, t],
  );

  const acknowledgeRecoveryCodes = useCallback(() => {
    setRecoveryCodes(null);
  }, []);

  const beginInvitedEnrollment = useCallback((preauthToken: string, email: string) => {
    memoryAccessToken = null;
    memoryPreauthToken = preauthToken;
    setPrincipal(null);
    setRecoveryCodes(null);
    setEnrollmentEmail(email);
    setError(null);
    setStatus('mfa_enrollment_required');
  }, []);

  const withAccessToken = useCallback(
    async <T,>(fn: (accessToken: string) => Promise<T>): Promise<T> => {
      const current = memoryAccessToken;
      if (!current) {
        try {
          const refreshed = await client.refresh();
          memoryAccessToken = refreshed.accessToken;
        } catch (err) {
          setStatus('unauthenticated');
          setPrincipal(null);
          throw err;
        }
      }
      try {
        return await fn(memoryAccessToken as string);
      } catch (err) {
        if (err instanceof PlatformAuthApiError && err.status === 401) {
          try {
            const refreshed = await client.refresh();
            memoryAccessToken = refreshed.accessToken;
          } catch (refreshErr) {
            memoryAccessToken = null;
            setStatus('unauthenticated');
            setPrincipal(null);
            throw refreshErr;
          }
          return await fn(memoryAccessToken as string);
        }
        throw err;
      }
    },
    [client],
  );

  const value = useMemo<PlatformAuthContextValue>(
    () => ({
      status,
      principal,
      error,
      enrollmentEmail,
      recoveryCodes,
      client,
      login,
      logout,
      beginEnrollment,
      confirmEnrollment,
      submitMfaChallenge,
      beginInvitedEnrollment,
      acknowledgeRecoveryCodes,
      clearError: () => setError(null),
      getAccessToken: () => memoryAccessToken,
      withAccessToken,
    }),
    [
      status,
      principal,
      error,
      enrollmentEmail,
      recoveryCodes,
      client,
      login,
      logout,
      beginEnrollment,
      confirmEnrollment,
      submitMfaChallenge,
      beginInvitedEnrollment,
      acknowledgeRecoveryCodes,
      withAccessToken,
    ],
  );

  return (
    <PlatformAuthContext.Provider value={value}>{children}</PlatformAuthContext.Provider>
  );
}

export function usePlatformAuth(): PlatformAuthContextValue {
  const ctx = useContext(PlatformAuthContext);
  if (!ctx) {
    throw new Error('usePlatformAuth must be used within PlatformAuthProvider');
  }
  return ctx;
}

/** Test helper — clears in-memory auth state between tests. */
export function __resetPlatformAccessTokenForTests(): void {
  memoryAccessToken = null;
  memoryPreauthToken = null;
}
