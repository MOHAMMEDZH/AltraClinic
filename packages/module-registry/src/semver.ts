/** Parse semver x.y.z into numeric tuple; non-numeric suffix ignored for comparison. */
export function parseSemver(version: string): [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return 0;
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  }
  return 0;
}

/** Returns true when `version` >= `minimum` (major.minor.patch). */
export function satisfiesMinVersion(version: string, minimum: string): boolean {
  return compareSemver(version, minimum) >= 0;
}

/** Basic semver range: ^x.y.z or >=x.y.z or exact x.y.z */
export function satisfiesRange(version: string, range: string): boolean {
  const trimmed = range.trim();
  if (trimmed.startsWith('^')) {
    const base = parseSemver(trimmed.slice(1));
    const ver = parseSemver(version);
    if (!base || !ver) return false;
    return ver[0] === base[0] && compareSemver(version, trimmed.slice(1)) >= 0;
  }
  if (trimmed.startsWith('>=')) {
    return compareSemver(version, trimmed.slice(2)) >= 0;
  }
  return compareSemver(version, trimmed) === 0;
}
