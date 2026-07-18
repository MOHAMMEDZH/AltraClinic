import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { PatientPortalController } from './api/patient-portal.controller';
import { PortalSchedulingController } from './api/portal-scheduling.controller';
import { PatientPortalPermissionGuard } from './api/patient-portal-permission.guard';
import { PatientPortalPolicy } from './policies/patient-portal-policy.service';
import { CaregiverAccessDomainService } from './domain/services/caregiver-access.domain-service';
import { PrismaPortalAccountRepository } from './infrastructure/prisma-portal-account.repository';
import { AuditTrailPortalAuditLog } from './infrastructure/audit-trail-portal-audit-log';
import { InvitePortalAccountHandler } from './application/handlers/invite-portal-account.handler';
import { ActivatePortalAccountHandler } from './application/handlers/activate-portal-account.handler';
import { SuspendPortalAccountHandler } from './application/handlers/suspend-portal-account.handler';
import { ReactivatePortalAccountHandler } from './application/handlers/reactivate-portal-account.handler';
import { DeactivatePortalAccountHandler } from './application/handlers/deactivate-portal-account.handler';
import { UpdatePortalPreferencesHandler } from './application/handlers/update-portal-preferences.handler';
import { GrantCaregiverAccessHandler } from './application/handlers/grant-caregiver-access.handler';
import { RevokeCaregiverAccessHandler } from './application/handlers/revoke-caregiver-access.handler';
import { GetPortalAccountHandler } from './application/handlers/get-portal-account.handler';
import { ListPortalAccountsHandler } from './application/handlers/list-portal-accounts.handler';
import {
  BookMyAppointmentHandler,
  GetMyAvailabilityHandler,
  ListMyAppointmentsHandler,
  ListMyProvidersHandler,
  PortalSchedulingContextService,
  UpdateMyAppointmentHandler,
} from './application/handlers/portal-scheduling.handlers';
import { PORTAL_ACCOUNT_REPOSITORY, PORTAL_AUDIT_LOG } from '../../infrastructure/provider.tokens';

@Module({
  imports: [AuditModule, SchedulingModule],
  controllers: [PatientPortalController, PortalSchedulingController],
  providers: [
    PatientPortalPolicy,
    PatientPortalPermissionGuard,
    CaregiverAccessDomainService,
    InvitePortalAccountHandler,
    ActivatePortalAccountHandler,
    SuspendPortalAccountHandler,
    ReactivatePortalAccountHandler,
    DeactivatePortalAccountHandler,
    UpdatePortalPreferencesHandler,
    GrantCaregiverAccessHandler,
    RevokeCaregiverAccessHandler,
    GetPortalAccountHandler,
    ListPortalAccountsHandler,
    PortalSchedulingContextService,
    ListMyAppointmentsHandler,
    BookMyAppointmentHandler,
    UpdateMyAppointmentHandler,
    GetMyAvailabilityHandler,
    ListMyProvidersHandler,
    { provide: PORTAL_ACCOUNT_REPOSITORY, useClass: PrismaPortalAccountRepository },
    { provide: PORTAL_AUDIT_LOG, useClass: AuditTrailPortalAuditLog },
  ],
})
export class PatientPortalModule {}
