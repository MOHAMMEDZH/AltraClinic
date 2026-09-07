/**
 * Flexible Step 27 — code-defined template catalog (en-US / ar-SY).
 * No CMS. Explicit allowlists. No PHI/secrets variables.
 */
import type {
  PlatformNotificationCategory,
  PlatformNotificationEventKey,
  PlatformNotificationLocale,
} from '../../domain/platform-notifications.types';
import { PLATFORM_TEMPLATE_VERSION } from '../../platform-notifications.constants';
import { PlatformNotificationValidationError } from '../../domain/platform-notifications.errors';
import { isPlatformNotificationFailureInjectionActive } from '../../platform-notifications.constants';

const FORBIDDEN_VAR_NAMES = new Set([
  'patientName',
  'patientId',
  'mrn',
  'diagnosis',
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'mfaSeed',
  'apiKey',
  'databaseUrl',
  'encryptionKey',
  'stack',
  'rawInviteToken',
]);

export interface PlatformTemplateDefinition {
  key: string;
  eventKeys: readonly PlatformNotificationEventKey[];
  category: PlatformNotificationCategory;
  mandatory: boolean;
  channels: readonly ('email' | 'in-app')[];
  version: string;
  variables: readonly string[];
  requiredVariables: readonly string[];
  locales: Record<
    PlatformNotificationLocale,
    { subject: string; body: string }
  >;
}

function t(
  key: string,
  eventKeys: PlatformNotificationEventKey[],
  category: PlatformNotificationCategory,
  mandatory: boolean,
  variables: string[],
  required: string[],
  en: { subject: string; body: string },
  ar: { subject: string; body: string },
  channels: ('email' | 'in-app')[] = ['email'],
): PlatformTemplateDefinition {
  return {
    key,
    eventKeys,
    category,
    mandatory,
    channels,
    version: PLATFORM_TEMPLATE_VERSION,
    variables,
    requiredVariables: required,
    locales: { 'en-US': en, 'ar-SY': ar },
  };
}

