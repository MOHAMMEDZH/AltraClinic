import { useMemo, useState } from 'react';
import { hasPermission } from '@booking/permissions';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import type { ProviderScheduleDay, SchedulingProvider } from '../types/scheduling.types';
import {
  useProviderSchedule,
  useUpdateProviderSchedule,
} from '../hooks/useScheduling';
import styles from './ScheduleSettingsPanel.module.css';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

function defaultWeek(): ProviderScheduleDay[] {
  return DAY_KEYS.map((_, dayOfWeek) => ({
    dayOfWeek,
    startHour: 9,
    startMin: 0,
    endHour: 17,
    endMin: 0,
    isOff: dayOfWeek === 0,
  }));
}

interface ScheduleSettingsPanelProps {
  providers: SchedulingProvider[];
}

export function ScheduleSettingsPanel({ providers }: ScheduleSettingsPanelProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const canManage = hasPermission(roles, 'api.scheduling', 'manage');
  const [providerId, setProviderId] = useState(providers[0]?.id ?? '');
  const scheduleQuery = useProviderSchedule(providerId || undefined);
  const updateMutation = useUpdateProviderSchedule();
  const [days, setDays] = useState<ProviderScheduleDay[]>(defaultWeek);
  const [saved, setSaved] = useState(false);

  const mergedDays = useMemo(() => {
    const base = defaultWeek();
    const fromApi = scheduleQuery.data?.items ?? [];
    return base.map((d) => fromApi.find((r) => r.dayOfWeek === d.dayOfWeek) ?? d);
  }, [scheduleQuery.data?.items]);

  const activeDays = days.length === 7 ? days : mergedDays;

  if (!canManage || providers.length === 0) return null;

  async function handleSave() {
    if (!providerId) return;
    setSaved(false);
    await updateMutation.mutateAsync({ providerId, days: activeDays });
    setSaved(true);
  }

  return (
    <section className={styles.panel} aria-labelledby="schedule-settings-heading">
      <h2 id="schedule-settings-heading" className={styles.title}>
        {t('scheduling.scheduleSettings.title')}
      </h2>
      <p className={styles.hint}>{t('scheduling.scheduleSettings.hint')}</p>

      <label className={styles.field}>
        <span>{t('scheduling.form.provider')}</span>
        <select
          value={providerId}
          onChange={(e) => {
            setProviderId(e.target.value);
            setDays(defaultWeek());
          }}
        >
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <ul className={styles.grid}>
        {activeDays.map((day) => {
          const dayName = t(`scheduling.scheduleSettings.days.${DAY_KEYS[day.dayOfWeek]}`);
          return (
          <li key={day.dayOfWeek} className={styles.row}>
            <span className={styles.dayLabel}>{dayName}</span>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={day.isOff}
                onChange={(e) =>
                  setDays((prev) => {
                    const next = [...(prev.length === 7 ? prev : mergedDays)];
                    next[day.dayOfWeek] = { ...next[day.dayOfWeek], isOff: e.target.checked };
                    return next;
                  })
                }
              />
              {t('scheduling.scheduleSettings.off')}
            </label>
            {!day.isOff && (
              <>
                <input
                  type="time"
                  aria-label={`${dayName} ${t('scheduling.scheduleSettings.startTime')}`}
                  value={`${String(day.startHour).padStart(2, '0')}:${String(day.startMin).padStart(2, '0')}`}
                  onChange={(e) => {
                    const [h, m] = e.target.value.split(':').map(Number);
                    setDays((prev) => {
                      const next = [...(prev.length === 7 ? prev : mergedDays)];
                      next[day.dayOfWeek] = { ...next[day.dayOfWeek], startHour: h, startMin: m };
                      return next;
                    });
                  }}
                />
                <span>–</span>
                <input
                  type="time"
                  aria-label={`${dayName} ${t('scheduling.scheduleSettings.endTime')}`}
                  value={`${String(day.endHour).padStart(2, '0')}:${String(day.endMin).padStart(2, '0')}`}
                  onChange={(e) => {
                    const [h, m] = e.target.value.split(':').map(Number);
                    setDays((prev) => {
                      const next = [...(prev.length === 7 ? prev : mergedDays)];
                      next[day.dayOfWeek] = { ...next[day.dayOfWeek], endHour: h, endMin: m };
                      return next;
                    });
                  }}
                />
              </>
            )}
          </li>
          );
        })}
      </ul>

      {saved && <AuthAlert variant="success">{t('scheduling.scheduleSettings.saved')}</AuthAlert>}

      <AuthButton loading={updateMutation.isPending} onClick={() => void handleSave()}>
        {t('scheduling.scheduleSettings.save')}
      </AuthButton>
    </section>
  );
}
