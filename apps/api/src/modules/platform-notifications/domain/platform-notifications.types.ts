/** Flexible Step 27 — domain types. */

export type PlatformNotificationEventKey =
  | 'platform.invitation.sent'
  | 'platform.mfa.security_alert'
  | 'platform.tenant.lifecycle_transition'
  | 'platform.trial.approaching_expiry'
  | 'platform.trial.expired'
  | 'platform.subscription.approaching_expiry'
  | 'platform.subscription.expired'
  | 'platform.plan_version.migration_scheduled'
  | 'platform.plan_version.migration_completed'
  | 'platform.addon.approaching_expiry'
  | 'platform.addon.expired'
  | 'platform.override.approaching_expiry'
  | 'platform.override.expired'
  | 'platform.limit.warning_threshold'
  | 'platform.limit.critical_threshold'
  | 'platform.limit.hard_denied'
  | 'platform.compatibility.issue'
  | 'platform.provisioning.failure'
  | 'platform.provisioning.recovered'
  | 'platform.sales.lead_next_action_reminder'
  | 'platform.sales.demo_reminder'
  | 'platform.sales.manager_stale_alert'
  | 'platform.sales.manager_ops_alert'
  | 'platform.subscription.material_change';

export type PlatformNotificationCategory =
  | 'security'
  | 'lifecycle'
  | 'commercial'
  | 'usage'
  | 'operational'
  | 'sales'
  | 'sales_manager';

export type PlatformNotificationLocale = 'en-US' | 'ar-SY';

export type PlatformRecipientKind = 'platform_user' | 'clinic_user';

export interface PlatformDispatchRequest {
  eventKey: PlatformNotificationEventKey;
  sourceType: string;
  sourceId: string;
  windowKey?: string;
  recipientKind: PlatformRecipientKind;
  recipientId: string;
  /** Required for platform_user email. */
  recipientEmail?: string;
  /** Required for clinic_user path. */
  clinicTenantId?: string;
  locale?: PlatformNotificationLocale;
  variables: Record<string, string | number | boolean | null | undefined>;
  correlationId?: string;
  channels?: Array<'email' | 'in-app'>;
}

export interface PlatformDispatchResult {
  accepted: boolean;
  suppressed?: boolean;
  suppressReason?: string;
  intentId?: string;
  jobIds?: string[];
  dedupeKey: string;
  replayed?: boolean;
}
