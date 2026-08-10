import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { usePortalConfig } from '../providers/ConfigProvider';

/** Requires local portal session tokens; redirects to login when missing. */
export function RequirePortalSession({ children }: { children: ReactNode }) {
  const { storage, config } = usePortalConfig();
  const location = useLocation();
  const token = storage.getItem('portal.accessToken');
  const tenantId = storage.getItem('portal.tenantId');

  if (!config.centerEnabled) {
    return <Navigate to="/" replace />;
  }
  if (!token || !tenantId) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

/** Appointments sub-flag gate (default OFF). */
export function RequireAppointmentsEnabled({ children }: { children: ReactNode }) {
  const { config } = usePortalConfig();
  if (!config.appointmentsEnabled) {
    return <Navigate to="/account" replace />;
  }
  return <>{children}</>;
}
