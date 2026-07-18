import { useMemo } from 'react';
import { DEFAULT_TENANT_ID } from '@/lib/api-client';
import { getStoredTenantId } from '@/lib/auth-storage';

export function useTenantId(): string {
  return useMemo(() => getStoredTenantId() ?? DEFAULT_TENANT_ID, []);
}

export function detectDeviceName(): string {
  if (typeof navigator === 'undefined') return 'clinic-dashboard-web';
  const ua = navigator.userAgent;
  if (/iPhone|iPad/i.test(ua)) return 'Safari on iOS';
  if (/Android/i.test(ua)) return 'Chrome on Android';
  if (/Edg\//i.test(ua)) return 'Edge';
  if (/Firefox/i.test(ua)) return 'Firefox';
  if (/Chrome/i.test(ua)) return 'Chrome';
  if (/Safari/i.test(ua)) return 'Safari';
  return 'clinic-dashboard-web';
}
