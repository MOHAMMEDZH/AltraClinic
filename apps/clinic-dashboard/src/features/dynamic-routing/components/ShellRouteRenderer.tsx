import { useRoutes } from 'react-router-dom';
import { AuthSpinner } from '@/features/auth/components/AuthSpinner';
import { useDynamicRoutes } from '../context/DynamicRouteProvider';

/** Renders registry-filtered shell routes inside LicensedApplicationShell Outlet. */
export function ShellRouteRenderer() {
  const { shellSnapshot, isLoading } = useDynamicRoutes();
  const element = useRoutes(shellSnapshot.routeObjects);

  if (isLoading && !element) {
    return <AuthSpinner />;
  }

  return element;
}

/** Renders kiosk routes (outside main shell). */
export function KioskRouteRenderer() {
  const { kioskSnapshot } = useDynamicRoutes();
  return useRoutes(kioskSnapshot.routeObjects);
}
