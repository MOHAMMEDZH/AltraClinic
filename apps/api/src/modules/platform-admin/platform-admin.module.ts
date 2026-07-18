import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PlatformAdminController } from './api/platform-admin.controller';
import { PlatformAdminPermissionGuard } from './api/platform-admin-permission.guard';
import { PlatformAdminPolicy } from './policies/platform-admin-policy.service';
import { PrivilegedAccessDomainService } from './domain/services/privileged-access.domain-service';
import { PrismaPlatformTenantRepository } from './infrastructure/prisma-platform-tenant.repository';
import { AuditTrailPlatformAdminAuditLog } from './infrastructure/audit-trail-platform-admin-audit-log';
import { ProvisionPlatformTenantHandler } from './application/handlers/provision-platform-tenant.handler';
import { ActivatePlatformTenantHandler } from './application/handlers/activate-platform-tenant.handler';
import { SuspendPlatformTenantHandler } from './application/handlers/suspend-platform-tenant.handler';
import { ResumePlatformTenantHandler } from './application/handlers/resume-platform-tenant.handler';
import { ArchivePlatformTenantHandler } from './application/handlers/archive-platform-tenant.handler';
import { ChangePlatformTenantPlanHandler } from './application/handlers/change-platform-tenant-plan.handler';
import { RequestPrivilegedAccessHandler } from './application/handlers/request-privileged-access.handler';
import { ApprovePrivilegedAccessHandler } from './application/handlers/approve-privileged-access.handler';
import { RejectPrivilegedAccessHandler } from './application/handlers/reject-privileged-access.handler';
import { RevokePrivilegedAccessHandler } from './application/handlers/revoke-privileged-access.handler';
import { GetPlatformTenantHandler } from './application/handlers/get-platform-tenant.handler';
import { ListPlatformTenantsHandler } from './application/handlers/list-platform-tenants.handler';
import { PLATFORM_TENANT_REPOSITORY, PLATFORM_ADMIN_AUDIT_LOG } from '../../infrastructure/provider.tokens';

@Module({
  imports: [AuditModule],
  controllers: [PlatformAdminController],
  providers: [
    PlatformAdminPolicy,
    PlatformAdminPermissionGuard,
    PrivilegedAccessDomainService,
    ProvisionPlatformTenantHandler,
    ActivatePlatformTenantHandler,
    SuspendPlatformTenantHandler,
    ResumePlatformTenantHandler,
    ArchivePlatformTenantHandler,
    ChangePlatformTenantPlanHandler,
    RequestPrivilegedAccessHandler,
    ApprovePrivilegedAccessHandler,
    RejectPrivilegedAccessHandler,
    RevokePrivilegedAccessHandler,
    GetPlatformTenantHandler,
    ListPlatformTenantsHandler,
    { provide: PLATFORM_TENANT_REPOSITORY, useClass: PrismaPlatformTenantRepository },
    { provide: PLATFORM_ADMIN_AUDIT_LOG, useClass: AuditTrailPlatformAdminAuditLog },
  ],
  exports: [PLATFORM_TENANT_REPOSITORY],
})
export class PlatformAdminModule {}
