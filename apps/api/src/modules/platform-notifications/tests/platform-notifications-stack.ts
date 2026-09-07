/**
 * Flexible Step 27 — Notifications and Templates service stack factory.
 *
 * Wires the real Phase 41d/41e delivery engine (NotificationIntentProducerService +
 * DeliveryWorkerService + DeliveryOrchestratorService and every collaborator they need)
 * together with the Step 27 platform-notifications application services, using plain
 * `new` construction (no Nest DI container) exactly like the platform-sales-productivity
 * stack. The only substitution vs. production wiring is `TransactionalEmailService`,
 * replaced by an in-memory `RecordingTransactionalEmailService` so tests never perform a
 * real network send (realExternalDeliveriesDuringTests = 0).
 */
import { PrismaClient } from '@prisma/client';
import type { PrismaService } from '../../../infrastructure/prisma.service';
import type { EventPublisherInterface } from '../../../infrastructure/event-publisher.interface';
import { createHybridPrisma, RecordingTransactionalEmailService } from './platform-notifications-db.harness';
import { PlatformAuthorizationService } from '../../auth/platform-rbac/platform-authorization.service';
import { PrismaPlatformUserRepository } from '../../auth/infrastructure/repositories/prisma-platform-user.repository';
import { TenantDbContextService } from '../../../infrastructure/tenant-db-context.service';
import { TenantExecutionService } from '../../../infrastructure/tenant-execution.service';

import { ConsentEvaluationService } from '../../notifications/delivery/consent-evaluation.service';
import { PreferenceEvaluationService } from '../../notifications/delivery/preference-evaluation.service';
import { QuietHoursService } from '../../notifications/delivery/quiet-hours.service';
import { ChannelRoutingService } from '../../notifications/delivery/channel-routing.service';
import { TemplateRenderService } from '../../notifications/delivery/template-render.service';
import { NotificationIntentService } from '../../notifications/delivery/notification-intent.service';
import { DeliveryJobService } from '../../notifications/delivery/delivery-job.service';
import { ReceiptService } from '../../notifications/delivery/receipt.service';
import { DeliveryActivityEmitterService } from '../../notifications/delivery/delivery-activity-emitter.service';
import { OutboundBrandingResolverService } from '../../notifications/delivery/outbound-branding-resolver.service';
import { DeliveryOrchestratorService } from '../../notifications/delivery/delivery-orchestrator.service';
import { DeliveryWorkerService } from '../../notifications/delivery/delivery-worker.service';
import { NotificationIntentProducerService } from '../../notifications/delivery/notification-intent-producer.service';
import { InAppAdapter } from '../../notifications/delivery/adapters/in-app.adapter';
import { EmailAdapter } from '../../notifications/delivery/adapters/email.adapter';
import { SmsAdapter } from '../../notifications/delivery/adapters/sms.adapter';
import { WhatsappAdapter } from '../../notifications/delivery/adapters/whatsapp.adapter';
import { PushAdapter } from '../../notifications/delivery/adapters/push.adapter';
import { WebhookAdapter } from '../../notifications/delivery/adapters/webhook.adapter';
import { ConsoleSmsSender } from '../../auth/infrastructure/services/console-sms-sender.service';
import { ConsolePushSender } from '../../auth/infrastructure/services/console-push-sender.service';

import { JobQueueService } from '../../background/infrastructure/job-queue.service';
import { BullMqConnectionService } from '../../background/infrastructure/bullmq-connection.service';
import { QueueMetricsService } from '../../../infrastructure/redis/services/queue-metrics.service';
import { RedisService } from '../../../infrastructure/redis/redis.service';
import { RedisKeyBuilder } from '../../../infrastructure/redis/redis-key.builder';

import { CommunicationDispatchService } from '../../subscription/application/services/communication-dispatch.service';
import { LicensingEngineService } from '../../subscription/application/services/licensing-engine.service';
import { LicensingAuditService } from '../../subscription/application/services/licensing-audit.service';
import { LicensingLifecycleStateService } from '../../subscription/application/services/licensing-lifecycle-state.service';

