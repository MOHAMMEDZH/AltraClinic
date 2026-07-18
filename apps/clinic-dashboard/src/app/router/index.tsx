import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { LicensedApplicationShell } from '@/layouts/LicensedApplicationShell';
import { LoginPage } from '@/features/auth/LoginPage';
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage';
import { MfaVerificationPage } from '@/features/auth/MfaVerificationPage';
import { VerifyEmailPage } from '@/features/auth/VerifyEmailPage';
import { RegistryRouteHost } from '@/features/dynamic-routing/components/RegistryRouteHost';
import { ShellRoutePlaceholder } from '@/features/dynamic-routing/components/ShellRoutePlaceholder';
import {
  STATIC_ROUTE_CATALOG,
  collectKioskRoutes,
  collectShellRoutes,
} from '@/features/dynamic-routing/lib/static-route-catalog';
import { buildStaticRouteSnapshot } from '@/features/dynamic-routing/lib/route-tree-builder';
import { isRegistryRoutingEnabled } from '@/features/dynamic-routing/lib/static-route-flags';
import { GuestRoute, ProtectedRoute } from './guards';

const staticShellRoutes = buildStaticRouteSnapshot(collectShellRoutes(STATIC_ROUTE_CATALOG)).routeObjects;
const staticKioskRoutes = buildStaticRouteSnapshot(collectKioskRoutes(STATIC_ROUTE_CATALOG)).routeObjects;

function buildProtectedChildren(): RouteObject[] {
  const useRegistryRoutes = isRegistryRoutingEnabled();
  const shellChildren: RouteObject[] = useRegistryRoutes
    ? [{ path: '*', element: <ShellRoutePlaceholder /> }]
    : staticShellRoutes;

  return [
    ...staticKioskRoutes.map((route) => ({
      ...route,
      path: route.path ?? 'queue/display',
    })),
    {
      element: <LicensedApplicationShell />,
      children: shellChildren,
    },
  ];
}

export const router = createBrowserRouter([
  {
    element: <GuestRoute />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
      { path: '/verify-email', element: <VerifyEmailPage /> },
    ],
  },
  { path: '/mfa', element: <MfaVerificationPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <RegistryRouteHost />,
        children: buildProtectedChildren(),
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

/** Exposed for parity tests — static shell route paths (rollback baseline). */
export function getStaticShellRouteObjects(): RouteObject[] {
  return staticShellRoutes;
}
