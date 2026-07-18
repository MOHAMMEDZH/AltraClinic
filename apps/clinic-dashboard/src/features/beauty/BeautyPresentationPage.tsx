import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Maximize2, Minimize2, X } from 'lucide-react';
import { hasPermission } from '@booking/permissions';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { ImageViewer } from '@/features/media/components/ImageViewer';
import { useMediaList } from '@/features/media/hooks/useMedia';
import { migratePlan } from './config/beauty-form-utils';
import { canViewBeauty, formatBeautyDate, formatCurrency, treatmentLabel } from './config/beauty-config';
import { useBeautyRecord } from './hooks/useBeauty';
import { MeasurementsPanel } from './components/MeasurementsPanel';
import styles from './BeautyPresentationPage.module.css';

export function BeautyPresentationPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const perm = useCallback((action: string) => hasPermission(roles, 'api.beauty', action as never), [roles]);

  const recordQuery = useBeautyRecord(patientId, canViewBeauty(perm) && Boolean(patientId));
  const mediaQuery = useMediaList(
    { patientId, category: 'beauty_before_after' },
    canViewBeauty(perm) && Boolean(patientId),
  );
  const [compareMode, setCompareMode] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const heroRef = useRef<HTMLElement>(null);

  const record = recordQuery.data;
  const state = record?.bodyMapState;
  const items = mediaQuery.data?.items ?? [];
  const before = items.find((i) => i.comparisonRole === 'before') ?? items[0];
  const after = items.find((i) => i.comparisonRole === 'after') ?? items[1];
  const activePlan = useMemo(
    () => state?.treatmentPlans.map(migratePlan).find((p) => p.status === 'active' || p.status === 'approved'),
    [state],
  );

  const toggleFullscreen = useCallback(async () => {
    const el = heroRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      setFullscreen((v) => !v);
    }
  }, []);

  useEffect(() => {
    function onChange() {
      setFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  if (!canViewBeauty(perm)) {
    return (
      <div className={styles.page}>
        <AuthAlert variant="error">{t('beauty.errors.accessDenied')}</AuthAlert>
      </div>
    );
  }

  if (recordQuery.isLoading) {
    return <div className={styles.loading} aria-busy="true" />;
  }

  if (!state) {
    return <p className={styles.empty}>{t('beauty.errors.load')}</p>;
  }

  return (
    <div className={[styles.page, fullscreen ? styles.pageFullscreen : ''].filter(Boolean).join(' ')}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>{t('beauty.presentation.kicker')}</p>
          <h1 className={styles.title}>{t('beauty.presentation.title')}</h1>
        </div>
        <div className={styles.headerActions}>
          <AuthButton variant="secondary" onClick={() => setCompareMode((v) => !v)} aria-pressed={compareMode}>
            {t('beauty.presentation.toggleCompare')}
          </AuthButton>
          <AuthButton variant="secondary" onClick={() => void toggleFullscreen()} aria-pressed={fullscreen}>
            {fullscreen ? <Minimize2 size={16} aria-hidden /> : <Maximize2 size={16} aria-hidden />}
            {fullscreen ? t('beauty.presentation.exitFullscreen') : t('beauty.presentation.fullscreen')}
          </AuthButton>
          <Link to={`/beauty/workspace/${patientId}`} className={styles.close}>
            <X size={18} aria-hidden />
            <span>{t('beauty.presentation.exit')}</span>
          </Link>
        </div>
      </header>

      <div className={styles.layout}>
        <section
          ref={heroRef}
          className={[styles.heroVisual, fullscreen ? styles.heroFullscreen : ''].filter(Boolean).join(' ')}
          aria-label={t('beauty.gallery.title')}
        >
          {before && after && compareMode ? (
            <div className={styles.compare}>
              <ImageViewer item={before} compareItem={after} />
            </div>
          ) : before ? (
            <ImageViewer item={before} />
          ) : (
            <p className={styles.empty}>{t('beauty.gallery.empty')}</p>
          )}
        </section>

        {!fullscreen && (
          <aside className={styles.sidebar}>
            {activePlan && (
              <section className={styles.block}>
                <h2>{t('beauty.presentation.plan')}</h2>
                <p className={styles.planTitle}>{activePlan.title}</p>
                <p className={styles.meta}>
                  {activePlan.sessionsCompleted} / {activePlan.sessionsPlanned} {t('beauty.plans.sessionsCompleted')}
                </p>
                <p className={styles.cost}>{formatCurrency(activePlan.estimatedCost, locale)}</p>
                <div
                  className={styles.progressBar}
                  role="progressbar"
                  aria-valuenow={activePlan.sessionsCompleted}
                  aria-valuemin={0}
                  aria-valuemax={activePlan.sessionsPlanned}
                  aria-label={t('beauty.presentation.progress')}
                >
                  <span
                    style={{
                      width: `${(activePlan.sessionsCompleted / Math.max(1, activePlan.sessionsPlanned)) * 100}%`,
                    }}
                  />
                </div>
              </section>
            )}

            <section className={styles.block}>
              <h2>{t('beauty.measurements.title')}</h2>
              <MeasurementsPanel measurements={state.measurements.slice(-3)} />
            </section>

            <section className={styles.block}>
              <h2>{t('beauty.presentation.timeline')}</h2>
              <ul className={styles.miniTimeline}>
                {state.sessions.slice(0, 4).map((s) => (
                  <li key={s.id}>
                    <span>{treatmentLabel(t, s.type)}</span>
                    <time>{formatBeautyDate(s.scheduledAt, locale)}</time>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        )}
      </div>
    </div>
  );
}
