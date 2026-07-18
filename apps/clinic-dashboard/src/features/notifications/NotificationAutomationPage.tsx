import { useMemo, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { WidgetSkeleton } from '@/features/dashboard/components/WidgetShell';
import {
  buildNotificationsPermCheck,
  canManageNotifications,
  NOTIFICATION_CHANNELS,
  AUTOMATION_EVENT_TYPES,
} from './config/notifications-config';
import {
  useAutomationRules,
  useCreateAutomationRule,
  useNotificationTemplates,
  useUpdateAutomationRule,
} from './hooks/useNotifications';
import styles from './notifications-layout.module.css';

export function NotificationAutomationPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const perm = useMemo(() => buildNotificationsPermCheck(user?.roles ?? []), [user?.roles]);
  const canManage = canManageNotifications(perm);

  const rulesQuery = useAutomationRules(canManage);
  const templatesQuery = useNotificationTemplates(undefined, canManage);
  const createMutation = useCreateAutomationRule();
  const updateMutation = useUpdateAutomationRule();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [eventType, setEventType] = useState('');
  const [channel, setChannel] = useState('in-app');
  const [templateId, setTemplateId] = useState('');
  const [schedule, setSchedule] = useState('');
  const [recipientRoles, setRecipientRoles] = useState('');

  if (!canManage) {
    return <AuthAlert variant="error">{t('notifications.accessDenied')}</AuthAlert>;
  }

  const rules = rulesQuery.data ?? [];
  const templates = templatesQuery.data ?? [];

  const handleCreate = async () => {
    if (!name.trim() || !eventType.trim()) return;
    await createMutation.mutateAsync({
      name: name.trim(),
      nameAr: nameAr.trim() || undefined,
      eventType: eventType.trim(),
      channel,
      templateId: templateId || undefined,
      schedule: schedule.trim() || undefined,
      recipientRoles: recipientRoles
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    });
    setShowForm(false);
    setName('');
    setNameAr('');
    setEventType('');
    setSchedule('');
    setRecipientRoles('');
    setTemplateId('');
  };

  return (
    <div className={styles.content}>
      {rulesQuery.isError && <AuthAlert variant="error">{t('notifications.loadError')}</AuthAlert>}

      <section className={styles.panel} aria-labelledby="automation-title">
        <div className={styles.toolbar}>
          <h2 id="automation-title" className={styles.panelTitle}>
            {t('notifications.automation.title')}
          </h2>
          <AuthButton variant="secondary" onClick={() => setShowForm((v) => !v)}>
            {t('notifications.automation.create')}
          </AuthButton>
        </div>

        {showForm && (
          <form
            className={styles.formStack}
            onSubmit={(e) => {
              e.preventDefault();
              void handleCreate();
            }}
          >
            <AuthFormField label={t('notifications.automation.name')} id="rule-name">
              <input id="rule-name" className={styles.input} value={name} onChange={(e) => setName(e.target.value)} required />
            </AuthFormField>
            <AuthFormField label={t('notifications.automation.nameAr')} id="rule-name-ar">
              <input id="rule-name-ar" className={styles.input} value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
            </AuthFormField>
            <AuthFormField label={t('notifications.automation.eventType')} id="rule-event">
              <input
                id="rule-event"
                className={styles.input}
                list="automation-event-types"
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                required
              />
              <datalist id="automation-event-types">
                {AUTOMATION_EVENT_TYPES.map((ev) => (
                  <option key={ev} value={ev} />
                ))}
              </datalist>
            </AuthFormField>
            <AuthFormField label={t('notifications.automation.channel')} id="rule-channel">
              <select id="rule-channel" className={styles.select} value={channel} onChange={(e) => setChannel(e.target.value)}>
                {NOTIFICATION_CHANNELS.map((ch) => (
                  <option key={ch} value={ch}>
                    {t(`notifications.channels_labels.${ch}`)}
                  </option>
                ))}
              </select>
            </AuthFormField>
            <AuthFormField label={t('notifications.automation.template')} id="rule-template">
              <select id="rule-template" className={styles.select} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                <option value="">—</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </option>
                ))}
              </select>
            </AuthFormField>
            <AuthFormField label={t('notifications.automation.schedule')} id="rule-schedule">
              <input id="rule-schedule" className={styles.input} value={schedule} onChange={(e) => setSchedule(e.target.value)} />
            </AuthFormField>
            <AuthFormField label={t('notifications.automation.recipientRoles')} id="rule-roles">
              <input id="rule-roles" className={styles.input} value={recipientRoles} onChange={(e) => setRecipientRoles(e.target.value)} />
            </AuthFormField>
            <AuthButton type="submit" loading={createMutation.isPending}>
              {t('notifications.automation.save')}
            </AuthButton>
          </form>
        )}

        {rulesQuery.isLoading ? (
          <WidgetSkeleton span="full" />
        ) : rules.length === 0 ? (
          <p className={styles.empty}>{t('notifications.automation.empty')}</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t('notifications.automation.name')}</th>
                  <th scope="col">{t('notifications.automation.eventType')}</th>
                  <th scope="col">{t('notifications.automation.channel')}</th>
                  <th scope="col">{t('notifications.automation.template')}</th>
                  <th scope="col">{t('notifications.automation.active')}</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id}>
                    <td>{rule.name}</td>
                    <td>
                      <code>{rule.eventType}</code>
                    </td>
                    <td>{t(`notifications.channels_labels.${rule.channel.toLowerCase().replace('_', '-')}` as const)}</td>
                    <td>{rule.template?.name ?? '—'}</td>
                    <td>
                      <label className={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={rule.isActive}
                          onChange={(e) =>
                            void updateMutation.mutateAsync({
                              ruleId: rule.id,
                              input: { isActive: e.target.checked },
                            })
                          }
                          aria-label={`${t('notifications.automation.active')}: ${rule.name}`}
                        />
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
