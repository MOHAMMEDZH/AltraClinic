import { buildPatientWordBuffer, type PatientWordDocument } from '@booking/dashboard-export/patient-word';
import type { PatientDetail } from '../types';
import { formatPatientDate, genderLabelKey, patientFullName } from './patient-format';
import { triggerBrowserDownload } from '@/lib/download-file';

type TranslateFn = (key: string) => string;

function yesNo(value: boolean | undefined, t: TranslateFn): string {
  return value ? t('patients.detail.enabled') : t('patients.detail.disabled');
}

export function buildPatientWordDocument(
  patient: PatientDetail,
  locale: string,
  t: TranslateFn,
): PatientWordDocument {
  const profile = patient.profileData ?? {};
  const name = patientFullName(patient, locale);

  return {
    title: t('patients.summaryExport.title'),
    subtitle: `${name} · ${formatPatientDate(new Date().toISOString(), locale)}`,
    sections: [
      {
        title: t('patients.detail.demographics'),
        rows: [
          [t('patients.form.dob'), formatPatientDate(patient.dateOfBirth, locale)],
          [t('patients.form.gender'), t(genderLabelKey(patient.gender))],
          [t('patients.form.nationalId'), patient.nationalId ?? '—'],
          [t('patients.form.bloodGroup'), patient.bloodGroup ?? '—'],
          [t('patients.detail.registered'), formatPatientDate(patient.createdAt, locale)],
        ],
      },
      {
        title: t('patients.detail.contact'),
        rows: [
          [t('patients.form.phone'), patient.phone ?? '—'],
          [t('patients.form.email'), patient.email ?? '—'],
          [t('patients.form.address'), patient.addresses[0]?.line1 ?? '—'],
          [t('patients.form.city'), patient.addresses[0]?.city ?? '—'],
        ],
      },
      {
        title: t('patients.detail.emergency'),
        rows: [
          [t('patients.profile.emergencyName'), profile.emergencyContact?.name ?? '—'],
          [t('patients.profile.emergencyRelationship'), profile.emergencyContact?.relationship ?? '—'],
          [t('patients.form.phone'), profile.emergencyContact?.phone ?? '—'],
        ],
      },
      {
        title: t('patients.detail.insurance'),
        rows: [
          [t('patients.detail.provider'), profile.insurance?.provider ?? '—'],
          [t('patients.profile.policyNumber'), profile.insurance?.policyNumber ?? '—'],
        ],
      },
      {
        title: t('patients.profile.sectionClinical'),
        rows: [
          [t('patients.detail.allergies'), profile.allergies?.join(', ') ?? '—'],
          [t('patients.detail.conditions'), profile.chronicConditions?.join(', ') ?? '—'],
          [t('patients.detail.history'), profile.medicalHistory ?? '—'],
        ],
      },
      {
        title: t('patients.detail.communication'),
        rows: [
          [t('patients.comm.whatsapp'), yesNo(profile.communication?.whatsapp, t)],
          [t('patients.comm.email'), yesNo(profile.communication?.email, t)],
          [t('patients.comm.appointmentReminders'), yesNo(profile.communication?.appointmentReminders, t)],
          [t('patients.comm.followUpReminders'), yesNo(profile.communication?.followUpReminders, t)],
          [t('patients.detail.preferences'), profile.preferences?.preferredLanguage ?? '—'],
        ],
      },
      {
        title: t('patients.detail.consent'),
        rows: [
          [t('patients.consent.treatment'), yesNo(profile.consent?.treatmentConsent, t)],
          [t('patients.consent.dataProcessing'), yesNo(profile.consent?.dataProcessingConsent, t)],
          [t('patients.consent.marketing'), yesNo(profile.consent?.marketingConsent, t)],
        ],
      },
    ],
    notesTitle: t('patients.form.notes'),
    notes: patient.notes,
  };
}

export async function downloadPatientWord(
  patient: PatientDetail,
  locale: string,
  t: TranslateFn,
): Promise<void> {
  const model = buildPatientWordDocument(patient, locale, t);
  const buffer = await buildPatientWordBuffer(model, locale);
  const slug = patientFullName(patient, locale).replace(/\s+/g, '-').toLowerCase();
  triggerBrowserDownload(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }),
    `patient-${slug}-${new Date().toISOString().slice(0, 10)}.docx`,
  );
}
