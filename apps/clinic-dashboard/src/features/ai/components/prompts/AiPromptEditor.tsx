import { useEffect, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import type { AiPromptDto } from '../../api/ai-api';
import { AI_PROMPT_CATEGORIES, AI_PROMPT_ROLE_OPTIONS } from '../../config/ai-prompt-categories.config';
import { AiModal } from '../enterprise/AiModal';
import e from '../../ai-enterprise.module.css';

export type AiPromptDraft = {
  promptId?: string;
  category: string;
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
  favorite: boolean;
  roles: string[];
  isTenantDefault: boolean;
};

const emptyDraft = (): AiPromptDraft => ({
  category: 'medical',
  titleEn: '',
  titleAr: '',
  bodyEn: '',
  bodyAr: '',
  favorite: false,
  roles: [],
  isTenantDefault: false,
});

interface AiPromptEditorProps {
  open: boolean;
  initial?: AiPromptDto | null;
  onClose: () => void;
  onSave: (draft: AiPromptDraft) => Promise<void>;
  saving?: boolean;
}

export function AiPromptEditor({ open, initial, onClose, onSave, saving }: AiPromptEditorProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [draft, setDraft] = useState<AiPromptDraft>(emptyDraft());

  const isAdmin = (user?.roles ?? []).some((r) =>
    ['owner', 'general_manager', 'super_admin'].includes(r),
  );

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setDraft({
        promptId: initial.promptId,
        category: initial.category,
        titleEn: initial.titleEn,
        titleAr: initial.titleAr ?? '',
        bodyEn: initial.bodyEn,
        bodyAr: initial.bodyAr ?? '',
        favorite: initial.favorite,
        roles: initial.roles ?? [],
        isTenantDefault: initial.isTenantDefault,
      });
    } else {
      setDraft(emptyDraft());
    }
  }, [open, initial]);

  if (!open) return null;

  const title = initial ? t('ai.prompts.edit') : t('ai.prompts.create');

  return (
    <AiModal open={open} onClose={onClose} label={title} maxWidth={640}>
      <header className={e.sidebarHeader}>
        <strong>{title}</strong>
        <button type="button" className={e.promptChip} onClick={onClose} aria-label={t('ai.a11y.closeDialog')}>
          ×
        </button>
      </header>
      <form
        className={e.shell}
        onSubmit={(ev) => {
          ev.preventDefault();
          void onSave(draft).then(onClose);
        }}
      >
          <AuthFormField label={t('ai.prompts.category')} id="prompt-category">
            <select
              id="prompt-category"
              className={e.input}
              value={draft.category}
              onChange={(ev) => setDraft((d) => ({ ...d, category: ev.target.value }))}
            >
              {AI_PROMPT_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {t(cat.labelKey as never)}
                </option>
              ))}
            </select>
          </AuthFormField>
          <AuthFormField label={t('ai.admin.nameEn')} id="prompt-title-en">
            <input
              id="prompt-title-en"
              className={e.input}
              value={draft.titleEn}
              onChange={(ev) => setDraft((d) => ({ ...d, titleEn: ev.target.value }))}
              required
            />
          </AuthFormField>
          <AuthFormField label={t('ai.admin.nameAr')} id="prompt-title-ar">
            <input
              id="prompt-title-ar"
              className={e.input}
              value={draft.titleAr}
              onChange={(ev) => setDraft((d) => ({ ...d, titleAr: ev.target.value }))}
            />
          </AuthFormField>
          <AuthFormField label={t('ai.prompts.body')} id="prompt-body-en">
            <textarea
              id="prompt-body-en"
              className={e.input}
              rows={4}
              value={draft.bodyEn}
              onChange={(ev) => setDraft((d) => ({ ...d, bodyEn: ev.target.value }))}
              required
            />
          </AuthFormField>
          <AuthFormField label={t('ai.prompts.bodyAr')} id="prompt-body-ar">
            <textarea
              id="prompt-body-ar"
              className={e.input}
              rows={4}
              value={draft.bodyAr}
              onChange={(ev) => setDraft((d) => ({ ...d, bodyAr: ev.target.value }))}
            />
          </AuthFormField>
          <AuthFormField label={t('ai.prompts.roles')} id="prompt-roles">
            <div className={e.promptChips}>
              {AI_PROMPT_ROLE_OPTIONS.map((role) => {
                const active = draft.roles.includes(role);
                return (
                  <button
                    key={role}
                    type="button"
                    className={[e.promptChip, active ? e.promptChipActive : ''].filter(Boolean).join(' ')}
                    aria-pressed={active}
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        roles: active ? d.roles.filter((r) => r !== role) : [...d.roles, role],
                      }))
                    }
                  >
                    {role}
                  </button>
                );
              })}
            </div>
          </AuthFormField>
          <label className={e.sectionHint}>
            <input
              type="checkbox"
              checked={draft.favorite}
              onChange={(ev) => setDraft((d) => ({ ...d, favorite: ev.target.checked }))}
            />{' '}
            {t('ai.prompts.favorite')}
          </label>
          {isAdmin && (
            <label className={e.sectionHint}>
              <input
                type="checkbox"
                checked={draft.isTenantDefault}
                onChange={(ev) => setDraft((d) => ({ ...d, isTenantDefault: ev.target.checked }))}
              />{' '}
              {t('ai.prompts.tenantDefault')}
            </label>
          )}
          <div className={e.pageActions}>
            <AuthButton type="button" variant="secondary" onClick={onClose}>
              {t('ai.prompts.cancel')}
            </AuthButton>
            <AuthButton type="submit" loading={saving}>
              {t('ai.prompts.save')}
            </AuthButton>
          </div>
        </form>
    </AiModal>
  );
}
