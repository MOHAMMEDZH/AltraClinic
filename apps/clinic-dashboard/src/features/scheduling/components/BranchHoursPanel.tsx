import { useMemo, useState } from 'react';
import { hasPermission } from '@booking/permissions';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import type { DashboardBranch } from '@/features/dashboard/api/dashboard-api';
import type { ScheduleDayHours } from '../types/scheduling.types';
import { useBranchHours, useUpdateBranchHours } from '../hooks/useScheduling';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import styles from './ScheduleSettingsPanel.module.css';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

function defaultWeek(): ScheduleDayHours[] {
  return DAY_KEYS.map((_, dayOfWeek) => ({
    dayOfWeek,
    openHour: 7,
    openMin: 0,
    closeHour: 20,
    closeMin: 0,
    isClosed: dayOfWeek === 0,
  }));
}

interface BranchHoursPanelProps {
  branches: DashboardBranch[];
}

export function BranchHoursPanel({ branches }: BranchHoursPanelProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const canManage = hasPermission(roles, 'api.scheduling', 'manage');
  const [branchId, setBranchId] = useState(branches[0]?.id ?? user?.branchId ?? '');
  const hoursQuery = useBranchHours(branchId || undefined);
  const updateMutation = useUpdateBranchHours();
  const [days, setDays] = useState<ScheduleDayHours[]>(defaultWeek);
  const [saved, setSaved] = useState(false);

  const mergedDays = useMemo(() => {
    const base = defaultWeek();
    const fromApi = hoursQuery.data?.items ?? [];
    return base.map((d) => fromApi.find((r) => r.dayOfWeek === d.dayOfWeek) ?? d);
  }, [hoursQuery.data?.items]);

  const activeDays = days.length === 7 ? days : mergedDays;

  if (!canManage || branches.length === 0) return null;

  async function handleSave() {
    if (!branchId) return;
    setSaved(false);
    await updateMutation.mutateAsync({ branchId, days: activeDays });
    setSaved(true);
  }

  return (
    <section className={styles.panel} aria-labelledby="branch-hours-heading">
      <h2 id="branch-hours-heading" className={styles.title}>
        {t('scheduling.branchHours.title')}
      </h2>
      <p className={styles.hint}>{t('scheduling.branchHours.hint')}</p>

      <label className={styles.field}>
        <span>{t('scheduling.filter.branch')}</span>
        <select
          value={branchId}
          onChange={(e) => {
            setBranchId(e.target.value);
            setDays(defaultWeek());
          }}
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>

      <ul className={styles.grid}>
        {activeDays.map((day) => (
          <li key={day.dayOfWeek} className={styles.row}>
            <span className={styles.dayLabel}>
              {t(`scheduling.scheduleSettings.days.${DAY_KEYS[day.dayOfWeek]}`)}
            </span>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={day.isClosed}
                onChange={(e) =>
                  setDays((prev) => {
                    const next = [...(prev.length === 7 ? prev : mergedDays)];
                    next[day.dayOfWeek] = { ...next[day.dayOfWeek], isClosed: e.target.checked };
                    return next;
                  })
                }
              />
              {t('scheduling.branchHours.closed')}
            </label>
            {!day.isClosed && (
              <>
                <input
                  type="time"
                  value={`${String(day.openHour).padStart(2, '0')}:${String(day.openMin).padStart(2, '0')}`}
                  onChange={(e) => {
                    const [h, m] = e.target.value.split(':').map(Number);
                    setDays((prev) => {
                      const next = [...(prev.length === 7 ? prev : mergedDays)];
                      next[day.dayOfWeek] = { ...next[day.dayOfWeek], openHour: h, openMin: m };
                      return next;
                    });
                  }}
                />
                <span>–</span>
                <input
                  type="time"
                  value={`${String(day.closeHour).padStart(2, '0')}:${String(day.closeMin).padStart(2, '0')}`}
                  onChange={(e) => {
                    const [h, m] = e.target.value.split(':').map(Number);
                    setDays((prev) => {
                      const next = [...(prev.length === 7 ? prev : mergedDays)];
                      next[day.dayOfWeek] = { ...next[day.dayOfWeek], closeHour: h, closeMin: m };
                      return next;
                    });
                  }}
                />
              </>
            )}
          </li>
        ))}
      </ul>

      {saved && <AuthAlert variant="success">{t('scheduling.branchHours.saved')}</AuthAlert>}

      <AuthButton loading={updateMutation.isPending} onClick={() => void handleSave()}>
        {t('scheduling.branchHours.save')}
      </AuthButton>
    </section>
  );
}
