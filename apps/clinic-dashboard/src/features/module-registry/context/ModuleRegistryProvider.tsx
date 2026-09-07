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

import type { EffectiveModuleView } from '@booking/module-registry';

import {

  fetchModuleRegistryBootstrap,

  type ModuleRegistryBootstrapResponse,

} from '../api/module-registry-api';

import { useAuth } from '@/app/providers/AuthProvider';

import { clearModuleRegistryCaches } from '../lib/clear-registry-caches';

import {

  buildPartialRegistryIdentity,

  buildRegistryCacheKey,

} from '../lib/registry-cache-identity';

import {

  clearRegistryCache,

  readRegistryCache,

  registryCacheEtag,

  writeRegistryCache,

} from '../lib/registry-cache';



export interface ModuleRegistryContextValue {

  isLoading: boolean;

  isError: boolean;

  error: Error | null;

  snapshot: ModuleRegistryBootstrapResponse['snapshot'] | null;

  modules: EffectiveModuleView[];

  refresh: () => Promise<void>;

  getModule: (moduleId: string) => EffectiveModuleView | undefined;

}



const ModuleRegistryContext = createContext<ModuleRegistryContextValue | null>(null);



function identitySignature(tenantId: string, userId: string, rolesHash: string): string {

  return `${tenantId}:${userId}:${rolesHash}`;

}



export function ModuleRegistryProvider({ children }: { children: ReactNode }) {

  const { user, getValidAccessToken } = useAuth();

  const tenantId = user?.tenantId ?? null;

  const userId = user?.userId ?? null;

  const roles = user?.roles ?? [];

  const partialIdentity =

    tenantId && userId

      ? buildPartialRegistryIdentity({ tenantId, userId, roles })

      : null;



  const [isLoading, setIsLoading] = useState(true);

  const [isError, setIsError] = useState(false);

  const [error, setError] = useState<Error | null>(null);

  const [snapshot, setSnapshot] = useState<ModuleRegistryBootstrapResponse['snapshot'] | null>(null);

  const [modules, setModules] = useState<EffectiveModuleView[]>([]);

  const lastIdentityRef = useRef<string | null>(null);



  const load = useCallback(

    async (options?: { force?: boolean }) => {

      if (!partialIdentity) {

        setModules([]);

        setSnapshot(null);

        setIsLoading(false);

        setIsError(false);

        setError(null);

        return;

      }



      const signature = identitySignature(

        partialIdentity.tenantId,

        partialIdentity.userId,

        partialIdentity.rolesHash,

      );



      if (lastIdentityRef.current !== signature) {

        clearModuleRegistryCaches();

        lastIdentityRef.current = signature;

      }



      if (!options?.force) {

        const cached = readRegistryCache(partialIdentity);

        if (cached) {

          setSnapshot(cached.data.snapshot);

          setModules(cached.data.modules);

          setIsError(false);

          setError(null);

          setIsLoading(false);

          return;

        }

      }



      setIsLoading(true);

      // Keep prior isError/error until a successful bootstrap so reporting stays on
      // static-fallback during retries instead of flashing the restricted empty catalog.

      try {
        const token = await getValidAccessToken();
        if (!token) {
          throw new Error('Module registry bootstrap requires an authenticated session');
        }
        const data = await fetchModuleRegistryBootstrap({
          token,
          tenantId: partialIdentity.tenantId,
        });

        const entitlementVersion = data.snapshot.entitlementVersion;

        const cacheIdentity = {

          ...partialIdentity,

          catalogGeneration: data.snapshot.catalogGeneration,

          entitlementVersion,

        };

        const etag = buildRegistryCacheKey(cacheIdentity);

        if (registryCacheEtag(partialIdentity) !== etag) {

          writeRegistryCache(cacheIdentity, data, etag);

        }

        setSnapshot(data.snapshot);

        setModules(data.modules);

        setIsError(false);

        setError(null);

      } catch (err) {

        setIsError(true);

        setError(err instanceof Error ? err : new Error('Module registry bootstrap failed'));

        setModules([]);

        setSnapshot(null);

        clearRegistryCache();

      } finally {

        setIsLoading(false);

      }

    },

    [getValidAccessToken, partialIdentity],

  );



  useEffect(() => {

    void load();

  }, [load]);



  const getModule = useCallback(

    (moduleId: string) => modules.find((m) => m.moduleId === moduleId),

    [modules],

  );



  const refresh = useCallback(async () => {

    clearModuleRegistryCaches();

    await load({ force: true });

  }, [load]);



  const value = useMemo<ModuleRegistryContextValue>(

    () => ({

      isLoading,

      isError,

      error,

      snapshot,

      modules,

      refresh,

      getModule,

    }),

    [isLoading, isError, error, snapshot, modules, refresh, getModule],

  );



  return <ModuleRegistryContext.Provider value={value}>{children}</ModuleRegistryContext.Provider>;

}



export function useModuleRegistry(): ModuleRegistryContextValue {

  const ctx = useContext(ModuleRegistryContext);

  if (!ctx) {

    throw new Error('useModuleRegistry must be used within ModuleRegistryProvider');

  }

  return ctx;

}



/** Optional hook for future opt-in surfaces — returns null when provider is not mounted. */

export function useOptionalModuleRegistry(): ModuleRegistryContextValue | null {

  return useContext(ModuleRegistryContext);

}


