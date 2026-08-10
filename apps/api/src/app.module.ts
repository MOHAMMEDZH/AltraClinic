import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { IdentityModule } from './modules/identity/identity.module';
import { PatientsModule } from './modules/patients/patients.module';
import { SchedulingModule } from './modules/scheduling/scheduling.module';
import { EMRModule } from './modules/emr/emr.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { AuditModule } from './modules/audit/audit.module';
import { DentalModule } from './modules/dental/dental.module';
import { BeautyModule } from './modules/beauty/beauty.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { BillingModule } from './modules/billing/billing.module';
import { CommissionModule } from './modules/commission/commission.module';
import { LoyaltyModule } from './modules/loyalty/loyalty.module';
import { NotificationModule } from './modules/notifications/notifications.module';
import { ReportingModule } from './modules/reporting/reporting.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { AiModule } from './modules/ai/ai.module';
import { PatientPortalModule } from './modules/patient-portal/patient-portal.module';
import { PlatformAdminModule } from './modules/platform-admin/platform-admin.module';
import { QueueModule } from './modules/queue/queue.module';
import { MediaModule } from './modules/media/media.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { BackgroundModule } from './modules/background/background.module';
import { SearchModule } from './modules/search/search.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { SettingsModule } from './modules/settings/settings.module';
import { ModuleRegistryModule } from './modules/module-registry/module-registry.module';
import { ImportExportModule } from './modules/import-export/import-export.module';
import { BackupRestoreModule } from './modules/backup-restore/backup-restore.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { ObservabilityModule } from './modules/observability/observability.module';
import { PlatformDashboardModule } from './modules/platform-dashboard/platform-dashboard.module';
import { PlatformTenantsModule } from './modules/platform-tenants/platform-tenants.module';
import { PlatformHealthcareCatalogModule } from './modules/platform-healthcare-catalog/platform-healthcare-catalog.module';
import { PlatformPlansModule } from './modules/platform-plans/platform-plans.module';
import { PlatformAddonsModule } from './modules/platform-addons/platform-addons.module';
import { PlatformSubscriptionsModule } from './modules/platform-subscriptions/platform-subscriptions.module';
import { EffectiveEntitlementRuntimeModule } from './modules/effective-entitlement-runtime/effective-entitlement-runtime.module';
import { UsageMeteringModule } from './modules/usage-metering/usage-metering.module';
import { TenantProvisioningModule } from './modules/tenant-provisioning/tenant-provisioning.module';
import { TenantLifecycleModule } from './modules/tenant-lifecycle/tenant-lifecycle.module';
import { FeatureFlagsSettingsModule } from './modules/feature-flags-settings/feature-flags-settings.module';
import { PlatformAuditCenterModule } from './modules/platform-audit-center/platform-audit-center.module';
import { PlatformOperationsConsoleModule } from './modules/platform-operations-console/platform-operations-console.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/api/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/api/guards/roles.guard';
import { PermissionGuard } from './modules/auth/api/guards/permission.guard';
import { MaintenanceModeGuard } from './common/maintenance-mode.guard';
import { TenantDbInterceptor } from './common/interceptors/tenant-db.interceptor';
import { LicensedModuleGuard } from './modules/subscription/api/guards/licensed-module.guard';
import { ApiRateLimitGuard } from './modules/subscription/api/guards/api-rate-limit.guard';
import { IntegrationsApiKeyAuthGuard } from './modules/integrations/api/guards/integrations-api-key-auth.guard';

/**
 * JwtAuthGuard is registered globally here.
 * IntegrationsApiKeyAuthGuard runs first (OD-AUTHN) for bk_/bki_ Bearer and X-Api-Key.
 * All routes require authentication unless decorated with @Public().
 * RolesGuard runs after JWT / API-key validation.
 */
@Module({
  imports: [
    InfrastructureModule,
    AuthModule,             // Auth before other modules (provides TENANT_RESOLVER)
    IdentityModule,
    PatientsModule,
    SchedulingModule,
    EMRModule,
    TenantModule,
    AuditModule,
    DentalModule,
    BeautyModule,
    InventoryModule,
    BillingModule,
    CommissionModule,
    LoyaltyModule,
    NotificationModule,
    ReportingModule,
    AnalyticsModule,
    SubscriptionModule,
    WorkflowModule,
    AiModule,
    PatientPortalModule,
    PlatformAdminModule,
    QueueModule,
    MediaModule,
    RealtimeModule,
    BackgroundModule,
    SearchModule,
    DashboardModule,
    SettingsModule,
    ModuleRegistryModule,
    ImportExportModule,
    BackupRestoreModule,
    IntegrationsModule,
    ObservabilityModule,
    PlatformDashboardModule,
    PlatformTenantsModule,
    PlatformHealthcareCatalogModule,
    PlatformPlansModule,
    PlatformAddonsModule,
    PlatformSubscriptionsModule,
    EffectiveEntitlementRuntimeModule,
    UsageMeteringModule,
    TenantProvisioningModule,
    TenantLifecycleModule,
    FeatureFlagsSettingsModule,
    PlatformAuditCenterModule,
    PlatformOperationsConsoleModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: IntegrationsApiKeyAuthGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ApiRateLimitGuard },
    { provide: APP_GUARD, useClass: MaintenanceModeGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // PermissionGuard runs last; only activates when @RequirePermission is present.
    // super_admin always bypasses. Unknown resources fail CLOSED.
    { provide: APP_GUARD, useClass: PermissionGuard },
    { provide: APP_GUARD, useClass: LicensedModuleGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantDbInterceptor },
  ],
})
export class AppModule {}
