import { useCallback, useEffect, useRef, useState } from 'react';
import { usePlatformAuth } from '../auth/PlatformAuthProvider';
import { PlatformAuthApiError } from '../auth/platform-auth-api';
import type { TenantDirectoryQuery, TenantDirectoryResponse } from './types';

export function useTenantDirectoryQuery(initial: TenantDirectoryQuery = {}) {
  const { client, withAccessToken } = usePlatformAuth();
  const [query, setQuery] = useState<TenantDirectoryQuery>({ page: 1, pageSize: 25, ...initial });
  const [data, setData] = useState<TenantDirectoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    try {
      const result = await withAccessToken((token) => client.listPlatformTenants(token, query));
      if (seq !== requestSeq.current) return;
      setData(result);
      setError(null);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setError(err instanceof PlatformAuthApiError ? err.message : 'Unable to load tenants.');
      setData(null);
    } finally {
      if (seq === requestSeq.current) {
        setLoading(false);
      }
    }
  }, [client, query, withAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, query, setQuery, reload: load };
}
