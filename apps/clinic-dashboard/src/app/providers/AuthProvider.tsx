import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  fetchMe,
  loginRequest,
  logoutRequest,
  refreshRequest,
  verifyMfaRequest,
  type LoginPayload,
  type MeResponse,
} from '@/lib/auth-api';
import {
  clearMfaChallenge,
  persistDeviceTrust,
  clearSession,
  getAccessToken,
  getMfaChallenge,
  getRefreshToken,
  getStoredTenantId,
  isAccessTokenExpired,
  persistMfaChallenge,
  persistSession,
  setStoredTenantId,
  type AuthSession,
} from '@/lib/auth-storage';
import { clearModuleRegistryCaches } from '@/features/module-registry/lib/clear-registry-caches';

export type LoginOutcome = 'authenticated' | 'mfa_required';

interface AuthContextValue {
  user: MeResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<LoginOutcome>;
  completeMfa: (code: string, options?: { trustDevice?: boolean }) => Promise<void>;
  logout: () => Promise<void>;
  getValidAccessToken: () => Promise<string | null>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const sessionRef = useRef<AuthSession | null>(null);
  /** Shared mutex: Strict Mode + parallel getValidAccessToken must not double-rotate. */
  const refreshInFlightRef = useRef<Promise<AuthSession | null> | null>(null);

  const rotateSession = useCallback(async (): Promise<AuthSession | null> => {
    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }

    const run = (async (): Promise<AuthSession | null> => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) return null;

      try {
        const session = await refreshRequest(refreshToken);
        const tenantId = getStoredTenantId();
        if (tenantId) session.tenantId = tenantId;
        sessionRef.current = session;
        persistSession(session);
        return session;
      } catch {
        // Only clear when this attempt still owns the stored refresh token.
        // A racing twin may have already rotated it successfully.
        if (getRefreshToken() === refreshToken) {
          clearModuleRegistryCaches();
          clearSession();
          sessionRef.current = null;
        }
        return null;
      }
    })();

    refreshInFlightRef.current = run;
    try {
      return await run;
    } finally {
      if (refreshInFlightRef.current === run) {
        refreshInFlightRef.current = null;
      }
    }
  }, []);

  const bootstrap = useCallback(async () => {
    setIsLoading(true);
    try {
      let session = await rotateSession();
      // A racing rotator may have won with a newer token while this attempt failed;
      // retry once against whatever is now stored before treating as logged out.
      if (!session && getRefreshToken()) {
        session = await rotateSession();
      }
      if (!session) {
        setUser(null);
        return;
      }
      const me = await fetchMe(session.accessToken);
      setUser(me);
    } catch {
      if (!sessionRef.current) {
        clearModuleRegistryCaches();
        clearSession();
        setUser(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, [rotateSession]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const getValidAccessToken = useCallback(async (): Promise<string | null> => {
    const current = sessionRef.current;
    const token = getAccessToken();

    if (current && token && !isAccessTokenExpired(current.obtainedAt, current.accessExpiresIn)) {
      return token;
    }

    const session = await rotateSession();
    if (!session) {
      setUser(null);
      return null;
    }
    return session.accessToken;
  }, [rotateSession]);

  const refreshUser = useCallback(async () => {
    const token = await getValidAccessToken();
    if (!token) return;
    clearModuleRegistryCaches();
    const me = await fetchMe(token);
    setUser(me);
  }, [getValidAccessToken]);

  const login = useCallback(async (payload: LoginPayload): Promise<LoginOutcome> => {
    const result = await loginRequest(payload);
    if (result.status === 'mfa_required') {
      persistMfaChallenge({
        mfaChallengeToken: result.mfaChallengeToken,
        tenantId: result.tenantId,
        expiresAt: Date.now() + result.mfaExpiresIn * 1000,
      });
      setStoredTenantId(payload.tenantId);
      return 'mfa_required';
    }

    sessionRef.current = result.session;
    persistSession(result.session);
    setStoredTenantId(payload.tenantId);
    clearMfaChallenge();
    clearModuleRegistryCaches();
    const me = await fetchMe(result.session.accessToken);
    setUser(me);
    return 'authenticated';
  }, []);

  const completeMfa = useCallback(async (code: string, options?: { trustDevice?: boolean }) => {
    const challenge = getMfaChallenge();
    if (!challenge) throw new Error('MFA challenge expired');

    const result = await verifyMfaRequest({
      mfaChallengeToken: challenge.mfaChallengeToken,
      code,
      tenantId: challenge.tenantId,
      trustDevice: options?.trustDevice,
    });

    sessionRef.current = result.session;
    persistSession(result.session);
    clearMfaChallenge();
    clearModuleRegistryCaches();
    if (result.deviceTrust) {
      persistDeviceTrust({
        token: result.deviceTrust.token,
        tenantId: challenge.tenantId,
        expiresAt: result.deviceTrust.expiresAt,
      });
    }
    const me = await fetchMe(result.session.accessToken);
    setUser(me);
  }, []);

  const logout = useCallback(async () => {
    const token = getAccessToken();
    if (token) {
      try {
        await logoutRequest(token);
      } catch {
        /* best effort */
      }
    }
    clearModuleRegistryCaches();
    clearSession();
    sessionRef.current = null;
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      completeMfa,
      logout,
      getValidAccessToken,
      refreshUser,
    }),
    [user, isLoading, login, completeMfa, logout, getValidAccessToken, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
