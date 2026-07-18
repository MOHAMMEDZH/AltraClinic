import type {
  BranchConfigurationSnapshot,
  BranchDetailSnapshot,
  BranchSettingsReadModel,
  BranchSummarySnapshot,
  BranchWhiteLabelConfig,
} from './branch-types';

export function emptyConfiguration(overrides?: Partial<BranchConfigurationSnapshot>): BranchConfigurationSnapshot {
  return {
    identity: {
      displayName: null,
      nameAr: null,
      code: null,
      isActive: true,
      overriddenFields: [],
      ...overrides?.identity,
    },
    address: {
      city: null,
      address: null,
      phone: null,
      timezone: null,
      overriddenFields: [],
      ...overrides?.address,
    },
    clinical: {
      hoursConfigured: false,
      defaultsConfigured: false,
      queueConfigured: false,
      overriddenFields: [],
      ...overrides?.clinical,
    },
    financial: {
      sequencesConfigured: false,
      taxConfigured: false,
      overriddenFields: [],
      ...overrides?.financial,
    },
    inventory: {
      warehousesConfigured: false,
      transfersConfigured: false,
      overriddenFields: [],
      ...overrides?.inventory,
    },
    reporting: {
      defaultBranchFilter: null,
      crossBranchAllowed: false,
      overriddenFields: [],
      ...overrides?.reporting,
    },
    analytics: {
      defaultBranchFilter: null,
      crossBranchAllowed: false,
      overriddenFields: [],
      ...overrides?.analytics,
    },
    whiteLabel: {
      displayName: null,
      logoStorageKey: null,
      accentColor: null,
      emailSenderName: null,
      pdfHeaderEnabled: false,
      overriddenFields: [],
      ...overrides?.whiteLabel,
    },
  };
}

/** Narrow-only configuration merge from tenant read model + active branch detail — no widen. */
export function mergeBranchConfiguration(input: {
  readModel: BranchSettingsReadModel;
  activeBranch: BranchDetailSnapshot | null;
  crossBranchAllowed: boolean;
}): BranchConfigurationSnapshot {
  const { readModel, activeBranch, crossBranchAllowed } = input;
  const displayName =
    activeBranch?.name ??
    (typeof readModel.clinicProfile.displayName === 'string'
      ? readModel.clinicProfile.displayName
      : readModel.tenantName);

  return emptyConfiguration({
    identity: {
      displayName,
      nameAr: activeBranch?.nameAr ?? null,
      code: null,
      isActive: activeBranch?.isActive ?? true,
      overriddenFields: activeBranch ? ['displayName', 'nameAr', 'isActive'] : [],
    },
    address: {
      city: activeBranch?.city ?? null,
      address: activeBranch?.address ?? null,
      phone: activeBranch?.phone ?? null,
      timezone: readModel.timezone,
      overriddenFields: activeBranch ? ['city', 'address', 'phone'] : [],
    },
    reporting: {
      defaultBranchFilter: activeBranch?.id ?? null,
      crossBranchAllowed,
      overriddenFields: [],
    },
    analytics: {
      defaultBranchFilter: activeBranch?.id ?? null,
      crossBranchAllowed,
      overriddenFields: [],
    },
    whiteLabel: {
      displayName: activeBranch?.name ?? null,
      logoStorageKey: null,
      accentColor: null,
      emailSenderName: activeBranch?.name ?? null,
      pdfHeaderEnabled: Boolean(activeBranch),
      overriddenFields: activeBranch ? ['displayName', 'emailSenderName'] : [],
    },
  });
}

export function projectBranchWhiteLabelSlice(
  configuration: BranchConfigurationSnapshot,
): BranchWhiteLabelConfig {
  return { ...configuration.whiteLabel };
}

export function hashBranchSettingsVersion(parts: {
  tenantId: string;
  activeBranchId: string | null;
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  branchCount: number;
}): string {
  return [
    parts.tenantId,
    parts.activeBranchId ?? 'none',
    parts.catalogGeneration ?? 'none',
    parts.entitlementVersion ?? 'none',
    parts.branchCount,
  ].join('|');
}

export function hashStaticCatalog(entries: { extensionId: string }[]): string {
  return `branch-catalog:${entries.length}:${entries.map((e) => e.extensionId).join(',')}`;
}

export function toBranchDetail(
  summary: BranchSummarySnapshot | undefined,
  fallbackId: string | null,
): BranchDetailSnapshot | null {
  if (summary) {
    return {
      id: summary.id,
      name: summary.name,
      nameAr: summary.nameAr,
      isActive: summary.isActive,
      city: summary.city ?? null,
      phone: null,
      address: null,
    };
  }
  if (!fallbackId) return null;
  return {
    id: fallbackId,
    name: 'Branch',
    nameAr: null,
    isActive: true,
    city: null,
    phone: null,
    address: null,
  };
}
