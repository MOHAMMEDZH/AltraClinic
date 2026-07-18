import { useMemo } from 'react';

import { useI18n } from '@booking/i18n/react';

import { useMediaList } from '@/features/media/hooks/useMedia';

import { mediaDisplayTitle } from '@/features/media/api/media-api';

import { formatBeautyDateTime, treatmentLabel } from '../config/beauty-config';

import { useBeautyTimeline } from '../hooks/useBeautyExtended';

import type { BeautyBodyMapState } from '../types/beauty.types';

import styles from './BeautyTimeline.module.css';



interface BeautyTimelineProps {

  state: BeautyBodyMapState;

  patientId?: string;

}



interface TimelineEvent {

  id: string;

  type: string;

  date: string;

  label: string;

  detail?: string;

}



export function BeautyTimeline({ state, patientId }: BeautyTimelineProps) {

  const { t, locale } = useI18n();

  const serverTimeline = useBeautyTimeline(patientId, Boolean(patientId));

  const mediaQuery = useMediaList({ patientId, category: 'beauty_before_after' }, Boolean(patientId));



  const events = useMemo(() => {

    if (serverTimeline.data?.length) {

      return serverTimeline.data.map((e) => ({

        id: e.id,

        type: e.type,

        date: e.occurredAt,

        label: e.title,

        detail: e.subtitle ?? undefined,

      }));

    }



    const list: TimelineEvent[] = [];

    for (const c of state.consultations) {

      list.push({

        id: c.id,

        type: 'consultation',

        date: c.date,

        label: t(`beauty.consultation.${c.type === 'initial' ? 'initial' : 'followUp'}`),

        detail: c.notes,

      });

    }

    for (const s of state.sessions) {

      list.push({

        id: s.id,

        type: 'session',

        date: s.completedAt ?? s.scheduledAt,

        label: treatmentLabel(t, s.type),

        detail: s.notes,

      });

    }

    for (const p of state.treatmentPlans) {

      list.push({

        id: p.id,

        type: 'plan',

        date: p.approvedAt ?? p.approvedAt ?? state.consultations[0]?.date ?? new Date().toISOString(),

        label: p.title,

        detail: t(`beauty.plans.status.${p.status}`),

      });

    }

    for (const m of state.measurements) {

      list.push({

        id: m.id,

        type: 'measurement',

        date: m.recordedAt,

        label: m.label,

        detail: `${m.value} ${m.unit}`,

      });

    }

    for (const item of mediaQuery.data?.items ?? []) {

      list.push({

        id: item.id,

        type: 'image',

        date: item.createdAt,

        label: mediaDisplayTitle(item),

        detail: item.comparisonRole ? t(`beauty.gallery.${item.comparisonRole}`) : undefined,

      });

    }

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  }, [state, t, mediaQuery.data?.items, serverTimeline.data]);



  if (serverTimeline.isLoading && !events.length) {

    return <p className={styles.empty} aria-busy="true">{t('beauty.timeline.loading')}</p>;

  }



  if (!events.length) {

    return <p className={styles.empty}>{t('beauty.timeline.empty')}</p>;

  }



  return (

    <ol className={styles.list} aria-label={t('beauty.timeline.title')}>

      {events.map((ev) => (

        <li key={ev.id} className={styles.item}>

          <div className={styles.dot} data-type={ev.type} aria-hidden />

          <div className={styles.content}>

            <div className={styles.head}>

              <span className={styles.type}>{t(`beauty.timeline.${ev.type}`, ev.type)}</span>

              <time className={styles.date} dateTime={ev.date}>

                {formatBeautyDateTime(ev.date, locale)}

              </time>

            </div>

            <strong className={styles.label}>{ev.label}</strong>

            {ev.detail && <p className={styles.detail}>{ev.detail}</p>}

          </div>

        </li>

      ))}

    </ol>

  );

}

