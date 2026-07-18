import { useMemo, useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { WidgetSkeleton } from '@/features/dashboard/components/WidgetShell';
import type { NotificationTemplate } from './api/notifications-api';
import {
  buildNotificationsPermCheck,
  canManageNotifications,
  canViewNotifications,
  NOTIFICATION_CHANNELS,
} from './config/notifications-config';
import {
  useCreateNotificationTemplate,
  useNotificationTemplates,
  useTestNotificationTemplate,
  useUpdateNotificationTemplate,
} from './hooks/useNotifications';
import styles from './notifications-layout.module.css';

type DialogMode = 'create' | 'edit' | null;

const emptyForm = {
  key: '',
  name: '',
  nameAr: '',
  channel: 'email',
  subjectEn: '',
  subjectAr: '',
  bodyEn: '',
  bodyAr: '',
  variables: '',
  isActive: true,
  testRecipient: '',
};

export function NotificationTemplatesPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const perm = useMemo(() => buildNotificationsPermCheck(user?.roles ?? []), [user?.roles]);
  const canView = canViewNotifications(perm);
  const canManage = canManageNotifications(perm);

  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [editing, setEditing] = useState<NotificationTemplate | null>(null);
  const [form, setForm] = useState(emptyForm);

  const templatesQuery = useNotificationTemplates(search.trim() || undefined, canView);
  const createMutation = useCreateNotificationTemplate();
  const updateMutation = useUpdateNotificationTemplate();
  const testMutation = useTestNotificationTemplate();

  if (!canView) {
    return <AuthAlert variant="error">{t('notifications.accessDenied')}</AuthAlert>;
  }

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialog('create');
  };

  const openEdit = (template: NotificationTemplate) => {
    setEditing(template);
    setForm({
      key: template.key,
      name: template.name,
      nameAr: template.nameAr ?? '',
      channel: template.channel.toLowerCase().replace('_', '-'),
      subjectEn: template.subjectEn,
      subjectAr: template.subjectAr ?? '',
      bodyEn: template.bodyEn,
      bodyAr: template.bodyAr ?? '',
      variables: (template.variables as string[]).join(', '),
      isActive: template.isActive,
      testRecipient: '',
    });
    setDialog('edit');
  };

  const closeDialog = () => {
    setDialog(null);
    setEditing(null);
  };

  const saveTemplate = async () => {
    const variables = form.variables
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (dialog === 'create') {
      await createMutation.mutateAsync({
        key: form.key,
        name: form.name,
        nameAr: form.nameAr || undefined,
        channel: form.channel,
        subjectEn: form.subjectEn,
        subjectAr: form.subjectAr || undefined,
        bodyEn: form.bodyEn,
        bodyAr: form.bodyAr || undefined,
        variables,
      });
    } else if (editing) {
      await updateMutation.mutateAsync({
        templateId: editing.id,
        input: {
          name: form.name,
          nameAr: form.nameAr || undefined,
          subjectEn: form.subjectEn,
          subjectAr: form.subjectAr || undefined,
          bodyEn: form.bodyEn,
          bodyAr: form.bodyAr || undefined,
          variables,
          isActive: form.isActive,
        },
      });
    }
    closeDialog();
  };

  const templates = templatesQuery.data ?? [];

  return (
    <div className={styles.content}>
      {templatesQuery.isError && <AuthAlert variant="error">{t('notifications.loadError')}</AuthAlert>}

      <section className={styles.panel} aria-labelledby="templates-title">
        <div className={styles.toolbar}>
          <h2 id="templates-title" className={styles.panelTitle}>
            {t('notifications.templates.title')}
          </h2>
          {canManage && (
            <AuthButton variant="secondary" onClick={openCreate}>
              <Plus size={16} aria-hidden />
              {t('notifications.templates.create')}
            </AuthButton>
          )}
        </div>

        <input
          className={styles.input}
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('notifications.templates.search')}
          aria-label={t('notifications.templates.search')}
        />

        {templatesQuery.isLoading ? (
          <WidgetSkeleton span="full" />
        ) : templates.length === 0 ? (
          <p className={styles.empty}>{t('notifications.templates.empty')}</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t('notifications.templates.key')}</th>
                  <th scope="col">{t('notifications.templates.name')}</th>
                  <th scope="col">{t('notifications.templates.channel')}</th>
                  <th scope="col">{t('notifications.templates.active')}</th>
                  {canManage && <th scope="col">{t('notifications.inbox.columnActions')}</th>}
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr key={template.id}>
                    <td>
                      <code>{template.key}</code>
                    </td>
                    <td>{template.name}</td>
                    <td>{t(`notifications.channels_labels.${template.channel.toLowerCase().replace('_', '-')}` as const)}</td>
                    <td>{template.isActive ? '✓' : '—'}</td>
                    {canManage && (
                      <td>
                        <AuthButton variant="ghost" onClick={() => openEdit(template)} aria-label={t('notifications.templates.edit')}>
                          <Pencil size={16} aria-hidden />
                        </AuthButton>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {dialog && canManage && (
        <div className={styles.bulkDialog} role="presentation" onClick={closeDialog}>
          <div
            className={styles.bulkDialogPanel}
            role="dialog"
            aria-labelledby="template-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="template-dialog-title">
              {dialog === 'create' ? t('notifications.templates.create') : t('notifications.templates.edit')}
            </h3>

            <div className={styles.formStack}>
              {dialog === 'create' && (
                <AuthFormField label={t('notifications.templates.key')} id="tpl-key">
                  <input
                    id="tpl-key"
                    className={styles.input}
                    value={form.key}
                    onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
                    required
                  />
                </AuthFormField>
              )}

              <AuthFormField label={t('notifications.templates.name')} id="tpl-name">
                <input
                  id="tpl-name"
                  className={styles.input}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </AuthFormField>

              <AuthFormField label={t('notifications.templates.nameAr')} id="tpl-name-ar">
                <input
                  id="tpl-name-ar"
                  className={styles.input}
                  value={form.nameAr}
                  onChange={(e) => setForm((f) => ({ ...f, nameAr: e.target.value }))}
                />
              </AuthFormField>

              <AuthFormField label={t('notifications.templates.channel')} id="tpl-channel">
                <select
                  id="tpl-channel"
                  className={styles.select}
                  value={form.channel}
                  onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
                >
                  {NOTIFICATION_CHANNELS.map((ch) => (
                    <option key={ch} value={ch}>
                      {t(`notifications.channels_labels.${ch}`)}
                    </option>
                  ))}
                </select>
              </AuthFormField>

              <AuthFormField label={t('notifications.templates.subjectEn')} id="tpl-subject-en">
                <input
                  id="tpl-subject-en"
                  className={styles.input}
                  value={form.subjectEn}
                  onChange={(e) => setForm((f) => ({ ...f, subjectEn: e.target.value }))}
                  required
                />
              </AuthFormField>

              <AuthFormField label={t('notifications.templates.subjectAr')} id="tpl-subject-ar">
                <input
                  id="tpl-subject-ar"
                  className={styles.input}
                  value={form.subjectAr}
                  onChange={(e) => setForm((f) => ({ ...f, subjectAr: e.target.value }))}
                />
              </AuthFormField>

              <AuthFormField label={t('notifications.templates.bodyEn')} id="tpl-body-en">
                <textarea
                  id="tpl-body-en"
                  className={styles.textarea}
                  value={form.bodyEn}
                  onChange={(e) => setForm((f) => ({ ...f, bodyEn: e.target.value }))}
                  required
                />
              </AuthFormField>

              <AuthFormField label={t('notifications.templates.bodyAr')} id="tpl-body-ar">
                <textarea
                  id="tpl-body-ar"
                  className={styles.textarea}
                  value={form.bodyAr}
                  onChange={(e) => setForm((f) => ({ ...f, bodyAr: e.target.value }))}
                />
              </AuthFormField>

              <AuthFormField label={t('notifications.templates.variables')} id="tpl-vars">
                <input
                  id="tpl-vars"
                  className={styles.input}
                  value={form.variables}
                  onChange={(e) => setForm((f) => ({ ...f, variables: e.target.value }))}
                  placeholder="patientName, appointmentDate"
                />
              </AuthFormField>

              {dialog === 'edit' && (
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  />
                  {t('notifications.templates.active')}
                </label>
              )}

              {editing && (
                <AuthFormField label={t('notifications.templates.testRecipient')} id="tpl-test-recipient">
                  <div className={styles.actions}>
                    <input
                      id="tpl-test-recipient"
                      className={styles.input}
                      value={form.testRecipient}
                      onChange={(e) => setForm((f) => ({ ...f, testRecipient: e.target.value }))}
                    />
                    <AuthButton
                      variant="secondary"
                      loading={testMutation.isPending}
                      disabled={!form.testRecipient.trim()}
                      onClick={() =>
                        void testMutation.mutateAsync({
                          templateId: editing.id,
                          recipientId: form.testRecipient.trim(),
                        })
                      }
                    >
                      {t('notifications.templates.testSend')}
                    </AuthButton>
                  </div>
                </AuthFormField>
              )}
            </div>

            <div className={styles.actions}>
              <AuthButton variant="ghost" onClick={closeDialog}>
                {t('notifications.templates.cancel')}
              </AuthButton>
              <AuthButton
                loading={createMutation.isPending || updateMutation.isPending}
                onClick={() => void saveTemplate()}
              >
                {t('notifications.templates.save')}
              </AuthButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