export const PLATFORM_TEMPLATES: readonly PlatformTemplateDefinition[] = [
  t(
    'tpl.platform.invitation.sent',
    ['platform.invitation.sent'],
    'security',
    true,
    ['recipientDisplayName', 'inviterDisplayName', 'expiresAt'],
    ['recipientDisplayName', 'expiresAt'],
    {
      subject: 'Platform invitation',
      body: 'Hello {{recipientDisplayName}}, you were invited by {{inviterDisplayName}}. Expires {{expiresAt}}.',
    },
    {
      subject: 'دعوة للمنصة',
      body: 'مرحباً {{recipientDisplayName}}، تمت دعوتك بواسطة {{inviterDisplayName}}. تنتهي {{expiresAt}}.',
    },
  ),
  t(
    'tpl.platform.mfa.security_alert',
    ['platform.mfa.security_alert'],
    'security',
    true,
    ['recipientDisplayName', 'alertSummary', 'occurredAt'],
    ['recipientDisplayName', 'alertSummary', 'occurredAt'],
    {
      subject: 'Security alert',
      body: 'Hello {{recipientDisplayName}}, security event: {{alertSummary}} at {{occurredAt}}.',
    },
    {
      subject: 'تنبيه أمني',
      body: 'مرحباً {{recipientDisplayName}}، حدث أمني: {{alertSummary}} في {{occurredAt}}.',
    },
  ),
  t(
    'tpl.platform.tenant.lifecycle',
    ['platform.tenant.lifecycle_transition'],
    'lifecycle',
    true,
    ['organizationName', 'fromState', 'toState', 'occurredAt'],
    ['organizationName', 'toState', 'occurredAt'],
    {
      subject: 'Tenant lifecycle update',
      body: '{{organizationName}} moved {{fromState}} → {{toState}} at {{occurredAt}}.',
    },
    {
      subject: 'تحديث دورة حياة المستأجر',
      body: '{{organizationName}} انتقل {{fromState}} → {{toState}} في {{occurredAt}}.',
    },
  ),
  t(
    'tpl.platform.trial.approaching_expiry',
    ['platform.trial.approaching_expiry'],
    'commercial',
    false,
    ['organizationName', 'expiryDate', 'planVersionId'],
    ['organizationName', 'expiryDate', 'planVersionId'],
    {
      subject: 'Trial approaching expiry',
      body: 'Trial for {{organizationName}} (Plan Version {{planVersionId}}) expires {{expiryDate}}.',
    },
    {
      subject: 'اقتراب انتهاء التجربة',
      body: 'تجربة {{organizationName}} (إصدار الخطة {{planVersionId}}) تنتهي {{expiryDate}}.',
    },
  ),
  t(
    'tpl.platform.trial.expired',
    ['platform.trial.expired'],
    'commercial',
    false,
    ['organizationName', 'expiryDate', 'planVersionId'],
    ['organizationName', 'expiryDate', 'planVersionId'],
    {
      subject: 'Trial expired',
      body: 'Trial for {{organizationName}} (Plan Version {{planVersionId}}) expired {{expiryDate}}.',
    },
    {
      subject: 'انتهت التجربة',
      body: 'انتهت تجربة {{organizationName}} (إصدار الخطة {{planVersionId}}) في {{expiryDate}}.',
    },
  ),
  t(
    'tpl.platform.subscription.approaching_expiry',
    ['platform.subscription.approaching_expiry'],
    'commercial',
    false,
    ['organizationName', 'expiryDate', 'planVersionId'],
    ['organizationName', 'expiryDate', 'planVersionId'],
    {
      subject: 'Subscription approaching expiry',
      body: 'Subscription for {{organizationName}} (Plan Version {{planVersionId}}) expires {{expiryDate}}.',
    },
    {
      subject: 'اقتراب انتهاء الاشتراك',
      body: 'اشتراك {{organizationName}} (إصدار الخطة {{planVersionId}}) ينتهي {{expiryDate}}.',
    },
  ),
  t(
    'tpl.platform.subscription.expired',
    ['platform.subscription.expired'],
    'commercial',
    false,
    ['organizationName', 'expiryDate', 'planVersionId'],
    ['organizationName', 'expiryDate', 'planVersionId'],
    {
      subject: 'Subscription expired',
      body: 'Subscription for {{organizationName}} expired {{expiryDate}}.',
    },
    {
      subject: 'انتهى الاشتراك',
      body: 'انتهى اشتراك {{organizationName}} في {{expiryDate}}.',
    },
  ),
  t(
    'tpl.platform.plan_version.migration_scheduled',
    ['platform.plan_version.migration_scheduled'],
    'commercial',
    false,
    ['organizationName', 'fromPlanVersionId', 'toPlanVersionId', 'scheduledAt'],
    ['organizationName', 'toPlanVersionId', 'scheduledAt'],
    {
      subject: 'Plan Version migration scheduled',
      body: '{{organizationName}} migration {{fromPlanVersionId}} → {{toPlanVersionId}} scheduled {{scheduledAt}}.',
    },
    {
      subject: 'تمت جدولة ترحيل إصدار الخطة',
      body: 'ترحيل {{organizationName}} {{fromPlanVersionId}} → {{toPlanVersionId}} مجدول {{scheduledAt}}.',
    },
  ),
  t(
    'tpl.platform.plan_version.migration_completed',
    ['platform.plan_version.migration_completed'],
    'commercial',
    false,
    ['organizationName', 'fromPlanVersionId', 'toPlanVersionId', 'completedAt'],
    ['organizationName', 'toPlanVersionId', 'completedAt'],
    {
      subject: 'Plan Version migration completed',
      body: '{{organizationName}} migration completed to {{toPlanVersionId}} at {{completedAt}}.',
    },
    {
      subject: 'اكتمل ترحيل إصدار الخطة',
      body: 'اكتمل ترحيل {{organizationName}} إلى {{toPlanVersionId}} في {{completedAt}}.',
    },
  ),
  t(
    'tpl.platform.addon.approaching_expiry',
    ['platform.addon.approaching_expiry'],
    'commercial',
    false,
    ['organizationName', 'addOnLabel', 'addOnVersionId', 'expiryDate'],
    ['organizationName', 'addOnVersionId', 'expiryDate'],
    {
      subject: 'Add-on approaching expiry',
      body: 'Add-on {{addOnLabel}} ({{addOnVersionId}}) for {{organizationName}} expires {{expiryDate}}.',
    },
    {
      subject: 'اقتراب انتهاء الإضافة',
      body: 'الإضافة {{addOnLabel}} ({{addOnVersionId}}) لـ {{organizationName}} تنتهي {{expiryDate}}.',
    },
  ),
  t(
    'tpl.platform.addon.expired',
    ['platform.addon.expired'],
    'commercial',
    false,
    ['organizationName', 'addOnLabel', 'addOnVersionId', 'expiryDate'],
    ['organizationName', 'addOnVersionId', 'expiryDate'],
    {
      subject: 'Add-on expired',
      body: 'Add-on {{addOnLabel}} ({{addOnVersionId}}) for {{organizationName}} expired {{expiryDate}}.',
    },
    {
      subject: 'انتهت الإضافة',
      body: 'انتهت الإضافة {{addOnLabel}} ({{addOnVersionId}}) لـ {{organizationName}} في {{expiryDate}}.',
    },
  ),
  t(
    'tpl.platform.override.approaching_expiry',
    ['platform.override.approaching_expiry'],
    'commercial',
    false,
    ['organizationName', 'overrideLabel', 'overrideId', 'expiryDate'],
    ['organizationName', 'overrideId', 'expiryDate'],
    {
      subject: 'Override approaching expiry',
      body: 'Override {{overrideLabel}} ({{overrideId}}) for {{organizationName}} expires {{expiryDate}}.',
    },
    {
      subject: 'اقتراب انتهاء الاستثناء',
      body: 'الاستثناء {{overrideLabel}} ({{overrideId}}) لـ {{organizationName}} ينتهي {{expiryDate}}.',
    },
  ),
  t(
    'tpl.platform.override.expired',
    ['platform.override.expired'],
    'commercial',
    false,
    ['organizationName', 'overrideLabel', 'overrideId', 'expiryDate'],
    ['organizationName', 'overrideId', 'expiryDate'],
    {
      subject: 'Override expired',
      body: 'Override {{overrideLabel}} ({{overrideId}}) for {{organizationName}} expired {{expiryDate}}.',
    },
    {
      subject: 'انتهى الاستثناء',
      body: 'انتهى الاستثناء {{overrideLabel}} ({{overrideId}}) لـ {{organizationName}} في {{expiryDate}}.',
    },
  ),
  t(
    'tpl.platform.limit.warning',
    ['platform.limit.warning_threshold'],
    'usage',
    false,
    [
      'organizationName',
      'limitKey',
      'effectiveLimit',
      'currentUsage',
      'thresholdPercent',
      'limitProvenance',
    ],
    ['organizationName', 'limitKey', 'effectiveLimit', 'currentUsage', 'limitProvenance'],
    {
      subject: 'Usage warning threshold',
      body: '{{organizationName}} {{limitKey}}: usage {{currentUsage}} / effective {{effectiveLimit}} ({{thresholdPercent}}%, provenance {{limitProvenance}}).',
    },
    {
      subject: 'تحذير عتبة الاستخدام',
      body: '{{organizationName}} {{limitKey}}: الاستخدام {{currentUsage}} / الفعلي {{effectiveLimit}} ({{thresholdPercent}}%، المصدر {{limitProvenance}}).',
    },
  ),
  t(
    'tpl.platform.limit.critical',
    ['platform.limit.critical_threshold'],
    'usage',
    false,
    [
      'organizationName',
      'limitKey',
      'effectiveLimit',
      'currentUsage',
      'thresholdPercent',
      'limitProvenance',
    ],
    ['organizationName', 'limitKey', 'effectiveLimit', 'currentUsage', 'limitProvenance'],
    {
      subject: 'Usage critical threshold',
      body: '{{organizationName}} {{limitKey}} critical: {{currentUsage}} / {{effectiveLimit}} ({{thresholdPercent}}%, {{limitProvenance}}).',
    },
    {
      subject: 'عتبة استخدام حرجة',
      body: '{{organizationName}} {{limitKey}} حرج: {{currentUsage}} / {{effectiveLimit}} ({{thresholdPercent}}%، {{limitProvenance}}).',
    },
  ),
  t(
    'tpl.platform.limit.hard_denied',
    ['platform.limit.hard_denied'],
    'usage',
    false,
    ['organizationName', 'limitKey', 'effectiveLimit', 'currentUsage', 'limitProvenance'],
    ['organizationName', 'limitKey', 'effectiveLimit', 'limitProvenance'],
    {
      subject: 'Hard limit reached',
      body: '{{organizationName}} {{limitKey}} denied at effective limit {{effectiveLimit}} (usage {{currentUsage}}, {{limitProvenance}}).',
    },
    {
      subject: 'تم بلوغ الحد الصارم',
      body: '{{organizationName}} {{limitKey}} مرفوض عند الحد الفعلي {{effectiveLimit}} (الاستخدام {{currentUsage}}، {{limitProvenance}}).',
    },
  ),
  t(
    'tpl.platform.compatibility.issue',
    ['platform.compatibility.issue'],
    'operational',
    false,
    ['organizationName', 'issueSummary', 'ruleReference'],
    ['organizationName', 'issueSummary'],
    {
      subject: 'Compatibility issue',
      body: '{{organizationName}}: {{issueSummary}} ({{ruleReference}}).',
    },
    {
      subject: 'مشكلة توافق',
      body: '{{organizationName}}: {{issueSummary}} ({{ruleReference}}).',
    },
  ),
  t(
    'tpl.platform.provisioning.failure',
    ['platform.provisioning.failure'],
    'operational',
    true,
    ['organizationName', 'operationReference', 'failureClass', 'occurredAt'],
    ['organizationName', 'operationReference', 'occurredAt'],
    {
      subject: 'Provisioning failure',
      body: 'Provisioning for {{organizationName}} failed ({{operationReference}}, {{failureClass}}) at {{occurredAt}}.',
    },
    {
      subject: 'فشل التهيئة',
      body: 'فشلت تهيئة {{organizationName}} ({{operationReference}}، {{failureClass}}) في {{occurredAt}}.',
    },
  ),
  t(
    'tpl.platform.provisioning.recovered',
    ['platform.provisioning.recovered'],
    'operational',
    false,
    ['organizationName', 'operationReference', 'recoveredAt'],
    ['organizationName', 'operationReference', 'recoveredAt'],
    {
      subject: 'Provisioning recovered',
      body: 'Provisioning for {{organizationName}} recovered ({{operationReference}}) at {{recoveredAt}}.',
    },
    {
      subject: 'تعافت التهيئة',
      body: 'تعافت تهيئة {{organizationName}} ({{operationReference}}) في {{recoveredAt}}.',
    },
  ),
  t(
    'tpl.platform.sales.lead_next_action',
    ['platform.sales.lead_next_action_reminder'],
    'sales',
    false,
    ['leadReference', 'organizationName', 'nextActionDate', 'nextActionType'],
    ['leadReference', 'nextActionDate'],
    {
      subject: 'Lead next-action reminder',
      body: 'Lead {{leadReference}} ({{organizationName}}) next action {{nextActionType}} due {{nextActionDate}}.',
    },
    {
      subject: 'تذكير بإجراء العميل المحتمل',
      body: 'العميل {{leadReference}} ({{organizationName}}) إجراء {{nextActionType}} مستحق {{nextActionDate}}.',
    },
  ),
  t(
    'tpl.platform.sales.demo_reminder',
    ['platform.sales.demo_reminder'],
    'sales',
    false,
    ['leadReference', 'organizationName', 'demoScheduledAt'],
    ['leadReference', 'demoScheduledAt'],
    {
      subject: 'Demo reminder',
      body: 'Demo for lead {{leadReference}} ({{organizationName}}) at {{demoScheduledAt}}.',
    },
    {
      subject: 'تذكير بالعرض التوضيحي',
      body: 'عرض للعميل {{leadReference}} ({{organizationName}}) في {{demoScheduledAt}}.',
    },
  ),
  t(
    'tpl.platform.sales.manager_stale',
    ['platform.sales.manager_stale_alert'],
    'sales_manager',
    false,
    ['managerDisplayName', 'staleCount', 'periodLabel'],
    ['managerDisplayName', 'staleCount'],
    {
      subject: 'Stale sales items',
      body: 'Hello {{managerDisplayName}}, {{staleCount}} stale sales items in {{periodLabel}}.',
    },
    {
      subject: 'عناصر مبيعات متأخرة',
      body: 'مرحباً {{managerDisplayName}}، {{staleCount}} عناصر متأخرة في {{periodLabel}}.',
    },
  ),
  t(
    'tpl.platform.sales.manager_ops',
    ['platform.sales.manager_ops_alert'],
    'sales_manager',
    false,
    ['managerDisplayName', 'alertSummary', 'operationReference'],
    ['managerDisplayName', 'alertSummary'],
    {
      subject: 'Manager operations alert',
      body: 'Hello {{managerDisplayName}}: {{alertSummary}} ({{operationReference}}).',
    },
    {
      subject: 'تنبيه عمليات للمدير',
      body: 'مرحباً {{managerDisplayName}}: {{alertSummary}} ({{operationReference}}).',
    },
  ),
  t(
    'tpl.platform.subscription.material_change',
    ['platform.subscription.material_change'],
    'commercial',
    false,
    ['organizationName', 'changeSummary', 'planVersionId', 'occurredAt'],
    ['organizationName', 'changeSummary', 'occurredAt'],
    {
      subject: 'Subscription material change',
      body: '{{organizationName}}: {{changeSummary}} (Plan Version {{planVersionId}}) at {{occurredAt}}.',
    },
    {
      subject: 'تغيير جوهري في الاشتراك',
      body: '{{organizationName}}: {{changeSummary}} (إصدار الخطة {{planVersionId}}) في {{occurredAt}}.',
    },
  ),
];

