import { FormEvent, useMemo, useState } from 'react';
import { hasPermission } from '@booking/permissions';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import {
  useBookRecallInstance,
  useCompleteRecallInstance,
  useCreateRecallRule,
  useDeleteRecallRule,
  useOptOutRecallInstance,
  useRecallDueScan,
  useRecallInstances,
  useRecallRules,
  useSnoozeRecallInstance,
  useUpdateRecallRule,
} from '../hooks/useScheduling';
import type { PatientRecallStatus, SchedulingProvider } from '../types/scheduling.types';
import styles from './ScheduleSettingsPanel.module.css';

const INSTANCE_FILTERS: Array<PatientRecallStatus | ''> = [
  'DUE',
  'SNOOZED',
  'BOOKED',
  'COMPLETED',
  'OPTED_OUT',
  '',
];

interface RecallPanelProps {
  providers: SchedulingProvider[];
}

export function RecallPanel({ providers }: RecallPanelProps) {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const canView = hasPermission(roles, 'api.scheduling', 'view');
  const canManage = hasPermission(roles, 'api.scheduling', 'manage');
  const canUpdate = hasPermission(roles, 'api.scheduling', 'update');
  const canCreate = hasPermission(roles, 'api.scheduling', 'create');

  const [statusFilter, setStatusFilter] = useState<PatientRecallStatus | ''>('DUE');
  const [intervalDays, setIntervalDays] = useState('90');
  const [error, setError] = useState<string | null>(null);
  const [bookStart, setBookStart] = useState('');
  const [bookProviderId, setBookProviderId] = useState(providers[0]?.id ?? '');
  const [bookingId, setBookingId] = useState<string | null>(null);

  const rulesQuery = useRecallRules();
  const instancesQuery = useRecallInstances(statusFilter || undefined);
  const createRule = useCreateRecallRule();
  const updateRule = useUpdateRecallRule();
  const deleteRule = useDeleteRecallRule();
  const dueScan = useRecallDueScan();
  const snooze = useSnoozeRecallInstance();
  const book = useBookRecallInstance();
  const complete = useCompleteRecallInstance();
  const optOut = useOptOutRecallInstance();

  const rules = rulesQuery.data?.items ?? [];
  const instances = instancesQuery.data?.items ?? [];
  const ruleLabel = useMemo(() => {
    const map = new Map(rules.map((r) => [r.id, r.intervalDays]));
    return (ruleId: string) => map.get(ruleId);
  }, [rules]);

  if (!canView) return null;

  async function handleCreateRule(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    const days = Number(intervalDays);
    if (!Number.isFinite(days) || days < 1) return;
    setError(null);
    try {
      await createRule.mutateAsync({ intervalDays: days, active: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('scheduling.recall.error'));
    }
  }

  async function handleBook(id: string) {
    if (!canCreate || !bookStart || !bookProviderId) return;
    const start = new Date(bookStart);
    const end = new Date(start.getTime() + 30 * 60_000);
    setError(null);
    try {
      await book.mutateAsync({
        id,
        start: start.toISOString(),
        end: end.toISOString(),
        providerId: bookProviderId,
      });
      setBookingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('scheduling.recall.error'));
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="recall-panel-heading">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <h2 id="recall-panel-heading" className={styles.title}>
          {t('scheduling.recall.title')}
        </h2>
        {canManage && (
          <AuthButton
            variant="secondary"
            loading={dueScan.isPending}
            onClick={() => void dueScan.mutateAsync(false)}
          >
            {t('scheduling.recall.dueScan')}
          </AuthButton>
        )}
      </div>
      <p className={styles.hint}>{t('scheduling.recall.hint')}</p>
      {error && <AuthAlert variant="error">{error}</AuthAlert>}

      {canManage && (
        <form onSubmit={(e) => void handleCreateRule(e)} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'end' }}>
          <label className={styles.field}>
            <span>{t('scheduling.recall.intervalDays')}</span>
            <input
              type="number"
              min={1}
              value={intervalDays}
              onChange={(e) => setIntervalDays(e.target.value)}
              required
            />
          </label>
          <AuthButton type="submit" loading={createRule.isPending}>
            {t('scheduling.recall.addRule')}
          </AuthButton>
        </form>
      )}

      <h3 className={styles.title} style={{ fontSize: '1rem' }}>{t('scheduling.recall.rules')}</h3>
      {rules.length === 0 ? (
        <p className={styles.hint}>{t('scheduling.recall.rulesEmpty')}</p>
      ) : (
        <ul className={styles.grid}>
          {rules.map((rule) => (
            <li key={rule.id} className={styles.row}>
              <span>
                {t('scheduling.recall.intervalDays')}: {rule.intervalDays}
                {' · '}
                {rule.active ? t('scheduling.recall.active') : t('scheduling.recall.inactive')}
              </span>
              {canManage && (
                <>
                  <AuthButton
                    variant="secondary"
                    loading={updateRule.isPending}
                    onClick={() =>
                      void updateRule.mutateAsync({ id: rule.id, active: !rule.active })
                    }
                  >
                    {rule.active ? t('scheduling.recall.deactivate') : t('scheduling.recall.activate')}
                  </AuthButton>
                  <AuthButton
                    variant="ghost"
                    loading={deleteRule.isPending}
                    onClick={() => void deleteRule.mutateAsync(rule.id)}
                  >
                    {t('scheduling.recall.removeRule')}
                  </AuthButton>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <label className={styles.field}>
        <span>{t('scheduling.recall.filterStatus')}</span>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as PatientRecallStatus | '')}
        >
          {INSTANCE_FILTERS.map((s) => (
            <option key={s || 'all'} value={s}>
              {s ? t(`scheduling.recall.status.${s}`) : t('scheduling.recall.allStatuses')}
            </option>
          ))}
        </select>
      </label>

      <h3 className={styles.title} style={{ fontSize: '1rem' }}>{t('scheduling.recall.instances')}</h3>
      {instances.length === 0 ? (
        <p className={styles.hint}>{t('scheduling.recall.instancesEmpty')}</p>
      ) : (
        <ul className={styles.grid}>
          {instances.map((inst) => (
            <li key={inst.id} className={styles.row} style={{ alignItems: 'flex-start' }}>
              <div>
                <strong>{t(`scheduling.recall.status.${inst.status}`)}</strong>
                <div className={styles.hint}>
                  {t('scheduling.recall.dueAt')}:{' '}
                  {new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
                    new Date(inst.dueAt),
                  )}
                  {ruleLabel(inst.ruleId) != null && (
                    <> · {t('scheduling.recall.intervalDays')}: {ruleLabel(inst.ruleId)}</>
                  )}
                </div>
                {bookingId === inst.id && canCreate && (
                  <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <input
                      type="datetime-local"
                      value={bookStart}
                      onChange={(e) => setBookStart(e.target.value)}
                      required
                    />
                    <select value={bookProviderId} onChange={(e) => setBookProviderId(e.target.value)}>
                      {providers.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <AuthButton loading={book.isPending} onClick={() => void handleBook(inst.id)}>
                      {t('scheduling.recall.confirmBook')}
                    </AuthButton>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {canUpdate && (inst.status === 'DUE' || inst.status === 'SNOOZED') && (
                  <AuthButton
                    variant="secondary"
                    loading={snooze.isPending}
                    onClick={() => {
                      const until = new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString();
                      void snooze.mutateAsync({ id: inst.id, snoozeUntil: until });
                    }}
                  >
                    {t('scheduling.recall.snooze')}
                  </AuthButton>
                )}
                {canCreate && (inst.status === 'DUE' || inst.status === 'SNOOZED') && (
                  <AuthButton
                    variant="secondary"
                    onClick={() => setBookingId((cur) => (cur === inst.id ? null : inst.id))}
                  >
                    {t('scheduling.recall.book')}
                  </AuthButton>
                )}
                {canUpdate && (inst.status === 'BOOKED' || inst.status === 'DUE') && (
                  <AuthButton
                    variant="secondary"
                    loading={complete.isPending}
                    onClick={() => void complete.mutateAsync(inst.id)}
                  >
                    {t('scheduling.recall.complete')}
                  </AuthButton>
                )}
                {canUpdate &&
                  (inst.status === 'DUE' || inst.status === 'SNOOZED' || inst.status === 'BOOKED') && (
                    <AuthButton
                      variant="ghost"
                      loading={optOut.isPending}
                      onClick={() => void optOut.mutateAsync(inst.id)}
                    >
                      {t('scheduling.recall.optOut')}
                    </AuthButton>
                  )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
