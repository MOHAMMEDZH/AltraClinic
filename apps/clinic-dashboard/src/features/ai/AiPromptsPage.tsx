import { useMemo, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import type { AiPromptDto } from './api/ai-api';
import { AiPromptCard } from './components/prompts/AiPromptCard';
import { AiPromptEditor } from './components/prompts/AiPromptEditor';
import { AiPromptVersionPanel } from './components/prompts/AiPromptVersionPanel';
import { AiModal } from './components/enterprise/AiModal';
import { AiSection } from './components/enterprise/AiSection';
import { AI_PROMPT_CATEGORIES } from './config/ai-prompt-categories.config';
import {
  useAiPrompts,
  useDeleteAiPrompt,
  useDuplicateAiPrompt,
  useSaveAiPrompt,
  useToggleAiPromptFavorite,
} from './hooks/useAiPrompts';
import { useRunSmartAction } from './hooks/useRunSmartAction';
import { useAiSubscription } from './hooks/useAiSubscription';
import e from './ai-enterprise.module.css';

export function AiPromptsPage() {
  const { t, locale } = useI18n();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AiPromptDto | null>(null);
  const [versionPrompt, setVersionPrompt] = useState<AiPromptDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AiPromptDto | null>(null);

  const promptsQuery = useAiPrompts(category || undefined, search, favoritesOnly);
  const saveMutation = useSaveAiPrompt();
  const deleteMutation = useDeleteAiPrompt();
  const duplicateMutation = useDuplicateAiPrompt();
  const favoriteMutation = useToggleAiPromptFavorite();
  const { runPrompt, isPending: runPending } = useRunSmartAction();
  const { canCreateCustomPrompts } = useAiSubscription();

  const busy =
    saveMutation.isPending ||
    deleteMutation.isPending ||
    duplicateMutation.isPending ||
    favoriteMutation.isPending ||
    runPending;

  const grouped = useMemo(() => {
    const items = promptsQuery.data ?? [];
    if (category) return [{ id: category, items }];
    const map = new Map<string, AiPromptDto[]>();
    for (const p of items) {
      const list = map.get(p.category) ?? [];
      list.push(p);
      map.set(p.category, list);
    }
    return AI_PROMPT_CATEGORIES.map((c) => ({ id: c.id, items: map.get(c.id) ?? [] })).filter(
      (g) => g.items.length > 0,
    );
  }, [promptsQuery.data, category]);

  const openCreate = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const openEdit = (prompt: AiPromptDto) => {
    setEditing(prompt);
    setEditorOpen(true);
  };

  return (
    <>
      <header className={e.pageHeader}>
        <div>
          <h2 className={e.pageTitle}>{t('ai.nav.prompts')}</h2>
          <p className={e.pageSubtitle}>{t('ai.prompts.subtitle')}</p>
        </div>
        {canCreateCustomPrompts && (
          <AuthButton variant="primary" onClick={openCreate}>
            {t('ai.prompts.create')}
          </AuthButton>
        )}
      </header>

      <AiSection title={t('ai.prompts.library')} hint={t('ai.prompts.libraryHint')}>
        <div className={e.filterRow}>
          <input
            className={e.input}
            value={search}
            onChange={(ev) => setSearch(ev.target.value)}
            placeholder={t('ai.chat.search')}
            aria-label={t('ai.prompts.search')}
          />
          <label className={e.sectionHint}>
            <input
              type="checkbox"
              checked={favoritesOnly}
              onChange={(ev) => setFavoritesOnly(ev.target.checked)}
            />{' '}
            {t('ai.prompts.favoritesOnly')}
          </label>
        </div>
        <div className={e.promptChips}>
          <button
            type="button"
            className={[e.promptChip, !category ? e.promptChipActive : ''].filter(Boolean).join(' ')}
            aria-pressed={!category}
            onClick={() => setCategory('')}
          >
            {t('ai.prompts.allCategories')}
          </button>
          {AI_PROMPT_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={[e.promptChip, category === cat.id ? e.promptChipActive : '']
                .filter(Boolean)
                .join(' ')}
              aria-pressed={category === cat.id}
              onClick={() => setCategory(cat.id)}
            >
              {t(cat.labelKey as never)}
            </button>
          ))}
        </div>

        {grouped.length === 0 ? (
          <p className={e.sectionHint}>{t('ai.prompts.empty')}</p>
        ) : (
          grouped.map((group) => (
            <div key={group.id}>
              {!category && (
                <h3 className={e.sectionHint}>
                  {t(
                    (AI_PROMPT_CATEGORIES.find((c) => c.id === group.id)?.labelKey ??
                      'ai.prompts.category') as never,
                  )}
                </h3>
              )}
              <div className={e.workspaceGrid}>
                {group.items.map((p) => (
                  <AiPromptCard
                    key={p.promptId}
                    prompt={p}
                    canManage={canCreateCustomPrompts}
                    busy={busy}
                    onRun={(prompt) => {
                      const body = locale.startsWith('ar') && prompt.bodyAr ? prompt.bodyAr : prompt.bodyEn;
                      const title =
                        locale.startsWith('ar') && prompt.titleAr ? prompt.titleAr : prompt.titleEn;
                      void runPrompt(body, { title });
                    }}
                    onEdit={openEdit}
                    onToggleFavorite={(prompt) =>
                      void favoriteMutation.mutateAsync({
                        promptId: prompt.promptId,
                        favorite: !prompt.favorite,
                      })
                    }
                    onDuplicate={(id) => void duplicateMutation.mutateAsync(id)}
                    onDelete={setDeleteTarget}
                    onVersions={setVersionPrompt}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </AiSection>

      {!canCreateCustomPrompts && (
        <AuthAlert variant="warning">{t('ai.subscription.customPromptsLocked')}</AuthAlert>
      )}

      <AiPromptEditor
        open={editorOpen}
        initial={editing}
        saving={saveMutation.isPending}
        onClose={() => setEditorOpen(false)}
        onSave={async (draft) => {
          await saveMutation.mutateAsync({
            promptId: draft.promptId,
            category: draft.category,
            titleEn: draft.titleEn,
            titleAr: draft.titleAr || undefined,
            bodyEn: draft.bodyEn,
            bodyAr: draft.bodyAr || undefined,
            favorite: draft.favorite,
            roles: draft.roles,
            isTenantDefault: draft.isTenantDefault,
          });
        }}
      />

      {versionPrompt && (
        <AiPromptVersionPanel
          promptId={versionPrompt.promptId}
          title={locale.startsWith('ar') && versionPrompt.titleAr ? versionPrompt.titleAr : versionPrompt.titleEn}
          onClose={() => setVersionPrompt(null)}
        />
      )}

      {deleteTarget && (
        <AiModal open onClose={() => setDeleteTarget(null)} label={t('ai.prompts.confirmDelete')} maxWidth={420}>
          <p>{t('ai.prompts.confirmDelete')}</p>
          <div className={e.pageActions}>
            <AuthButton variant="secondary" onClick={() => setDeleteTarget(null)}>
              {t('ai.prompts.cancel')}
            </AuthButton>
            <AuthButton
              variant="primary"
              loading={deleteMutation.isPending}
              loadingLabel={t('ai.a11y.deleting')}
              onClick={() =>
                void deleteMutation.mutateAsync(deleteTarget.promptId).then(() => setDeleteTarget(null))
              }
            >
              {t('ai.prompts.delete')}
            </AuthButton>
          </div>
        </AiModal>
      )}
    </>
  );
}
