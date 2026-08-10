import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  loadSuperAdminRuntimeConfig,
  validateSuperAdminRuntimeConfig,
  type SuperAdminRuntimeConfig,
} from '../../config/runtime-config';

const ConfigContext = createContext<SuperAdminRuntimeConfig | null>(null);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const value = useMemo(() => {
    const config = loadSuperAdminRuntimeConfig();
    const validation = validateSuperAdminRuntimeConfig(config);
    if (!validation.ok) {
      throw new Error(`Invalid Super Admin configuration: ${validation.errors.join('; ')}`);
    }
    return config;
  }, []);

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function useSuperAdminConfig(): SuperAdminRuntimeConfig {
  const ctx = useContext(ConfigContext);
  if (!ctx) {
    throw new Error('useSuperAdminConfig must be used within ConfigProvider');
  }
  return ctx;
}
