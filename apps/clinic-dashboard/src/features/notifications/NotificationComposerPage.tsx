import { useMemo, useState } from 'react';

import { useI18n } from '@booking/i18n/react';

import { useAuth } from '@/app/providers/AuthProvider';

import { AuthAlert } from '@/features/auth/components/AuthAlert';

import { AuthButton } from '@/features/auth/components/AuthButton';

import { AuthFormField } from '@/features/auth/components/AuthFormField';

import { RecipientPicker } from './components/RecipientPicker';

import {

  buildNotificationsPermCheck,

  canCreateNotifications,

  NOTIFICATION_CHANNELS,

  NOTIFICATION_PRIORITIES,

} from './config/notifications-config';

import {

  useComposeNotification,

  useNotificationTemplates,

  useSaveNotificationDraft,

} from './hooks/useNotifications';

import styles from './notifications-layout.module.css';



export function NotificationComposerPage() {

  const { t } = useI18n();

  const { user } = useAuth();

  const perm = useMemo(() => buildNotificationsPermCheck(user?.roles ?? []), [user?.roles]);

  const canCreate = canCreateNotifications(perm);



  const templatesQuery = useNotificationTemplates(undefined, canCreate);

  const composeMutation = useComposeNotification();

  const saveDraftMutation = useSaveNotificationDraft();



  const [channel, setChannel] = useState<string>('in-app');

  const [recipients, setRecipients] = useState<string[]>([]);

  const [templateId, setTemplateId] = useState('');

  const [title, setTitle] = useState('');

  const [body, setBody] = useState('');

  const [priority, setPriority] = useState('medium');

  const [scheduledAt, setScheduledAt] = useState('');

  const [success, setSuccess] = useState(false);

  const [draftSaved, setDraftSaved] = useState(false);



  if (!canCreate) {

    return <AuthAlert variant="error">{t('notifications.accessDenied')}</AuthAlert>;

  }



  const templates = templatesQuery.data ?? [];



  const applyTemplate = (id: string) => {

    setTemplateId(id);

    const template = templates.find((tpl) => tpl.id === id);

    if (template) {

      setChannel(template.channel.toLowerCase().replace('_', '-'));

      setTitle(template.subjectEn);

      setBody(template.bodyEn);

    }

  };



  const buildPayload = () => ({

    recipientIds: recipients,

    channel,

    title: title.trim(),

    body: body.trim(),

    priority,

    templateId: templateId || undefined,

    scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,

  });



  const handleSend = async () => {

    const payload = buildPayload();

    if (!payload.recipientIds.length || !payload.title || !payload.body) return;

    await composeMutation.mutateAsync(payload);

    setSuccess(true);

    setDraftSaved(false);

    setRecipients([]);

    setTitle('');

    setBody('');

    setTemplateId('');

    setScheduledAt('');

    setPriority('medium');

  };



  const handleSaveDraft = async () => {

    const payload = buildPayload();

    if (!payload.recipientIds.length || !payload.title || !payload.body) return;

    await saveDraftMutation.mutateAsync({

      recipientIds: payload.recipientIds,

      channel: payload.channel,

      title: payload.title,

      body: payload.body,

      templateId: payload.templateId,

      scheduledAt: payload.scheduledAt,

    });

    setDraftSaved(true);

    setSuccess(false);

  };



  return (

    <div className={styles.content}>

      {composeMutation.isError && <AuthAlert variant="error">{t('notifications.loadError')}</AuthAlert>}

      {saveDraftMutation.isError && <AuthAlert variant="error">{t('notifications.saveError')}</AuthAlert>}

      {success && (

        <AuthAlert variant="success">{t('notifications.sendSuccess')}</AuthAlert>

      )}

      {draftSaved && (

        <AuthAlert variant="success">{t('notifications.drafts.saveSuccess')}</AuthAlert>

      )}



      <section className={styles.panel} aria-labelledby="compose-title">

        <h2 id="compose-title" className={styles.panelTitle}>

          {t('notifications.compose.title')}

        </h2>



        <form

          className={styles.formStack}

          onSubmit={(e) => {

            e.preventDefault();

            void handleSend();

          }}

        >

          <AuthFormField label={t('notifications.compose.channel')} id="compose-channel">

            <select

              id="compose-channel"

              className={styles.select}

              value={channel}

              onChange={(e) => setChannel(e.target.value)}

            >

              {NOTIFICATION_CHANNELS.map((ch) => (

                <option key={ch} value={ch}>

                  {t(`notifications.channels_labels.${ch}`)}

                </option>

              ))}

            </select>

          </AuthFormField>



          <AuthFormField

            label={t('notifications.compose.recipients')}

            id="compose-recipients"

            helpText={t('notifications.compose.recipientsHint')}

          >

            <RecipientPicker id="compose-recipients" value={recipients} onChange={setRecipients} />

          </AuthFormField>



          <AuthFormField label={t('notifications.compose.template')} id="compose-template">

            <select

              id="compose-template"

              className={styles.select}

              value={templateId}

              onChange={(e) => applyTemplate(e.target.value)}

            >

              <option value="">{t('notifications.compose.noTemplate')}</option>

              {templates.map((tpl) => (

                <option key={tpl.id} value={tpl.id}>

                  {tpl.name}

                </option>

              ))}

            </select>

          </AuthFormField>



          <AuthFormField label={t('notifications.compose.priority')} id="compose-priority">

            <select

              id="compose-priority"

              className={styles.select}

              value={priority}

              onChange={(e) => setPriority(e.target.value)}

            >

              {NOTIFICATION_PRIORITIES.map((p) => (

                <option key={p} value={p}>

                  {t(`notifications.priority_labels.${p}`)}

                </option>

              ))}

            </select>

          </AuthFormField>



          <AuthFormField

            label={t('notifications.compose.scheduledAt')}

            id="compose-scheduled"

            helpText={t('notifications.compose.scheduledAtHint')}

          >

            <input

              id="compose-scheduled"

              className={styles.input}

              type="datetime-local"

              value={scheduledAt}

              onChange={(e) => setScheduledAt(e.target.value)}

            />

          </AuthFormField>



          <AuthFormField label={t('notifications.compose.subject')} id="compose-title-input">

            <input

              id="compose-title-input"

              className={styles.input}

              value={title}

              onChange={(e) => setTitle(e.target.value)}

              required

            />

          </AuthFormField>



          <AuthFormField label={t('notifications.compose.body')} id="compose-body">

            <textarea

              id="compose-body"

              className={styles.textarea}

              value={body}

              onChange={(e) => setBody(e.target.value)}

              required

            />

          </AuthFormField>



          <div className={styles.field}>

            <span className={styles.fieldLabel}>{t('notifications.compose.preview')}</span>

            <div className={styles.previewBox}>

              <strong>{title || '—'}</strong>

              {'\n\n'}

              {body || '—'}

            </div>

          </div>



          <div className={styles.rowActions}>

            <AuthButton

              type="submit"

              loading={composeMutation.isPending}

              loadingLabel={t('notifications.compose.sending')}

            >

              {t('notifications.compose.send')}

            </AuthButton>

            <AuthButton

              type="button"

              variant="secondary"

              loading={saveDraftMutation.isPending}

              loadingLabel={t('notifications.drafts.saving')}

              onClick={() => void handleSaveDraft()}

            >

              {t('notifications.compose.saveDraft')}

            </AuthButton>

          </div>

        </form>

      </section>

    </div>

  );

}

