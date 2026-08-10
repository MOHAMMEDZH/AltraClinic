import { useCallback, useEffect, useState } from 'react';
import { usePlatformAuth } from '../auth/PlatformAuthProvider';
import { PlatformAuthApiError } from '../auth/platform-auth-api';
import type { TenantDetailResponse } from './types';

export function useTenantDetailQuery(tenantId: string) {
  const { client, withAccessToken } = usePlatformAuth();
  const [data, setData] = useState<TenantDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const result = await withAccessToken((token) => client.getPlatformTenantDetail(token, tenantId));
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof PlatformAuthApiError ? err.message : 'Unable to load tenant detail.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [client, tenantId, withAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, reload: load };
}
