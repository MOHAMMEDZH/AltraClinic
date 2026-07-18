import { TenantSettingsVO } from './tenant-settings.vo';
import { TenantDomainVO } from './tenant-domain.vo';

export class Tenant {
  public readonly id: string;
  public readonly createdAt: Date;
  public updatedAt: Date | null = null;

  constructor(
    id: string,
    public name: string,
    public domain: TenantDomainVO | null = null,
    public settings: TenantSettingsVO = new TenantSettingsVO(),
    createdAt?: Date
  ) {
    this.id = id;
    this.createdAt = createdAt ?? new Date();
  }

  updateName(name: string) {
    if (!name?.trim()) throw new Error('Tenant name cannot be empty');
    this.name = name.trim();
    this.updatedAt = new Date();
  }

  updateSettings(s: TenantSettingsVO) {
    this.settings = s;
    this.updatedAt = new Date();
  }
}
