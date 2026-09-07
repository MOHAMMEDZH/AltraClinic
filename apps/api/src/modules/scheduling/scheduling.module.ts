import { Module } from '@nestjs/common';
import { TenantScopedAccessGuard } from '../../common/tenant-scoped-access.guard';
import { AppointmentController } from './controllers/appointment.controller';
import { AppointmentTemplateController } from './controllers/appointment-template.controller';
import { SchedulingSupportController } from './controllers/scheduling-support.controller';
import { WaitlistController } from './controllers/waitlist.controller';
import { BookingIntegrityController } from './controllers/booking-integrity.controller';
import { PrismaAppointmentRepository } from './infrastructure/prisma-appointment.repository';
import { CreateAppointmentHandler } from './application/handlers/create-appointment.handler';
import { GetAppointmentHandler } from './application/handlers/get-appointment.handler';
import {
  BulkRescheduleHandler,
  DeleteAppointmentHandler,
  ListAppointmentsHandler,
  SchedulingAnalyticsHandler,
  SchedulingMetricsHandler,
  UpdateAppointmentHandler,
} from './application/handlers/appointment.handlers';
import {
  CreateAppointmentTemplateHandler,
  DeleteAppointmentTemplateHandler,
  ListAppointmentTemplatesHandler,
} from './application/handlers/appointment-templates.handlers';
import {
  GetResourceAvailabilityHandler,
  GetResourceDayStatusHandler,
  ListSchedulingResourcesHandler,
  CreateSchedulingResourceHandler,
} from './application/handlers/scheduling-resources.handlers';
import {
  GetAvailabilityHandler,
  ListProvidersHandler,
  ListServiceTypesHandler,
} from './application/handlers/scheduling-support.handlers';
import {
  CancelWaitlistHandler,
  CreateWaitlistHandler,
  ListWaitlistHandler,
} from './application/handlers/waitlist.handlers';
import { CreateInvoiceFromAppointmentHandler } from './application/handlers/create-invoice-from-appointment.handler';
import { APPOINTMENT_REPOSITORY } from '../../infrastructure/provider.tokens';
import { PatientsModule } from '../patients/patients.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { ScheduleSettingsController } from './controllers/schedule-settings.controller';
import {
  BookWaitlistEntryHandler,
  GetBranchHoursHandler,
  GetProviderScheduleHandler,
  UpsertBranchHoursHandler,
  UpsertProviderScheduleHandler,
} from './application/handlers/schedule-settings.handlers';
import { ScheduleWindowService } from './application/services/schedule-window.service';
import { TenantTimezoneService } from './application/services/tenant-timezone.service';
import { GetSchedulingContextHandler } from './application/handlers/scheduling-context.handler';
import { WaitlistSlotNotificationService } from './application/services/waitlist-slot-notification.service';
import { AppointmentCancelledWaitlistListener } from './application/integrations/appointment-cancelled-waitlist.listener';
import { BillingModule } from '../billing/billing.module';
import { NotificationModule } from '../notifications/notifications.module';
import { ClinicalCatalogModule } from '../clinical-catalog/clinical-catalog.module';
import { ClinicalFormsModule } from '../clinical-forms/clinical-forms.module';
import { BookingConcurrencyService } from './application/services/booking-concurrency.service';
import { AppointmentSnapshotService } from './application/services/appointment-snapshot.service';
import { AppointmentLifecycleMutationService } from './application/services/appointment-lifecycle-mutation.service';
import { BookingCommercialResolver } from './application/services/booking-commercial-resolver.service';
import { ProviderEligibilityService } from './application/services/provider-eligibility.service';
import { ServiceResourceRequirementService } from './application/services/service-resource-requirement.service';
import { SCHEDULING_AUDIT_LOG } from './application/ports/scheduling-audit-log.port';
import { AuditTrailSchedulingAuditLog } from './infrastructure/audit-trail-scheduling-audit-log';

@Module({
  imports: [
    PatientsModule,
    SubscriptionModule,
    BillingModule,
    NotificationModule,
    ClinicalCatalogModule,
    ClinicalFormsModule,
  ],
  controllers: [
    AppointmentController,
    AppointmentTemplateController,
    SchedulingSupportController,
    ScheduleSettingsController,
    WaitlistController,
    BookingIntegrityController,
  ],
  providers: [
    { provide: APPOINTMENT_REPOSITORY, useClass: PrismaAppointmentRepository },
    { provide: SCHEDULING_AUDIT_LOG, useClass: AuditTrailSchedulingAuditLog },
    BookingConcurrencyService,
    AppointmentSnapshotService,
    AppointmentLifecycleMutationService,
    BookingCommercialResolver,
    ProviderEligibilityService,
    ServiceResourceRequirementService,
    CreateAppointmentHandler,
    ListAppointmentsHandler,
    GetAppointmentHandler,
    UpdateAppointmentHandler,
    SchedulingMetricsHandler,
    SchedulingAnalyticsHandler,
    BulkRescheduleHandler,
    DeleteAppointmentHandler,
    ListProvidersHandler,
    GetAvailabilityHandler,
    ListServiceTypesHandler,
    ListSchedulingResourcesHandler,
    CreateSchedulingResourceHandler,
    GetResourceAvailabilityHandler,
    GetResourceDayStatusHandler,
    ListAppointmentTemplatesHandler,
    CreateAppointmentTemplateHandler,
    DeleteAppointmentTemplateHandler,
    ListWaitlistHandler,
    CreateWaitlistHandler,
    CancelWaitlistHandler,
    BookWaitlistEntryHandler,
    GetBranchHoursHandler,
    UpsertBranchHoursHandler,
    GetProviderScheduleHandler,
    UpsertProviderScheduleHandler,
    ScheduleWindowService,
    TenantTimezoneService,
    GetSchedulingContextHandler,
    WaitlistSlotNotificationService,
    AppointmentCancelledWaitlistListener,
    CreateInvoiceFromAppointmentHandler,
    TenantScopedAccessGuard,
  ],
  exports: [
    APPOINTMENT_REPOSITORY,
    CreateAppointmentHandler,
    UpdateAppointmentHandler,
    GetAppointmentHandler,
    GetAvailabilityHandler,
    ListProvidersHandler,
    BookingConcurrencyService,
    AppointmentSnapshotService,
    AppointmentLifecycleMutationService,
    BookingCommercialResolver,
    ProviderEligibilityService,
    ServiceResourceRequirementService,
    SCHEDULING_AUDIT_LOG,
  ],
})
export class SchedulingModule {}
