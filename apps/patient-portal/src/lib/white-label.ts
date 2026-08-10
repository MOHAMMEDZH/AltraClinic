/**
 * Phase 46a/46e — White Label branding tokens (consumer only).
 */

export interface PortalBrandTokens {
  clinicName: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  fontFamily: string | null;
  portalName: string;
  source?: 'tenant' | 'default';
}

export const DEFAULT_PORTAL_BRAND: PortalBrandTokens = {
  clinicName: 'Patient Portal',
  primaryColor: '#0f766e',
  secondaryColor: '#134e4a',
  logoUrl: null,
  faviconUrl: null,
  fontFamily: null,
  portalName: 'Patient Portal',
  source: 'default',
};

export function mergePortalBrand(
  partial?: Partial<PortalBrandTokens> | null,
): PortalBrandTokens {
  return {
    ...DEFAULT_PORTAL_BRAND,
    ...(partial ?? {}),
    clinicName: partial?.clinicName?.trim() || DEFAULT_PORTAL_BRAND.clinicName,
    primaryColor: partial?.primaryColor?.trim() || DEFAULT_PORTAL_BRAND.primaryColor,
    secondaryColor: partial?.secondaryColor?.trim() || DEFAULT_PORTAL_BRAND.secondaryColor,
    logoUrl: partial?.logoUrl ?? null,
    faviconUrl: partial?.faviconUrl ?? null,
    fontFamily: partial?.fontFamily?.trim() || null,
    portalName:
      partial?.portalName?.trim() ||
      partial?.clinicName?.trim() ||
      DEFAULT_PORTAL_BRAND.portalName,
    source: partial?.source ?? DEFAULT_PORTAL_BRAND.source,
  };
}

function ensureFaviconLink(href: string | null): void {
  const existing = document.querySelector<HTMLLinkElement>("link[rel='icon'][data-portal-favicon]");
  if (!href) {
    existing?.remove();
    return;
  }
  const link = existing ?? document.createElement('link');
  link.rel = 'icon';
  link.href = href;
  link.dataset.portalFavicon = 'true';
  if (!existing) document.head.appendChild(link);
}

export function applyPortalBrandToDocument(
  brand: PortalBrandTokens,
  root: HTMLElement = document.documentElement,
): void {
  root.style.setProperty('--portal-color-primary', brand.primaryColor);
  root.style.setProperty('--portal-color-secondary', brand.secondaryColor);
  if (brand.fontFamily) {
    root.style.setProperty('--portal-font', brand.fontFamily);
  }
  root.dataset.portalBrand = brand.portalName || brand.clinicName;
  ensureFaviconLink(brand.faviconUrl);
  if (typeof document !== 'undefined' && brand.portalName) {
    document.title = brand.portalName;
  }
}

/**
 * Asset loading abstraction — returns null on failure (degrade safely).
 */
export async function loadPortalBrandAsset(
  url: string | null | undefined,
): Promise<string | null> {
  if (!url?.trim()) return null;
  try {
    const response = await fetch(url, { method: 'HEAD', mode: 'cors' });
    return response.ok ? url : null;
  } catch {
    return null;
  }
}
