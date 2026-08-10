import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  loadPatientPortalRuntimeConfig,
  validatePatientPortalRuntimeConfig,
  type PatientPortalRuntimeConfig,
} from '../../config/runtime-config';
import { createPortalHttpClient, type PortalHttpClient } from '../../lib/api-client';
import { createSecureStorage, type SecureStorage } from '../../lib/secure-storage';

interface ConfigContextValue {
  config: PatientPortalRuntimeConfig;
  configValid: boolean;
  configErrors: string[];
  api: PortalHttpClient;
  storage: SecureStorage;
}

const ConfigContext = createContext<ConfigContextValue | null>(null);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const value = useMemo(() => {
    const config = loadPatientPortalRuntimeConfig();
    const validation = validatePatientPortalRuntimeConfig(config);
    return {
      config,
      configValid: validation.ok,
      configErrors: validation.ok ? [] : validation.errors,
      api: createPortalHttpClient(config.apiBaseUrl),
      storage: createSecureStorage(),
    };
  }, []);

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function usePortalConfig(): ConfigContextValue {
  const ctx = useContext(ConfigContext);
  if (!ctx) {
    throw new Error('usePortalConfig must be used within ConfigProvider');
  }
  return ctx;
}
