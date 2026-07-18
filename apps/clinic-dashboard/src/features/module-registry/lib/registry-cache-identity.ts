export interface RegistryCacheIdentity {
  tenantId: string;
  userId: string;
  rolesHash: string;
  catalogGeneration: number;
  entitlementVersion: string;
}

export function buildRolesHash(roles: string[]): string {
  return roles.slice().sort().join(',');
}

export function buildRegistryCacheKey(identity: RegistryCacheIdentity): string {
  return [
    identity.tenantId,
    identity.userId,
    identity.rolesHash,
    String(identity.catalogGeneration),
    identity.entitlementVersion,
  ].join(':');
}

export function buildPartialRegistryIdentity(input: {
  tenantId: string;
  userId: string;
  roles: string[];
}): Pick<RegistryCacheIdentity, 'tenantId' | 'userId' | 'rolesHash'> {
  return {
    tenantId: input.tenantId,
    userId: input.userId,
    rolesHash: buildRolesHash(input.roles),
  };
}
