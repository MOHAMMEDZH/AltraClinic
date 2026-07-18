import { TenantContextService } from '../../../../infrastructure/tenant-context.service';

/**
 * Resolves the acting operator's UI locale (ar/en) for audit localization.
 *
 * The Super Admin Platform is the cross-tenant control plane, so a platform call
 * may legitimately carry NO tenant context. Locale is therefore best-effort:
 * when no context is available we record `null` rather than failing a privileged
 * operation on a missing header.
 */
export async function resolveOperatorLocale(tenantContext: TenantContextService): Promise<string | null> {
  try {
    const context = await tenantContext.resolve();
    return context?.locale ?? null;
  } catch {
    return null;
  }
}
