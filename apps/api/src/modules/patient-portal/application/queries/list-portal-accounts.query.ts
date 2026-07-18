import { PortalAccountStatus } from '../../domain/value-objects/portal-account-status';

export class ListPortalAccountsQuery {
  constructor(
    public readonly branchId: string | null,
    public readonly status: PortalAccountStatus | null,
    public readonly patientId: string | null,
    public readonly limit: number,
    public readonly offset: number,
    public readonly actorRoles: string[],
  ) {}
}
