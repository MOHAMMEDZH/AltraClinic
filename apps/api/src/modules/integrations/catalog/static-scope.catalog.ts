/**
 * Phase 44a — static scope catalog (descriptions only; non-executable until 44d).
 */
import type { ScopeCatalogEntry } from '../domain/integrations-registration.contracts';
import {
  INTEGRATIONS_HIGH_RISK_SCOPES,
  INTEGRATIONS_SCOPE_CATALOG_IDS,
} from '../integrations.constants';

const DESCRIPTIONS: Record<
  (typeof INTEGRATIONS_SCOPE_CATALOG_IDS)[number],
  string
> = {
  'ops.read': 'Read non-PHI ops metadata',
  'patients.read': 'Read patient APIs',
  'patients.write': 'Mutate patients',
  'scheduling.read': 'Read appointments',
  'scheduling.write': 'Mutate appointments',
  'billing.read': 'Read invoices',
  'billing.write': 'Mutate invoices',
  'import_export.run': 'Trigger Import/Export jobs',
  'backup.read': 'List backup snapshot metadata',
  'webhooks.manage': 'Manage webhook subscriptions',
};

const HIGH_RISK = new Set<string>(INTEGRATIONS_HIGH_RISK_SCOPES);

export const STATIC_SCOPE_CATALOG: readonly ScopeCatalogEntry[] =
  INTEGRATIONS_SCOPE_CATALOG_IDS.map((scopeId) => ({
    scopeId,
    description: DESCRIPTIONS[scopeId],
    highRisk: HIGH_RISK.has(scopeId),
    executable: false as const,
  }));
