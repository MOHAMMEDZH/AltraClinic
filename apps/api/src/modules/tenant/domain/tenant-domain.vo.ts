export class TenantDomainVO {
  public readonly value: string;

  constructor(domain: string) {
    const normalized = domain.trim().toLowerCase();
    if (!normalized) throw new Error('Tenant domain cannot be empty');
    if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*$/.test(normalized)) {
      throw new Error('Invalid tenant domain');
    }
    this.value = normalized;
  }
}
