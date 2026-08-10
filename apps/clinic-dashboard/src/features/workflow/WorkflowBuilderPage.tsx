import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Square, ZoomIn, ZoomOut } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { buildWorkflowPermCheck, canCreateWorkflows, type WorkflowStepDef } from './config/workflow-config';
import { useCreateTemplate, useCreateWorkflow } from './hooks/useWorkflows';
import { WorkflowCanvas } from './components/WorkflowCanvas';
import { WorkflowStepEditor } from './components/WorkflowStepEditor';
import { WorkflowPageHeader } from './components/enterprise/WorkflowPageHeader';
import { WorkflowSection } from './components/enterprise/WorkflowSection';
import { WorkflowPipelineDiagram } from './components/enterprise/WorkflowPipelineDiagram';
import { validateWorkflowBlueprint } from './lib/validate-workflow-blueprint';
import e from './workflow-enterprise.module.css';
import wfStyles from './workflow-layout.module.css';

function newStep(): WorkflowStepDef {
  return { id: crypto.randomUUID(), type: 'task', labelEn: '', labelAr: '' };
}

export function WorkflowBuilderPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { user } = useAuth();
  const perm = useMemo(() => buildWorkflowPermCheck(user?.roles ?? []), [user?.roles]);
  const createMutation = useCreateWorkflow();
  const createTemplateMutation = useCreateTemplate();

  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [descriptionAr] = useState('');
  const [steps, setSteps] = useState<WorkflowStepDef[]>([
    { id: crypto.randomUUID(), type: 'task', labelEn: 'Review', labelAr: 'مراجعة' },
    { id: crypto.randomUUID(), type: 'approval', labelEn: 'Approve', labelAr: 'موافقة' },
    { id: crypto.randomUUID(), type: 'task', labelEn: 'Complete', labelAr: 'إكمال' },
  ]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(0);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [simulateMode, setSimulateMode] = useState(false);
  const [simulateStep, setSimulateStep] = useState(0);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [zoom, setZoom] = useState(1);

  if (!canCreateWorkflows(perm)) {
    return <AuthAlert variant="error">{t('workflow.accessDenied')}</AuthAlert>;
  }

  const selectedStep = selectedIndex != null ? steps[selectedIndex] : null;
  const stepLabels = useMemo(
    () => steps.filter((s) => s.labelEn.trim()).map((s) => s.labelEn.trim()),
    [steps],
  );

  const handleReorder = (fromIndex: number, toIndex: number) => {
    setSteps((current) => {
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    setSelectedIndex(toIndex);
  };

  const handlePublish = async () => {
    const errors = validateWorkflowBlueprint({ nameEn, nameAr, steps });
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors([]);
    const cleaned = steps.filter((s) => s.labelEn.trim());
    const stepLabels = cleaned.map((s) => s.labelEn.trim());
    if (saveAsTemplate) {
      await createTemplateMutation.mutateAsync({
        key: nameEn.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 80),
        nameEn: nameEn.trim(),
        nameAr: nameAr.trim(),
        descriptionEn: descriptionEn.trim() || nameEn.trim(),
        descriptionAr: descriptionAr.trim() || nameAr.trim(),
        triggerType: 'patient.registered',
        steps: cleaned,
      });
      navigate('/workflows/templates');
      return;
    }
    const result = await createMutation.mutateAsync({
      nameEn: nameEn.trim(),
      nameAr: nameAr.trim(),
      descriptionEn: descriptionEn.trim() || nameEn.trim(),
      descriptionAr: descriptionAr.trim() || nameAr.trim(),
      steps: stepLabels,
    });
    navigate(`/workflows/instances/${result.workflowId}`);
  };

  return (
    <>
      <WorkflowPageHeader
        title={t('workflow.nav.builder')}
        subtitle={t('workflow.enterprise.builderHint')}
        actions={
          <>
            <AuthButton type="button" variant="secondary" onClick={() => setPreviewMode((v) => !v)}>
              {previewMode ? t('workflow.builder.edit') : t('workflow.builder.preview')}
            </AuthButton>
            <AuthButton
              type="button"
              variant="secondary"
              onClick={() => {
                setSimulateMode((v) => {
                  if (v) setSimulateStep(0);
                  return !v;
                });
                setPreviewMode(false);
              }}
            >
              {simulateMode ? <Square size={16} aria-hidden /> : <Play size={16} aria-hidden />}
              {simulateMode ? t('workflow.builder.edit') : t('workflow.enterprise.simulate')}
            </AuthButton>
            <AuthButton type="button" variant="secondary" onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}>
              <ZoomIn size={16} aria-hidden /> {t('workflow.enterprise.zoomIn')}
            </AuthButton>
            <AuthButton type="button" variant="secondary" onClick={() => setZoom((z) => Math.max(0.7, z - 0.1))}>
              <ZoomOut size={16} aria-hidden /> {t('workflow.enterprise.zoomOut')}
            </AuthButton>
          </>
        }
      />

      {previewMode && <p className={wfStyles.builderPreviewBanner}>{t('workflow.builder.previewHint')}</p>}
      {simulateMode && (
        <>
          <p className={e.simulateBanner}>{t('workflow.enterprise.simulateHint')}</p>
          <WorkflowSection title={t('workflow.enterprise.simulate')}>
            <WorkflowPipelineDiagram
              steps={stepLabels.length ? stepLabels : [t('workflow.builder.untitledStep')]}
              currentStepIndex={simulateStep}
              status={simulateStep >= stepLabels.length - 1 && stepLabels.length > 0 ? 'completed' : 'active'}
            />
            <div className={e.pageActions} style={{ marginTop: 'var(--space-4)' }}>
              <AuthButton
                type="button"
                variant="secondary"
                disabled={simulateStep <= 0}
                onClick={() => setSimulateStep((s) => Math.max(0, s - 1))}
              >
                {t('workflow.detail.currentStep')} −
              </AuthButton>
              <AuthButton
                type="button"
                variant="secondary"
                disabled={stepLabels.length === 0 || simulateStep >= stepLabels.length - 1}
                onClick={() => setSimulateStep((s) => Math.min(stepLabels.length - 1, s + 1))}
              >
                {t('workflow.detail.advance')}
              </AuthButton>
            </div>
          </WorkflowSection>
        </>
      )}

      {validationErrors.length > 0 && (
        <ul className={wfStyles.builderValidationErrors}>
          {validationErrors.map((key) => (
            <li key={key}>{t(`workflow.builder.validation.${key}`, key)}</li>
          ))}
        </ul>
      )}

      <WorkflowSection title={t('workflow.builder.canvas')}>
        <div className={e.builderShell}>
          <div className={e.builderViewport}>
            <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform 0.2s ease' }}>
              <WorkflowCanvas
                steps={steps}
                selectedIndex={selectedIndex}
                onSelect={setSelectedIndex}
                onReorder={previewMode || simulateMode ? undefined : handleReorder}
                readOnly={previewMode || simulateMode}
              />
            </div>
            <div className={e.builderMinimap} aria-hidden>
              {steps.length} {t('workflow.builder.steps')}
            </div>
          </div>

          {!previewMode && !simulateMode && (
            <div className={wfStyles.builderGrid}>
              <div>
                {selectedStep && selectedIndex != null && (
                  <WorkflowStepEditor
                    step={selectedStep}
                    index={selectedIndex}
                    canRemove={steps.length > 1}
                    onChange={(updated) =>
                      setSteps((s) => s.map((step, i) => (i === selectedIndex ? updated : step)))
                    }
                    onRemove={() => {
                      setSteps((s) => s.filter((_, i) => i !== selectedIndex));
                      setSelectedIndex(null);
                    }}
                  />
                )}
                <AuthButton
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setSteps((s) => [...s, newStep()]);
                    setSelectedIndex(steps.length);
                  }}
                >
                  {t('workflow.builder.addStep')}
                </AuthButton>
              </div>
            </div>
          )}
        </div>
      </WorkflowSection>

      {!previewMode && !simulateMode && (
        <WorkflowSection title={t('workflow.builder.create')}>
          <form
            className={e.filterRow}
            style={{ flexDirection: 'column', alignItems: 'stretch' }}
            onSubmit={(ev) => {
              ev.preventDefault();
              void handlePublish();
            }}
          >
            <AuthFormField label={t('workflow.builder.nameEn')} id="wf-name-en">
              <input id="wf-name-en" className={e.input} value={nameEn} onChange={(ev) => setNameEn(ev.target.value)} required />
            </AuthFormField>
            <AuthFormField label={t('workflow.builder.nameAr')} id="wf-name-ar">
              <input id="wf-name-ar" className={e.input} value={nameAr} onChange={(ev) => setNameAr(ev.target.value)} required dir="rtl" />
            </AuthFormField>
            <AuthFormField label={t('workflow.builder.descriptionEn')} id="wf-desc-en">
              <textarea id="wf-desc-en" className={e.input} rows={3} value={descriptionEn} onChange={(ev) => setDescriptionEn(ev.target.value)} />
            </AuthFormField>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 'var(--text-sm)' }}>
              <input type="checkbox" checked={saveAsTemplate} onChange={(ev) => setSaveAsTemplate(ev.target.checked)} />
              {t('workflow.builder.saveAsTemplate')}
            </label>
            <AuthButton type="submit" loading={createMutation.isPending || createTemplateMutation.isPending}>
              {saveAsTemplate ? t('workflow.builder.saveTemplate') : t('workflow.builder.create')}
            </AuthButton>
          </form>
        </WorkflowSection>
      )}
    </>
  );
}
