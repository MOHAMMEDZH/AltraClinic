import { useRoutes } from 'react-router-dom';
import { AuthSpinner } from '@/features/auth/components/AuthSpinner';
import { useDynamicRoutes } from '../context/DynamicRouteProvider';

/** Renders registry-filtered shell routes inside LicensedApplicationShell Outlet. */
export function ShellRouteRenderer() {
  const { shellSnapshot } = useDynamicRoutes();
  const element = useRoutes(shellSnapshot.routeObjects);

  // Never return null into <main> — empty main is indistinguishable from a hang in e2e.
  if (!element) {
    return <AuthSpinner />;
  }

  return element;
}

/** Renders kiosk routes (outside main shell). */
export function KioskRouteRenderer() {
  const { kioskSnapshot } = useDynamicRoutes();
  return useRoutes(kioskSnapshot.routeObjects);
}
