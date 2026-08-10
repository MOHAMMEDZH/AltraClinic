import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { usePlatformAuth } from './PlatformAuthProvider';
import { hasPermission } from './permissions';
import { evaluatePermissionPolicy, type PermissionPolicy } from '../routing/permission-policy';

function sanitizeInternalRedirect(path: string | null): string {
  if (!path) return '/';
  if (!path.startsWith('/') || path.startsWith('//')) return '/';
  if (path.startsWith('/login')) return '/';
  try {
    const url = new URL(path, 'http://sa.local');
    if (url.origin !== 'http://sa.local') return '/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
}

function CheckingSession() {
  return (
    <div className="sa-loading" role="status" aria-live="polite">
      Checking session…
    </div>
  );
}

export function RequirePlatformAuth({ children }: { children: ReactNode }) {
  const { status } = usePlatformAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <CheckingSession />;
  }

  if (status === 'mfa_enrollment_required') {
    return <Navigate to="/mfa/enroll" replace />;
  }

  if (status === 'mfa_challenge_required') {
    return <Navigate to="/mfa/challenge" replace />;
  }

  if (status !== 'authenticated') {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return <>{children}</>;
}

/** Applies an RBAC check after the normal session and MFA gates. */
export function RequirePermission({
  permission,
  children,
}: {
  permission: string;
  children: ReactNode;
}) {
  const { status, principal } = usePlatformAuth();
  if (status === 'loading') return <CheckingSession />;
  if (status === 'mfa_enrollment_required') return <Navigate to="/mfa/enroll" replace />;
  if (status === 'mfa_challenge_required') return <Navigate to="/mfa/challenge" replace />;
  if (status !== 'authenticated') return <RequirePlatformAuth>{children}</RequirePlatformAuth>;
  if (!hasPermission(principal, permission)) return <Navigate to="/unauthorized" replace />;
  return <>{children}</>;
}

/**
 * Generalized permission-policy gate (Step 09). Used by the route registry
 * to enforce `public` / `authenticated` / `permission` / `anyOf` / `allOf`
 * policies uniformly. Never evaluates role names.
 */
export function RequirePermissionPolicy({
  policy,
  children,
}: {
  policy: PermissionPolicy;
  children: ReactNode;
}) {
  const { status, principal } = usePlatformAuth();
  if (policy.type === 'public') return <>{children}</>;
  if (status === 'loading') return <CheckingSession />;
  if (status === 'mfa_enrollment_required') return <Navigate to="/mfa/enroll" replace />;
  if (status === 'mfa_challenge_required') return <Navigate to="/mfa/challenge" replace />;
  if (status !== 'authenticated') return <RequirePlatformAuth>{children}</RequirePlatformAuth>;
  if (!evaluatePermissionPolicy(principal, policy)) return <Navigate to="/unauthorized" replace />;
  return <>{children}</>;
}

export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const { status } = usePlatformAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <CheckingSession />;
  }

  if (status === 'mfa_enrollment_required') {
    return <Navigate to="/mfa/enroll" replace />;
  }

  if (status === 'mfa_challenge_required') {
    return <Navigate to="/mfa/challenge" replace />;
  }

  if (status === 'authenticated') {
    const params = new URLSearchParams(location.search);
    const dest = sanitizeInternalRedirect(params.get('next'));
    return <Navigate to={dest} replace />;
  }

  return <>{children}</>;
}

/**
 * Guards `/mfa/enroll`. Stays mounted through the brief window right after a
 * successful enrollment confirmation so the one-time recovery codes panel
 * (rendered by MfaEnrollPage while `recoveryCodes` is still set) can show.
 */
export function RequireMfaEnrollment({ children }: { children: ReactNode }) {
  const { status, recoveryCodes } = usePlatformAuth();

  if (status === 'loading') {
    return <CheckingSession />;
  }
  if (status === 'mfa_enrollment_required') {
    return <>{children}</>;
  }
  if (status === 'authenticated' && recoveryCodes) {
    return <>{children}</>;
  }
  if (status === 'authenticated') {
    return <Navigate to="/" replace />;
  }
  if (status === 'mfa_challenge_required') {
    return <Navigate to="/mfa/challenge" replace />;
  }
  return <Navigate to="/login" replace />;
}

export function RequireMfaChallenge({ children }: { children: ReactNode }) {
  const { status } = usePlatformAuth();

  if (status === 'loading') {
    return <CheckingSession />;
  }
  if (status === 'mfa_challenge_required') {
    return <>{children}</>;
  }
  if (status === 'authenticated') {
    return <Navigate to="/" replace />;
  }
  if (status === 'mfa_enrollment_required') {
    return <Navigate to="/mfa/enroll" replace />;
  }
  return <Navigate to="/login" replace />;
}

export { sanitizeInternalRedirect };
