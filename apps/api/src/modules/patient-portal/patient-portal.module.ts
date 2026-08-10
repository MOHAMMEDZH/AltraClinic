import { Module, forwardRef } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { SettingsModule } from '../settings/settings.module';
import { AuthModule } from '../auth/auth.module';
import { IdentityModule } from '../identity/identity.module';
import { NotificationModule } from '../notifications/notifications.module';
import { PatientsModule } from '../patients/patients.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { PatientPortalController } from './api/patient-portal.controller';
import { PortalSchedulingController } from './api/portal-scheduling.controller';
import { PortalSafeAccessController } from './api/portal-safe-access.controller';
import { PatientPortalFoundationController } from './api/patient-portal-foundation.controller';
import { PatientPortalAuthController } from './api/patient-portal-auth.controller';
import { PatientPortalPermissionGuard } from './api/patient-portal-permission.guard';
import { PatientPortalCenterEnabledGuard } from './api/patient-portal-center.guard';
import { PatientPortalAppointmentsEnabledGuard } from './api/patient-portal-appointments.guard';
import { PatientPortalCaregiverEnabledGuard } from './api/patient-portal-caregiver.guard';
import { PatientPortalSessionGuard } from './api/patient-portal-session.guard';
import { PatientPortalEnrollmentCompleteGuard } from './api/patient-portal-enrollment.guard';
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
  GetMyAppointmentHandler,
  GetMyAvailabilityHandler,
  ListMyAppointmentsHandler,
  ListMyProvidersHandler,
  PortalSchedulingContextService,
  UpdateMyAppointmentHandler,
} from './application/handlers/portal-scheduling.handlers';
import { GetPortalSafeProfileHandler } from './application/handlers/portal-safe-profile.handler';
import { PatientPortalHealthContributors } from './application/patient-portal-health.contributors';
import { PatientPortalObservabilityContracts } from './application/patient-portal-observability.contracts';
import { PatientPortalLicensingContracts } from './application/patient-portal-licensing.contracts';
import { EffectivePatientPortalViewService } from './application/effective-patient-portal-view.service';
import { PatientPortalIdentityService } from './application/services/patient-portal-identity.service';
import { PatientPortalActivityEmitter } from './application/services/patient-portal-activity.emitter';
import { PortalSchedulingIdempotencyService } from './application/services/portal-scheduling-idempotency.service';
import { PatientPortalActingContextService } from './application/services/patient-portal-acting-context.service';
import { PatientPortalResultReleaseGate } from './application/services/patient-portal-result-release.gate';
import { PortalCaregiverLifecycleService } from './application/services/portal-caregiver-lifecycle.service';
import { PortalBrandingResolverService } from './application/services/portal-branding-resolver.service';
import { PORTAL_ACCOUNT_REPOSITORY, PORTAL_AUDIT_LOG } from '../../infrastructure/provider.tokens';

@Module({
  imports: [
    AuditModule,
    SchedulingModule,
    SettingsModule,
    NotificationModule,
    PatientsModule,
    SubscriptionModule,
    forwardRef(() => AuthModule),
    forwardRef(() => IdentityModule),
  ],
  controllers: [
    PatientPortalFoundationController,
    PatientPortalAuthController,
    PatientPortalController,
    PortalSchedulingController,
    PortalSafeAccessController,
  ],
  providers: [
    PatientPortalPolicy,
    PatientPortalPermissionGuard,
    PatientPortalCenterEnabledGuard,
    PatientPortalAppointmentsEnabledGuard,
    PatientPortalCaregiverEnabledGuard,
    PatientPortalSessionGuard,
    PatientPortalEnrollmentCompleteGuard,
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
    PortalSchedulingIdempotencyService,
    PatientPortalActingContextService,
    PatientPortalResultReleaseGate,
    PortalCaregiverLifecycleService,
    PortalBrandingResolverService,
    GetPortalSafeProfileHandler,
    ListMyAppointmentsHandler,
    GetMyAppointmentHandler,
    BookMyAppointmentHandler,
    UpdateMyAppointmentHandler,
    GetMyAvailabilityHandler,
    ListMyProvidersHandler,
    PatientPortalHealthContributors,
    PatientPortalObservabilityContracts,
    PatientPortalLicensingContracts,
    EffectivePatientPortalViewService,
    PatientPortalActivityEmitter,
    PatientPortalIdentityService,
    { provide: PORTAL_ACCOUNT_REPOSITORY, useClass: PrismaPortalAccountRepository },
    { provide: PORTAL_AUDIT_LOG, useClass: AuditTrailPortalAuditLog },
  ],
  exports: [
    PatientPortalHealthContributors,
    PatientPortalObservabilityContracts,
    PatientPortalLicensingContracts,
    EffectivePatientPortalViewService,
    PatientPortalIdentityService,
    PatientPortalActingContextService,
    PatientPortalResultReleaseGate,
  ],
})
export class PatientPortalModule {}
