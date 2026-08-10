import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  applyPortalBrandToDocument,
  mergePortalBrand,
  type PortalBrandTokens,
} from '../../lib/white-label';
import { usePortalConfig } from './ConfigProvider';

interface ThemeContextValue {
  brand: PortalBrandTokens;
  setBrand: (partial: Partial<PortalBrandTokens>) => void;
  brandingLoaded: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
  initialBrand,
}: {
  children: ReactNode;
  initialBrand?: Partial<PortalBrandTokens>;
}) {
  const { api, storage, config } = usePortalConfig();
  const [brand, setBrandState] = useState(() => mergePortalBrand(initialBrand));
  const [brandingLoaded, setBrandingLoaded] = useState(false);

  useEffect(() => {
    applyPortalBrandToDocument(brand);
  }, [brand]);

  useEffect(() => {
    if (!config.centerEnabled) {
      setBrandingLoaded(true);
      return;
    }
    let cancelled = false;
    const tenantId = storage.getItem('portal.tenantId') ?? undefined;
    void api
      .request<PortalBrandTokens>('/patient-portal/branding', { tenantId })
      .then((snapshot) => {
        if (cancelled) return;
        setBrandState(mergePortalBrand(snapshot));
      })
      .catch(() => {
        /* graceful fallback to defaults */
      })
      .finally(() => {
        if (!cancelled) setBrandingLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [api, config.centerEnabled, storage]);

  const value = useMemo(
    () => ({
      brand,
      brandingLoaded,
      setBrand: (partial: Partial<PortalBrandTokens>) => {
        setBrandState((prev) => mergePortalBrand({ ...prev, ...partial }));
      },
    }),
    [brand, brandingLoaded],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function usePortalTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('usePortalTheme must be used within ThemeProvider');
  }
  return ctx;
}
