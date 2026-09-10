import { FormEvent, useState } from 'react';
import { hasPermission } from '@booking/permissions';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import {
  useAvailabilityExceptions,
  useCreateAvailabilityException,
  useDeleteAvailabilityException,
  useSchedulingResources,
} from '../hooks/useScheduling';
import type {
  AvailabilityExceptionType,
  SchedulingProvider,
} from '../types/scheduling.types';
import styles from './ScheduleSettingsPanel.module.css';

const EXCEPTION_TYPES: AvailabilityExceptionType[] = [
  'PROVIDER_LEAVE',
  'BRANCH_HOLIDAY',
  'RESOURCE_MAINTENANCE',
  'EXTRA_AVAILABILITY',
];

interface BranchOption {
  id: string;
  name: string;
}

interface AvailabilityExceptionsPanelProps {
  providers: SchedulingProvider[];
  branches: BranchOption[];
}

function toIsoFromLocal(value: string): string {
  return new Date(value).toISOString();
}

export function AvailabilityExceptionsPanel({
  providers,
  branches,
}: AvailabilityExceptionsPanelProps) {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const canView = hasPermission(roles, 'api.scheduling', 'view');
  const canManage = hasPermission(roles, 'api.scheduling', 'manage');

  const listQuery = useAvailabilityExceptions();
  const createMutation = useCreateAvailabilityException();
  const deleteMutation = useDeleteAvailabilityException();
  const resourcesQuery = useSchedulingResources();

  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<AvailabilityExceptionType>('PROVIDER_LEAVE');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [branchId, setBranchId] = useState('');
  const [providerId, setProviderId] = useState('');
  const [resourceId, setResourceId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!canView) return null;

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!canManage || !startsAt || !endsAt) return;
    setError(null);
    try {
      await createMutation.mutateAsync({
        type,
        startsAt: toIsoFromLocal(startsAt),
        endsAt: toIsoFromLocal(endsAt),
        branchId: branchId || null,
        providerId: type === 'PROVIDER_LEAVE' || type === 'EXTRA_AVAILABILITY' ? providerId || null : null,
        resourceId: type === 'RESOURCE_MAINTENANCE' ? resourceId || null : null,
        reason: reason.trim() || null,
      });
      setShowForm(false);
      setReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('scheduling.exceptions.error'));
    }
  }

  const items = listQuery.data?.items ?? [];
  const resources = resourcesQuery.data?.items ?? [];

  return (
    <section className={styles.panel} aria-labelledby="availability-exceptions-heading">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' }}>
        <h2 id="availability-exceptions-heading" className={styles.title}>
          {t('scheduling.exceptions.title')}
        </h2>
        {canManage && (
          <AuthButton variant="secondary" onClick={() => setShowForm((v) => !v)}>
            {t('scheduling.exceptions.add')}
          </AuthButton>
        )}
      </div>
      <p className={styles.hint}>{t('scheduling.exceptions.hint')}</p>

      {showForm && canManage && (
        <form className={styles.field} onSubmit={(e) => void handleCreate(e)} style={{ display: 'grid', gap: '0.75rem' }}>
          {error && <AuthAlert variant="error">{error}</AuthAlert>}
          <label className={styles.field}>
            <span>{t('scheduling.exceptions.type')}</span>
            <select value={type} onChange={(e) => setType(e.target.value as AvailabilityExceptionType)}>
              {EXCEPTION_TYPES.map((tt) => (
                <option key={tt} value={tt}>
                  {t(`scheduling.exceptions.types.${tt}`)}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>{t('scheduling.exceptions.startsAt')}</span>
            <input type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </label>
          <label className={styles.field}>
            <span>{t('scheduling.exceptions.endsAt')}</span>
            <input type="datetime-local" required value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </label>
          {(type === 'BRANCH_HOLIDAY' || type === 'EXTRA_AVAILABILITY') && (
            <label className={styles.field}>
              <span>{t('scheduling.filter.branch')}</span>
              <select value={branchId} onChange={(e) => setBranchId(e.target.value)} required={type === 'BRANCH_HOLIDAY'}>
                <option value="">{t('scheduling.filter.allBranches')}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>
          )}
          {(type === 'PROVIDER_LEAVE' || type === 'EXTRA_AVAILABILITY') && (
            <label className={styles.field}>
              <span>{t('scheduling.form.provider')}</span>
              <select value={providerId} onChange={(e) => setProviderId(e.target.value)} required={type === 'PROVIDER_LEAVE'}>
                <option value="">{t('scheduling.filter.allProviders')}</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
          )}
          {type === 'RESOURCE_MAINTENANCE' && (
            <label className={styles.field}>
              <span>{t('scheduling.exceptions.resource')}</span>
              <select value={resourceId} onChange={(e) => setResourceId(e.target.value)} required>
                <option value="">{t('scheduling.exceptions.selectResource')}</option>
                {resources.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </label>
          )}
          <label className={styles.field}>
            <span>{t('scheduling.exceptions.reason')}</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <AuthButton type="submit" loading={createMutation.isPending}>
            {t('scheduling.exceptions.submit')}
          </AuthButton>
        </form>
      )}

      {items.length === 0 ? (
        <p className={styles.hint}>{t('scheduling.exceptions.empty')}</p>
      ) : (
        <ul className={styles.grid}>
          {items.map((ex) => (
            <li key={ex.id} className={styles.row}>
              <span className={styles.dayLabel}>{t(`scheduling.exceptions.types.${ex.type}`)}</span>
              <span>
                {new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(ex.startsAt))}
                {' – '}
                {new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(ex.endsAt))}
              </span>
              {canManage && (
                <AuthButton
                  variant="ghost"
                  loading={deleteMutation.isPending}
                  onClick={() => void deleteMutation.mutateAsync(ex.id)}
                >
                  {t('scheduling.exceptions.remove')}
                </AuthButton>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
