import { Link, useParams } from 'react-router-dom';

import { useI18n } from '@booking/i18n/react';

import { PageLayout } from '../layout/PageLayout';

import { Alert, Spinner, StatusBadge, Surface } from '../ui';

import { statusLabel, statusTone } from './status-labels';

import { useTenantDetailQuery } from '../tenants/useTenantDetailQuery';

import { SectionExplanation, availabilityTone } from '../tenants/SectionExplanation';
import { TenantUsagePanel } from '../tenants/usage/TenantUsagePanel';
import { TenantLifecyclePanel } from '../tenants/TenantLifecyclePanel';

import type { AccessSummarySection, SectionAvailability, SectionMeta } from '../tenants/types';



function SectionHeader({

  title,

  availability,

}: {

  title: string;

  availability: SectionAvailability;

}) {

  const { t } = useI18n();

  return (

    <header className="sa-metric-card-header">

      <h2 className="sa-metric-card-title">{title}</h2>

      <StatusBadge

        label={t(`tenants.availability.${availability}`, availability)}

        tone={availabilityTone(availability)}

      />

    </header>

  );

}



function isAccessSummary(access: SectionMeta | AccessSummarySection): access is AccessSummarySection {

  return access.availability === 'available' && ('modules' in access || 'limits' in access);

}



function UnavailableSectionCard({

  title,

  section,

}: {

  title: string;

  section: SectionMeta;

}) {

  return (

    <Surface as="section" level="raised" className="sa-metric-card">

      <SectionHeader title={title} availability={section.availability} />

      <SectionExplanation sectionId={section.id} availability={section.availability} reasonCode={section.reasonCode} />

    </Surface>

  );

}