import { PlatformNotificationPreferenceService } from '../application/preferences/platform-notification-preference.service';
import { PlatformNotificationAuditLog } from '../application/platform-notification-audit.log';
import { PlatformNotificationDispatchService } from '../application/platform-notification-dispatch.service';
import { PlatformNotificationQueryService } from '../application/platform-notification-query.service';
import { PlatformNotificationEventAdapters } from '../application/adapters/platform-notification-event.adapters';
import { PlatformNotificationWarningScheduler } from '../application/schedulers/platform-notification-warning.scheduler';
import { PLATFORM_NOTIFICATION_PERMISSIONS } from '../platform-notifications.constants';

/** platform_administrator-equivalent permission set (full Step 27 surface). */
export const NOTIFICATIONS_ADMIN_PERMS: string[] = [
  PLATFORM_NOTIFICATION_PERMISSIONS.templatesView,
  PLATFORM_NOTIFICATION_PERMISSIONS.preferencesView,
  PLATFORM_NOTIFICATION_PERMISSIONS.preferencesManage,
  PLATFORM_NOTIFICATION_PERMISSIONS.deliveriesView,
  PLATFORM_NOTIFICATION_PERMISSIONS.deliveriesRetry,
];

/** Read-only viewer permission set (no manage/retry). */
export const NOTIFICATIONS_VIEWER_PERMS: string[] = [
  PLATFORM_NOTIFICATION_PERMISSIONS.templatesView,
  PLATFORM_NOTIFICATION_PERMISSIONS.preferencesView,
  PLATFORM_NOTIFICATION_PERMISSIONS.deliveriesView,
];

export interface PlatformNotificationsStack {
  prisma: PrismaService;
  emailService: RecordingTransactionalEmailService;
  producer: NotificationIntentProducerService;
  orchestrator: DeliveryOrchestratorService;
  worker: DeliveryWorkerService;
  jobs: DeliveryJobService;
  dispatch: PlatformNotificationDispatchService;
  prefs: PlatformNotificationPreferenceService;
  query: PlatformNotificationQueryService;
  adapters: PlatformNotificationEventAdapters;
  scheduler: PlatformNotificationWarningScheduler;
  audit: PlatformNotificationAuditLog;
  authz: PlatformAuthorizationService;
  perms: Set<string>;
}

/**
 * Lightweight stub-backed licensing chain. Only reachable when a test explicitly dispatches
 * a `clinic_user` recipient over a metered channel (email/sms/whatsapp/push) — the sentinel
 * `platform_user` path never calls this (see DeliveryWorkerService's sentinel exemption).
 * Modeled on the identical pattern used by
 * `platform-tenants-access-summary.postgres.integration.spec.ts`.
 */
function createLicensingChain(prisma: PrismaClient): CommunicationDispatchService {
  const wrapped = createHybridPrisma(prisma);
  const tenantSub = {
    getUsage: async () => ({
      users: 0,
      branches: 0,
      patients: 0,
      appointmentsThisMonth: 0,
      reportsThisMonth: 0,
      apiCallsToday: 0,
      storageGb: 0,
      smsThisMonth: 0,
      whatsappThisMonth: 0,
      emailThisMonth: 0,
      pushThisMonth: 0,
    }),
    resolveRequestedPlan: (plan: string) => ({ backendPlan: plan, platformPlan: 'growth', uiPlan: plan }),
  };
  const audit = { recordLicenseEvent: async () => undefined } as unknown as LicensingAuditService;
  const lifecycleState = {
    syncFromResolvedLicense: async () => undefined,
    persistKnownStatus: async () => undefined,
  } as unknown as LicensingLifecycleStateService;
  const licensing = new LicensingEngineService(wrapped as never, tenantSub as never, audit, lifecycleState);
  return new CommunicationDispatchService(wrapped, licensing, audit);
}

