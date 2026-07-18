/** Mirrors server buildEntitlementVersion for client-side cache invalidation. */
export function buildEntitlementVersion(input: {
  licenseStatus: string;
  canWrite: boolean;
  canMutate: boolean;
  licenseModules: Record<string, string>;
  moduleFlags?: Record<string, boolean | undefined>;
}): string {
  const moduleFlags = input.moduleFlags ?? {};
  const moduleParts = Object.keys(input.licenseModules)
    .sort()
    .map((key) => `${key}:${input.licenseModules[key]}`);
  const flagParts = Object.keys(moduleFlags)
    .sort()
    .map((key) => `${key}:${String(moduleFlags[key])}`);
  return `${input.licenseStatus}|w:${input.canWrite}|m:${input.canMutate}|lm:${moduleParts.join(',')}|mf:${flagParts.join(',')}`;
}