export function TenantDetailPage() {

  const { tenantId = '' } = useParams();

  const { t } = useI18n();

  const { data, loading, error } = useTenantDetailQuery(tenantId);



  return (

    <PageLayout

      title={data?.banner.displayName ?? t('pages.tenantDetail.title', 'Tenant detail')}

      description={t('pages.tenantDetail.description', 'Read-only control-plane metadata.')}

      actions={

        <Link className="sa-button sa-button-quiet" to="/tenants">

          {t('pages.tenantDetail.back', 'Back to directory')}

        </Link>

      }

    >

      {loading && !data ? (

        <div role="status">

          <Spinner label={t('common.states.loading', 'Loading…')} />

        </div>

      ) : null}

      {error ? <Alert tone="danger">{error}</Alert> : null}



      {data ? (

        <>

          <Alert tone="info" title={t('pages.tenantDetail.readOnlyBanner', 'Read-only platform view')}>

            {t(

              'pages.tenantDetail.readOnlyBannerBody',

              'You are viewing tenant metadata only. No clinical data or contact PHI is shown.',

            )}

          </Alert>



          <Surface as="section" level="raised" className="sa-metric-card">

            <SectionHeader title={t('pages.tenantDetail.identity', 'Identity')} availability={data.identity.availability} />

            <dl className="sa-definition-list">

              <dt>{t('pages.tenantDetail.platformTenantId', 'Platform tenant ID')}</dt>

              <dd>{data.identity.platformTenantId}</dd>

              <dt>{t('pages.tenantDetail.tenantId', 'Tenant ID')}</dt>

              <dd>{data.identity.tenantId}</dd>

              <dt>{t('pages.tenantDetail.slug', 'Slug')}</dt>

              <dd>{data.identity.slug ?? '—'}</dd>

              <dt>{t('pages.tenantDetail.status', 'Status')}</dt>

              <dd>

                <StatusBadge label={statusLabel(t, data.identity.status)} tone={statusTone(data.identity.status)} />

              </dd>

              <dt>{t('pages.tenantDetail.region', 'Region')}</dt>

              <dd>{data.identity.region}</dd>

            </dl>

            <SectionExplanation sectionId="identity" availability={data.identity.availability} />

          </Surface>



          <Surface as="section" level="raised" className="sa-metric-card">

            <SectionHeader

              title={t('pages.tenantDetail.facilityProfile', 'Facility profile')}

              availability={data.facilityProfile.availability}

            />

            <p>

              {t('pages.tenantDetail.facilityType', 'Facility type')}:{' '}

              {data.facilityProfile.facilityType ?? t('tenants.availability.unknown', 'unknown')}

            </p>

            <SectionExplanation

              sectionId="facilityProfile"

              availability={data.facilityProfile.availability}

              reasonCode={data.facilityProfile.specialties.reasonCode}

            />

          </Surface>



          
          <TenantUsagePanel tenantId={data.identity.tenantId} />
          <TenantLifecyclePanel tenantId={data.identity.tenantId} />
          <UnavailableSectionCard title={t('pages.tenantDetail.contacts', 'Contacts')} section={data.contacts} />



          <Surface as="section" level="raised" className="sa-metric-card">

            <SectionHeader

              title={t('pages.tenantDetail.commercial', 'Commercial')}

              availability={data.commercial.legacyPlan.availability}

            />

            {'plan' in data.commercial.legacyPlan && data.commercial.legacyPlan.plan ? (

              <p>

                {t('pages.tenantDetail.legacyPlan', 'Legacy plan tier')}: {data.commercial.legacyPlan.plan}

              </p>

            ) : (

              <p className="sa-muted">

                {t(`tenants.availability.${data.commercial.legacyPlan.availability}`, data.commercial.legacyPlan.availability)}

              </p>

            )}

            {data.commercial.subscription.history?.length ? (

              <ul>

                {data.commercial.subscription.history.map((row) => (

                  <li key={row.id}>

                    {row.status} · {row.plan} · {new Date(row.startDate).toLocaleDateString()}

                  </li>

                ))}

              </ul>

            ) : (

              <p className="sa-muted">

                {t(`tenants.availability.${data.commercial.subscription.availability}`, data.commercial.subscription.availability)}

              </p>

            )}

          </Surface>



          <UnavailableSectionCard

            title={t('pages.tenantDetail.planVersion', 'Plan version')}

            section={data.commercial.planVersion}

          />

          <UnavailableSectionCard title={t('pages.tenantDetail.addons', 'Add-ons')} section={data.commercial.addons} />

          <UnavailableSectionCard

            title={t('pages.tenantDetail.overrides', 'Overrides')}

            section={data.commercial.overrides}

          />



          <Surface as="section" level="raised" className="sa-metric-card">

            <SectionHeader

              title={t('pages.tenantDetail.access', 'Access summary')}

              availability={data.access.availability}

            />

            {isAccessSummary(data.access) ? (

              <>

                {data.access.modules?.length ? (

                  <>

                    <h3>{t('pages.tenantDetail.modules', 'Modules')}</h3>

                    <ul>

                      {data.access.modules.slice(0, 12).map((cap) => (

                        <li key={cap.key}>

                          {cap.key}: {cap.decision ?? t('tenants.availability.unknown', 'unknown')}

                        </li>

                      ))}

                    </ul>

                  </>

                ) : null}

                {data.access.limits?.length ? (

                  <>

                    <h3>{t('pages.tenantDetail.limits', 'Limits')}</h3>

                    <ul>

                      {data.access.limits.slice(0, 12).map((cap) => (

                        <li key={cap.key}>

                          {cap.key}:{' '}

                          {cap.unlimited

                            ? t('pages.tenantDetail.unlimited', 'Unlimited')

                            : (cap.value ?? t('tenants.availability.unknown', 'unknown'))}

                        </li>

                      ))}

                    </ul>

                  </>

                ) : null}

              </>

            ) : (

              <SectionExplanation

                sectionId="access"

                availability={data.access.availability}

                reasonCode={'reasonCode' in data.access ? data.access.reasonCode : undefined}

              />

            )}

          </Surface>



          <UnavailableSectionCard

            title={t('pages.tenantDetail.operations', 'Operations')}

            section={data.operations}

          />

        </>

      ) : null}

    </PageLayout>

  );

}

