import { FormEvent, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import fieldStyles from '@/features/auth/components/AuthFormField.module.css';
import { usePatientsList } from '@/features/patients/hooks/usePatients';
import { patientFullName } from '@/features/patients/lib/patient-format';
import {
  useBookWaitlistEntry,
  useCancelWaitlistEntry,
  useCreateWaitlistEntry,
  useWaitlist,
  useWaitlistOffers,
  useAcceptWaitlistOffer,
  useRejectWaitlistOffer,
  useExpireDueWaitlistOffers,
} from '../hooks/useScheduling';
import type { SchedulingProvider } from '../types/scheduling.types';
import styles from './WaitlistPanel.module.css';

interface WaitlistPanelProps {
  providers: SchedulingProvider[];
  canCreate: boolean;
  canDelete: boolean;
  canBook?: boolean;
  canManage?: boolean;
}

export function WaitlistPanel({
  providers,
  canCreate,
  canDelete,
  canBook,
  canManage = false,
}: WaitlistPanelProps) {
  const { t, locale } = useI18n();
  const waitlistQuery = useWaitlist('open');
  const createMutation = useCreateWaitlistEntry();
  const cancelMutation = useCancelWaitlistEntry();
  const bookMutation = useBookWaitlistEntry();
  const offersQuery = useWaitlistOffers('PENDING');
  const acceptOffer = useAcceptWaitlistOffer();
  const rejectOffer = useRejectWaitlistOffer();
  const expireOffers = useExpireDueWaitlistOffers();
  const [showForm, setShowForm] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientId, setPatientId] = useState('');
  const [providerId, setProviderId] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const patientsQuery = usePatientsList({
    q: patientSearch || undefined,
    status: 'active',
    limit: 15,
    offset: 0,
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!patientId) return;
    setError(null);
    try {
      await createMutation.mutateAsync({
        patientId,
        providerId: providerId || undefined,
        preferredDate: preferredDate ? new Date(`${preferredDate}T12:00:00`).toISOString() : undefined,
        notes: notes.trim() || undefined,
      });
      setShowForm(false);
      setPatientId('');
      setNotes('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('scheduling.waitlist.error'));
    }
  }

  async function handleBook(entry: (typeof items)[number]) {
    const base = entry.preferredDate ? new Date(entry.preferredDate) : new Date();
    if (!entry.preferredDate) base.setDate(base.getDate() + 1);
    base.setHours(10, 0, 0, 0);
    const end = new Date(base.getTime() + entry.durationMin * 60_000);
    const provider = entry.providerId ?? providers[0]?.id;
    if (!provider) {
      setError(t('scheduling.waitlist.bookNeedsProvider'));
      return;
    }
    setError(null);
    try {
      await bookMutation.mutateAsync({
        id: entry.id,
        start: base.toISOString(),
        end: end.toISOString(),
        providerId: provider,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('scheduling.waitlist.error'));
    }
  }

  const items = waitlistQuery.data?.items ?? [];
  const offers = offersQuery.data?.items ?? [];

  return (
    <section className={styles.panel} aria-labelledby="scheduling-waitlist-heading">
      <div className={styles.header}>
        <h2 id="scheduling-waitlist-heading" className={styles.title}>
          {t('scheduling.waitlist.title')}
        </h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {canManage && (
            <AuthButton
              variant="ghost"
              loading={expireOffers.isPending}
              onClick={() => void expireOffers.mutateAsync()}
            >
              {t('scheduling.waitlist.offers.expireDue')}
            </AuthButton>
          )}
          {canCreate && (
            <AuthButton variant="secondary" onClick={() => setShowForm((v) => !v)}>
              {t('scheduling.waitlist.add')}
            </AuthButton>
          )}
        </div>
      </div>

      <h3 className={styles.title} style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>
        {t('scheduling.waitlist.offers.title')}
      </h3>
      {error && !showForm && <AuthAlert variant="error">{error}</AuthAlert>}
      {offers.length === 0 ? (
        <p className={styles.empty}>{t('scheduling.waitlist.offers.empty')}</p>
      ) : (
        <ul className={styles.list} style={{ marginBottom: '1rem' }}>
          {offers.map((offer) => (
            <li key={offer.id} className={styles.item}>
              <div>
                <strong>{t('scheduling.waitlist.offers.pending')}</strong>
                <span className={styles.meta}>
                  {new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
                    new Date(offer.offeredStartsAt),
                  )}
                  {' → '}
                  {new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
                    new Date(offer.offeredEndsAt),
                  )}
                </span>
                <span className={styles.meta}>
                  {t('scheduling.waitlist.offers.expires')}:{' '}
                  {new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
                    new Date(offer.expiresAt),
                  )}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                {canBook && (
                  <AuthButton
                    variant="secondary"
                    loading={acceptOffer.isPending}
                    onClick={() => void acceptOffer.mutateAsync(offer.id).catch((err: unknown) => {
                      setError(err instanceof Error ? err.message : t('scheduling.waitlist.error'));
                    })}
                  >
                    {t('scheduling.waitlist.offers.accept')}
                  </AuthButton>
                )}
                {canBook && (
                  <AuthButton
                    variant="ghost"
                    loading={rejectOffer.isPending}
                    onClick={() => void rejectOffer.mutateAsync(offer.id).catch((err: unknown) => {
                      setError(err instanceof Error ? err.message : t('scheduling.waitlist.error'));
                    })}
                  >
                    {t('scheduling.waitlist.offers.reject')}
                  </AuthButton>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {showForm && canCreate && (
        <form className={styles.form} onSubmit={(e) => void handleSubmit(e)}>
          {error && <AuthAlert variant="error">{error}</AuthAlert>}
          <AuthFormField
            id="waitlist-patient-search"
            label={t('scheduling.form.patient')}
            type="search"
            value={patientSearch}
            onChange={(e) => setPatientSearch(e.target.value)}
          />
          <label className={fieldStyles.field}>
            <span className={fieldStyles.label}>{t('scheduling.form.selectPatient')}</span>
            <select
              className={fieldStyles.input}
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              required
            >
              <option value="">{t('scheduling.form.selectPatient')}</option>
              {(patientsQuery.data?.items ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {patientFullName(p, locale)}
                </option>
              ))}
            </select>
          </label>
          <label className={fieldStyles.field}>
            <span className={fieldStyles.label}>{t('scheduling.form.provider')}</span>
            <select
              className={fieldStyles.input}
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
            >
              <option value="">{t('scheduling.filter.allProviders')}</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <AuthFormField
            id="waitlist-date"
            label={t('scheduling.waitlist.preferredDate')}
            type="date"
            value={preferredDate}
            onChange={(e) => setPreferredDate(e.target.value)}
          />
          <AuthButton type="submit" loading={createMutation.isPending}>
            {t('scheduling.waitlist.submit')}
          </AuthButton>
        </form>
      )}

      {items.length === 0 ? (
        <p className={styles.empty}>{t('scheduling.waitlist.empty')}</p>
      ) : (
        <ul className={styles.list}>
          {items.map((entry) => (
            <li key={entry.id} className={styles.item}>
              <div>
                <strong>{entry.patientName}</strong>
                {entry.preferredDate && (
                  <span className={styles.meta}>
                    {new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
                      new Date(entry.preferredDate),
                    )}
                  </span>
                )}
              </div>
              {canBook && (
                <AuthButton
                  variant="secondary"
                  loading={bookMutation.isPending}
                  onClick={() => void handleBook(entry)}
                >
                  {t('scheduling.waitlist.book')}
                </AuthButton>
              )}
              {canDelete && (
                <AuthButton
                  variant="ghost"
                  loading={cancelMutation.isPending}
                  onClick={() => void cancelMutation.mutateAsync(entry.id)}
                >
                  {t('scheduling.waitlist.remove')}
                </AuthButton>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