export function createPlatformNotificationsStack(
  prisma: PrismaClient,
  opts: {
    permissions?: string[];
    /** Reuse an existing recording sink across stack recreation (observability only — production safety is Strategy B ambiguous, not recorder dedupe). */
    emailService?: RecordingTransactionalEmailService;
  } = {},
): PlatformNotificationsStack {
  const wrapped = createHybridPrisma(prisma);
  const perms = new Set(opts.permissions ?? NOTIFICATIONS_ADMIN_PERMS);

  const tenantDbContext = new TenantDbContextService();
  const tenantExecution = new TenantExecutionService(wrapped, tenantDbContext);

  const redis = new RedisService();
  const queueMetrics = new QueueMetricsService(redis, new RedisKeyBuilder());
  const activity = new DeliveryActivityEmitterService(queueMetrics);
  const brandingResolver = new OutboundBrandingResolverService(wrapped);

  const bullMq = new BullMqConnectionService();
  const jobQueue = new JobQueueService(bullMq, queueMetrics);

  const consent = new ConsentEvaluationService();
  const preferenceEval = new PreferenceEvaluationService(wrapped);
  const quietHours = new QuietHoursService();
  const channelRouting = new ChannelRoutingService();
  const templateRender = new TemplateRenderService();
  const intentService = new NotificationIntentService(wrapped);
  const deliveryJobs = new DeliveryJobService(wrapped);
  const receipts = new ReceiptService(wrapped);

  const emailService = opts.emailService ?? new RecordingTransactionalEmailService();
  const inAppAdapter = new InAppAdapter(wrapped);
  const emailAdapter = new EmailAdapter(emailService as never, wrapped, brandingResolver);
  const smsAdapter = new SmsAdapter(new ConsoleSmsSender() as never, wrapped);
  const whatsappAdapter = new WhatsappAdapter(wrapped);
  const pushAdapter = new PushAdapter(new ConsolePushSender() as never, wrapped);
  const webhookAdapter = new WebhookAdapter();

  const orchestrator = new DeliveryOrchestratorService(
    wrapped,
    jobQueue,
    intentService,
    consent,
    preferenceEval,
    quietHours,
    channelRouting,
    templateRender,
    deliveryJobs,
    inAppAdapter,
    emailAdapter,
    smsAdapter,
    whatsappAdapter,
    pushAdapter,
    webhookAdapter,
    activity,
    brandingResolver,
  );

  const communicationLimits = createLicensingChain(prisma);

  const worker = new DeliveryWorkerService(
    bullMq,
    wrapped,
    tenantExecution,
    deliveryJobs,
    receipts,
    communicationLimits,
    inAppAdapter,
    emailAdapter,
    smsAdapter,
    whatsappAdapter,
    pushAdapter,
    webhookAdapter,
    activity,
  );

  const noopEventPublisher: EventPublisherInterface = { publish: async () => undefined };
  const producer = new NotificationIntentProducerService(orchestrator, noopEventPublisher);

  const users = new PrismaPlatformUserRepository(wrapped);
  const authz = new PlatformAuthorizationService(users, wrapped);

  const auditLog = new PlatformNotificationAuditLog(wrapped);
  const prefs = new PlatformNotificationPreferenceService(wrapped, auditLog);
  const dispatch = new PlatformNotificationDispatchService(wrapped, producer, worker, prefs, auditLog);
  const query = new PlatformNotificationQueryService(wrapped, deliveryJobs, worker, auditLog);
  const adapters = new PlatformNotificationEventAdapters(dispatch, wrapped);
  const scheduler = new PlatformNotificationWarningScheduler(wrapped, adapters);

  return {
    prisma: wrapped,
    emailService,
    producer,
    orchestrator,
    worker,
    jobs: deliveryJobs,
    dispatch,
    prefs,
    query,
    adapters,
    scheduler,
    audit: auditLog,
    authz,
    perms,
  };
}
