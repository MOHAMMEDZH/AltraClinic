import { useMemo, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { pickLocalizedName } from '@/features/dashboard/lib/dashboard-format';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { AI_MODEL_TYPES, buildAiPermCheck, canApproveAiModels, canCreateAiModels, canViewAi } from './config/ai-config';
import { useAiModels, useAiAdminOverview, useCreateAiModel, useDeployAiModel, useRetireAiModel, useValidateAiModel } from './hooks/useAi';
import { AiAdminDashboard } from './components/enterprise/AiAdminDashboard';
import { AiEmptyState } from './components/enterprise/AiEmptyState';
import { AiSection } from './components/enterprise/AiSection';
import { Shield } from 'lucide-react';
import e from './ai-enterprise.module.css';

export function AiAdminPage() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const perm = useMemo(() => buildAiPermCheck(user?.roles ?? []), [user?.roles]);
  const modelsQuery = useAiModels(undefined, canViewAi(perm));
  const overviewQuery = useAiAdminOverview(canApproveAiModels(perm));
  const createMutation = useCreateAiModel();
  const validateMutation = useValidateAiModel();
  const deployMutation = useDeployAiModel();
  const retireMutation = useRetireAiModel();

  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [modelType, setModelType] = useState<(typeof AI_MODEL_TYPES)[number]>('assistant');
  const [version, setVersion] = useState('1.0.0');

  if (!canViewAi(perm)) {
    return <AuthAlert variant="error">{t('ai.accessDenied')}</AuthAlert>;
  }

  const models = modelsQuery.data ?? [];

  return (
    <>
      <header className={e.pageHeader}>
        <div>
          <h2 className={e.pageTitle}>{t('ai.nav.admin')}</h2>
          <p className={e.pageSubtitle}>{t('ai.admin.subtitle')}</p>
        </div>
      </header>

      {canApproveAiModels(perm) && overviewQuery.isError && (
        <AuthAlert variant="error">{t('ai.a11y.adminLoadError')}</AuthAlert>
      )}
      {canApproveAiModels(perm) && overviewQuery.data && <AiAdminDashboard overview={overviewQuery.data} />}
      {canApproveAiModels(perm) && overviewQuery.isLoading && (
        <p className={e.pageSubtitle} role="status" aria-busy="true">
          {t('ai.a11y.loading')}
        </p>
      )}

      {canCreateAiModels(perm) && (
        <AiSection title={t('ai.admin.createModel')}>
          <form
            className={e.shell}
            onSubmit={(ev) => {
              ev.preventDefault();
              void createMutation.mutateAsync({
                nameEn,
                nameAr,
                descriptionEn: nameEn,
                descriptionAr: nameAr,
                modelType,
                version,
              });
            }}
          >
            <AuthFormField label={t('ai.admin.nameEn')} id="model-en">
              <input id="model-en" className={e.input} value={nameEn} onChange={(ev) => setNameEn(ev.target.value)} required />
            </AuthFormField>
            <AuthFormField label={t('ai.admin.nameAr')} id="model-ar">
              <input id="model-ar" className={e.input} value={nameAr} onChange={(ev) => setNameAr(ev.target.value)} required dir="rtl" />
            </AuthFormField>
            <AuthFormField label={t('ai.admin.type')} id="model-type">
              <select id="model-type" className={e.input} value={modelType} onChange={(ev) => setModelType(ev.target.value as typeof modelType)}>
                {AI_MODEL_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </AuthFormField>
            <AuthFormField label={t('ai.admin.version')} id="model-ver">
              <input id="model-ver" className={e.input} value={version} onChange={(ev) => setVersion(ev.target.value)} required />
            </AuthFormField>
            <AuthButton type="submit" loading={createMutation.isPending}>
              {t('ai.admin.create')}
            </AuthButton>
          </form>
        </AiSection>
      )}

      <AiSection title={t('ai.admin.models')} flush>
        {modelsQuery.isError ? (
          <AuthAlert variant="error">{t('ai.a11y.adminLoadError')}</AuthAlert>
        ) : modelsQuery.isLoading ? (
          <p className={e.pageSubtitle} role="status" aria-busy="true">
            {t('ai.a11y.loading')}
          </p>
        ) : models.length === 0 ? (
          <AiEmptyState icon={Shield} title={t('ai.admin.empty')} hint={t('ai.admin.emptyHint')} />
        ) : (
          <div role="list">
            {models.map((model) => (
              <div key={model.modelId} className={e.modelRow} role="listitem">
                <div>
                  <strong>{pickLocalizedName(locale, model.nameEn, model.nameAr)}</strong>
                  <p className={e.pageSubtitle}>
                    {model.modelType} · v{model.version}
                  </p>
                </div>
                <span className={[e.badge, model.status === 'deployed' ? e.badgeDeployed : e.badgeDraft].join(' ')}>
                  {model.status}
                </span>
                <div className={e.pageActions}>
                  {canApproveAiModels(perm) && model.status === 'draft' && (
                    <AuthButton variant="secondary" loading={validateMutation.isPending} onClick={() => void validateMutation.mutateAsync({ modelId: model.modelId })}>
                      {t('ai.admin.validate')}
                    </AuthButton>
                  )}
                  {canApproveAiModels(perm) && model.status === 'validated' && (
                    <AuthButton loading={deployMutation.isPending} onClick={() => void deployMutation.mutateAsync(model.modelId)}>
                      {t('ai.admin.deploy')}
                    </AuthButton>
                  )}
                  {canApproveAiModels(perm) && model.status === 'deployed' && (
                    <AuthButton variant="secondary" loading={retireMutation.isPending} onClick={() => void retireMutation.mutateAsync(model.modelId)}>
                      {t('ai.admin.retire')}
                    </AuthButton>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </AiSection>
    </>
  );
}
