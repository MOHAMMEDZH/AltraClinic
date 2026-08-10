import { useCallback, useEffect, useRef, useState } from 'react';

import { useI18n } from '@booking/i18n/react';

import { usePlatformAuth } from '../auth/PlatformAuthProvider';

import { PlatformAuthApiError } from '../auth/platform-auth-api';

import type { PlatformDashboard } from './types';



export interface DashboardQueryState {

  data: PlatformDashboard | null;

  loading: boolean;

  refreshing: boolean;

  error: string | null;

  /** Manual refresh — bypasses the server cache (rate-limited per user). */

  refresh: () => Promise<void>;

  reload: () => Promise<void>;

}



/**

 * Release 47 Step 10 — loads the read-only platform dashboard. Never persists

 * anything; the access token stays in memory inside PlatformAuthProvider.

 */

export function useDashboardQuery(): DashboardQueryState {

  const { t } = useI18n();

  const { client, withAccessToken } = usePlatformAuth();

  const [data, setData] = useState<PlatformDashboard | null>(null);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const mounted = useRef(true);

  const refreshInFlight = useRef(false);



  useEffect(() => {

    mounted.current = true;

    return () => {

      mounted.current = false;

    };

  }, []);



  const load = useCallback(async () => {

    setLoading(true);

    try {

      const result = await withAccessToken((token) => client.getPlatformDashboard(token));

      if (!mounted.current) return;

      setData(result);

      setError(null);

    } catch (err) {

      if (!mounted.current) return;

      setError(

        err instanceof PlatformAuthApiError

          ? err.message

          : t('dashboard.loadError', 'Unable to load the dashboard.'),

      );

    } finally {

      if (mounted.current) setLoading(false);

    }

  }, [client, withAccessToken, t]);



  const refresh = useCallback(async () => {

    if (refreshInFlight.current) return;

    refreshInFlight.current = true;

    setRefreshing(true);

    try {

      const result = await withAccessToken((token) => client.refreshPlatformDashboard(token));

      if (!mounted.current) return;

      setData(result);

      setError(null);

    } catch (err) {

      if (!mounted.current) return;

      setError(

        err instanceof PlatformAuthApiError

          ? err.message

          : t('dashboard.loadError', 'Unable to load the dashboard.'),

      );

    } finally {

      refreshInFlight.current = false;

      if (mounted.current) setRefreshing(false);

    }

  }, [client, withAccessToken, t]);



  useEffect(() => {

    void load();

  }, [load]);



  return {

    data,

    loading,

    refreshing,

    error,

    refresh,

    reload: load,

  };

}


