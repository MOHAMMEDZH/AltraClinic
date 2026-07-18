import { useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { formatEncounterDate } from '../config/emr-config';
import { useCreatePatientProblem, usePatientProblems, useResolvePatientProblem } from '../hooks/useEmr';
import styles from './ProblemListPanel.module.css';

interface ProblemListPanelProps {
  patientId: string;
  readOnly?: boolean;
}

export function ProblemListPanel({ patientId, readOnly }: ProblemListPanelProps) {
  const { t, locale } = useI18n();
  const problemsQuery = usePatientProblems(patientId);
  const createMutation = useCreatePatientProblem(patientId);
  const resolveMutation = useResolvePatientProblem(patientId);

  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [showForm, setShowForm] = useState(false);

  const active = (problemsQuery.data ?? []).filter((p) => p.status === 'active');
  const resolved = (problemsQuery.data ?? []).filter((p) => p.status === 'resolved');

  async function handleAdd() {
    if (!description.trim()) return;
    await createMutation.mutateAsync({
      description: description.trim(),
      code: code.trim() || undefined,
    });
    setDescription('');
    setCode('');
    setShowForm(false);
  }

  return (
    <section className={styles.panel} aria-label={t('emr.problems.title')}>
      {!readOnly && (
        <div className={styles.toolbar}>
          {!showForm ? (
            <AuthButton variant="secondary" onClick={() => setShowForm(true)}>
              {t('emr.problems.add')}
            </AuthButton>
          ) : (
            <div className={styles.form}>
              <AuthFormField
                id="problem-desc"
                label={t('emr.problems.description')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <AuthFormField
                id="problem-code"
                label={t('emr.problems.code')}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <div className={styles.formActions}>
                <AuthButton loading={createMutation.isPending} onClick={() => void handleAdd()}>
                  {t('emr.problems.save')}
                </AuthButton>
                <AuthButton variant="ghost" onClick={() => setShowForm(false)}>
                  {t('emr.form.cancel')}
                </AuthButton>
              </div>
            </div>
          )}
        </div>
      )}

      {problemsQuery.isLoading ? (
        <p className={styles.empty}>{t('emr.audit.loading')}</p>
      ) : !active.length && !resolved.length ? (
        <p className={styles.empty}>{t('emr.problems.empty')}</p>
      ) : (
        <>
          {active.length > 0 && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>{t('emr.problems.active')}</h3>
              <ul className={styles.list}>
                {active.map((p) => (
                  <li key={p.id} className={styles.item}>
                    <div>
                      <p className={styles.desc}>{p.description}</p>
                      {p.code && <p className={styles.code}>{p.code}</p>}
                      <p className={styles.meta}>
                        {p.onsetDate ? formatEncounterDate(p.onsetDate, locale) : t('emr.problems.noOnset')}
                      </p>
                    </div>
                    {!readOnly && (
                      <AuthButton
                        variant="ghost"
                        loading={resolveMutation.isPending}
                        onClick={() => void resolveMutation.mutateAsync(p.id)}
                      >
                        {t('emr.problems.resolve')}
                      </AuthButton>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {resolved.length > 0 && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>{t('emr.problems.resolved')}</h3>
              <ul className={styles.list}>
                {resolved.map((p) => (
                  <li key={p.id} className={[styles.item, styles.resolved].join(' ')}>
                    <div>
                      <p className={styles.desc}>{p.description}</p>
                      {p.resolvedAt && (
                        <p className={styles.meta}>{formatEncounterDate(p.resolvedAt, locale)}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
