import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { usePlatformAuth } from '../../../auth/PlatformAuthProvider';
import { PlatformAuthApiError } from '../../../auth/platform-auth-api';
import { PageLayout } from '../../../layout/PageLayout';
import { Alert } from '../../../ui';

/**
 * Flexible Step 24 — create sales lead.
 * No Trial / entitlement CTAs.
 */
export function SalesLeadCreatePage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { client, withAccessToken } = usePlatformAuth();
  const [organizationName, setOrganizationName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [source, setSource] = useState('INBOUND');
  const [facilityTypeKey, setFacilityTypeKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const created = await withAccessToken((token) =>
        client.createSalesLead(
          token,
          {
            organizationName,
            contactName,
            contactEmail: contactEmail || undefined,
            source,
            facilityTypeKey: facilityTypeKey || undefined,
          },
          crypto.randomUUID(),
        ),
      );
      navigate(`/sales/leads/${created.id}`);
    } catch (err) {
      setError(
        err instanceof PlatformAuthApiError
          ? err.message
          : t('pages.salesLeads.createError', 'Unable to create lead.'),
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <PageLayout
      title={t('pages.salesLeads.createTitle', 'New sales lead')}
      description={t(
        'pages.salesLeads.createDescription',
        'Capture a commercial lead. Plan-fit is advisory only.',
      )}
    >
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <form className="sa-form" onSubmit={onSubmit}>
        <label className="sa-field">
          {t('pages.salesLeads.organizationLabel', 'Organization')}
          <input required value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} />
        </label>
        <label className="sa-field">
          {t('pages.salesLeads.contactNameLabel', 'Contact name')}
          <input required value={contactName} onChange={(e) => setContactName(e.target.value)} />
        </label>
        <label className="sa-field">
          {t('pages.salesLeads.contactEmailLabel', 'Contact email')}
          <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
        </label>
        <label className="sa-field">
          {t('pages.salesLeads.sourceLabel', 'Source')}
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            {['INBOUND', 'OUTBOUND', 'REFERRAL', 'PARTNER', 'EVENT', 'OTHER'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="sa-field">
          {t('pages.salesLeads.facilityTypeLabel', 'Facility type key')}
          <input value={facilityTypeKey} onChange={(e) => setFacilityTypeKey(e.target.value)} />
        </label>
        <div className="sa-form-actions">
          <button className="sa-button sa-button-primary" type="submit" disabled={sending}>
            {sending
              ? t('pages.salesLeads.creating', 'Creating…')
              : t('pages.salesLeads.createSubmit', 'Create lead')}
          </button>
          <Link to="/sales/leads">{t('pages.salesLeads.cancelLink', 'Cancel')}</Link>
        </div>
      </form>
    </PageLayout>
  );
}
