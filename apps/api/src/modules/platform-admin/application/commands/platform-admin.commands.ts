import { PrivilegedAccessScope } from '../../domain/value-objects/privileged-access-scope';

export class ProvisionPlatformTenantCommand {
  constructor(
    public readonly tenantId: string,
    public readonly displayName: string,
    public readonly region: string,
    public readonly plan: string,
    public readonly actorId: string,
    public readonly actorRoles: string[],
    public readonly correlationId: string | null,
  ) {}
}

export class ActivatePlatformTenantCommand {
  constructor(
    public readonly platformTenantId: string,
    public readonly actorId: string,
    public readonly actorRoles: string[],
    public readonly correlationId: string | null,
  ) {}
}

export class SuspendPlatformTenantCommand {
  constructor(
    public readonly platformTenantId: string,
    public readonly reason: string,
    public readonly actorId: string,
    public readonly actorRoles: string[],
    public readonly correlationId: string | null,
  ) {}
}

export class ResumePlatformTenantCommand {
  constructor(
    public readonly platformTenantId: string,
    public readonly actorId: string,
    public readonly actorRoles: string[],
    public readonly correlationId: string | null,
  ) {}
}

export class ArchivePlatformTenantCommand {
  constructor(
    public readonly platformTenantId: string,
    public readonly reason: string,
    public readonly actorId: string,
    public readonly actorRoles: string[],
    public readonly correlationId: string | null,
  ) {}
}

export class ChangePlatformTenantPlanCommand {
  constructor(
    public readonly platformTenantId: string,
    public readonly plan: string,
    public readonly actorId: string,
    public readonly actorRoles: string[],
    public readonly correlationId: string | null,
  ) {}
}

export class RequestPrivilegedAccessCommand {
  constructor(
    public readonly platformTenantId: string,
    public readonly adminName: string,
    public readonly scopes: PrivilegedAccessScope[],
    public readonly justification: string,
    public readonly expiresAt: string,
    public readonly breakGlass: boolean,
    public readonly actorId: string,
    public readonly actorRoles: string[],
    public readonly correlationId: string | null,
  ) {}
}

export class ApprovePrivilegedAccessCommand {
  constructor(
    public readonly platformTenantId: string,
    public readonly grantId: string,
    public readonly actorId: string,
    public readonly actorRoles: string[],
    public readonly correlationId: string | null,
  ) {}
}

export class RejectPrivilegedAccessCommand {
  constructor(
    public readonly platformTenantId: string,
    public readonly grantId: string,
    public readonly reason: string | null,
    public readonly actorId: string,
    public readonly actorRoles: string[],
    public readonly correlationId: string | null,
  ) {}
}

export class RevokePrivilegedAccessCommand {
  constructor(
    public readonly platformTenantId: string,
    public readonly grantId: string,
    public readonly reason: string | null,
    public readonly actorId: string,
    public readonly actorRoles: string[],
    public readonly correlationId: string | null,
  ) {}
}
