import { Star } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import type { AiPromptDto } from '../../api/ai-api';
import { AI_PROMPT_CATEGORIES } from '../../config/ai-prompt-categories.config';
import e from '../../ai-enterprise.module.css';

interface AiPromptCardProps {
  prompt: AiPromptDto;
  canManage: boolean;
  onRun: (prompt: AiPromptDto) => void;
  onEdit: (prompt: AiPromptDto) => void;
  onToggleFavorite: (prompt: AiPromptDto) => void;
  onDuplicate: (promptId: string) => void;
  onDelete: (prompt: AiPromptDto) => void;
  onVersions: (prompt: AiPromptDto) => void;
  busy?: boolean;
}

export function AiPromptCard({
  prompt,
  canManage,
  onRun,
  onEdit,
  onToggleFavorite,
  onDuplicate,
  onDelete,
  onVersions,
  busy,
}: AiPromptCardProps) {
  const { t, locale } = useI18n();
  const title = locale.startsWith('ar') && prompt.titleAr ? prompt.titleAr : prompt.titleEn;
  const body = locale.startsWith('ar') && prompt.bodyAr ? prompt.bodyAr : prompt.bodyEn;
  const categoryDef = AI_PROMPT_CATEGORIES.find((c) => c.id === prompt.category);
  const categoryLabel = categoryDef ? t(categoryDef.labelKey as never) : prompt.category;

  return (
    <article className={e.workspaceCard}>
      <div className={e.pageActions} style={{ justifyContent: 'space-between' }}>
        <span className={e.sectionHint}>{categoryLabel}</span>
        <button
          type="button"
          className={e.promptChip}
          aria-label={t('ai.prompts.favorite')}
          aria-pressed={prompt.favorite}
          onClick={() => onToggleFavorite(prompt)}
          disabled={busy}
        >
          <Star size={14} fill={prompt.favorite ? 'currentColor' : 'none'} />
        </button>
      </div>
      <strong>{title}</strong>
      <p className={e.pageSubtitle}>{body}</p>
      <div className={e.pageActions}>
        {prompt.isTenantDefault && <span className={e.badge}>{t('ai.prompts.tenantDefault')}</span>}
        {prompt.roles.length > 0 && (
          <span className={e.badge}>{prompt.roles.slice(0, 2).join(', ')}</span>
        )}
        <span className={e.sectionHint}>v{prompt.version}</span>
      </div>
      <div className={e.pageActions}>
        <AuthButton variant="primary" onClick={() => onRun(prompt)} disabled={busy}>
          {t('ai.prompts.run')}
        </AuthButton>
        {canManage && (
          <AuthButton variant="secondary" onClick={() => onEdit(prompt)} disabled={busy}>
            {t('ai.prompts.edit')}
          </AuthButton>
        )}
        {canManage && (
          <AuthButton variant="secondary" onClick={() => onVersions(prompt)} disabled={busy}>
            {t('ai.prompts.versionHistory')}
          </AuthButton>
        )}
        {canManage && (
          <AuthButton variant="secondary" onClick={() => onDuplicate(prompt.promptId)} disabled={busy}>
            {t('ai.prompts.duplicate')}
          </AuthButton>
        )}
        {canManage && (
          <AuthButton variant="secondary" onClick={() => onDelete(prompt)} disabled={busy}>
            {t('ai.prompts.delete')}
          </AuthButton>
        )}
      </div>
    </article>
  );
}