export function listPlatformTemplates(): PlatformTemplateDefinition[] {
  return [...PLATFORM_TEMPLATES];
}

export function getPlatformTemplateByKey(key: string): PlatformTemplateDefinition {
  if (isPlatformNotificationFailureInjectionActive('template_lookup')) {
    throw new PlatformNotificationValidationError('Injected template lookup failure', 'injected_failure');
  }
  const found = PLATFORM_TEMPLATES.find((x) => x.key === key);
  if (!found) throw new PlatformNotificationValidationError(`Unknown template ${key}`, 'template_not_found');
  return found;
}

export function getPlatformTemplateForEvent(
  eventKey: PlatformNotificationEventKey,
): PlatformTemplateDefinition {
  if (isPlatformNotificationFailureInjectionActive('template_lookup')) {
    throw new PlatformNotificationValidationError('Injected template lookup failure', 'injected_failure');
  }
  const found = PLATFORM_TEMPLATES.find((x) => x.eventKeys.includes(eventKey));
  if (!found) {
    throw new PlatformNotificationValidationError(
      `No template for event ${eventKey}`,
      'template_not_found',
    );
  }
  return found;
}

function escapeText(value: string): string {
  return value.replace(/[<>&]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}

export function renderPlatformTemplate(
  template: PlatformTemplateDefinition,
  locale: PlatformNotificationLocale,
  variables: Record<string, string | number | boolean | null | undefined>,
): { subject: string; body: string } {
  if (isPlatformNotificationFailureInjectionActive('template_renderer')) {
    throw new PlatformNotificationValidationError('Injected template renderer failure', 'injected_failure');
  }
  if (isPlatformNotificationFailureInjectionActive('locale_renderer') && locale === 'ar-SY') {
    throw new PlatformNotificationValidationError('Injected locale renderer failure', 'injected_failure');
  }
  if (isPlatformNotificationFailureInjectionActive('template_variable_validation')) {
    throw new PlatformNotificationValidationError(
      'Injected template variable validation failure',
      'injected_failure',
    );
  }

  const allow = new Set(template.variables);
  for (const key of Object.keys(variables)) {
    if (FORBIDDEN_VAR_NAMES.has(key)) {
      throw new PlatformNotificationValidationError(
        `Forbidden template variable ${key}`,
        'forbidden_variable',
      );
    }
    if (!allow.has(key)) {
      // Several event adapters share one payload shape across two-to-three sibling templates
      // (e.g. `subscriptionEvent` covers approaching/expired/material_change) and pass every
      // field as `value ?? null` regardless of which template will actually be rendered. A
      // `null` placeholder for a field this specific template doesn't declare is therefore
      // "not applicable", not a real leak — only reject genuinely undeclared *values*.
      if (variables[key] == null) continue;
      throw new PlatformNotificationValidationError(
        `Undeclared template variable ${key}`,
        'undeclared_variable',
      );
    }
  }
  for (const req of template.requiredVariables) {
    const v = variables[req];
    if (v == null || String(v).trim() === '') {
      throw new PlatformNotificationValidationError(
        `Missing required template variable ${req}`,
        'missing_variable',
      );
    }
  }

  const loc = template.locales[locale] ?? template.locales['en-US'];
  const replace = (text: string) =>
    text.replace(/\{\{(\w+)\}\}/g, (_m, name: string) => {
      if (!allow.has(name)) {
        throw new PlatformNotificationValidationError(
          `Undeclared template variable ${name}`,
          'undeclared_variable',
        );
      }
      const raw = variables[name];
      if (raw == null) return '';
      return escapeText(String(raw));
    });

  return { subject: replace(loc.subject), body: replace(loc.body) };
}

/** Synthetic preview variables — never real secrets/PHI. */
export function syntheticPreviewVariables(
  template: PlatformTemplateDefinition,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const v of template.variables) {
    out[v] = `sample_${v}`;
  }
  return out;
}
