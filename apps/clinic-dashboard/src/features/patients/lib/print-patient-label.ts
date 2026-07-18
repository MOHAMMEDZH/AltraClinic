import type { PatientDetail } from '../types';
import { buildPatientQrUrl, patientFullName } from './patient-format';

type TranslateFn = (key: string) => string;

export function printPatientLabel(
  patient: Pick<
    PatientDetail,
    'id' | 'firstName' | 'lastName' | 'firstNameAr' | 'lastNameAr' | 'phone' | 'nationalId'
  >,
  locale: string,
  t: TranslateFn,
): void {
  const name = patientFullName(patient, locale);
  const qrUrl = buildPatientQrUrl(patient.id);
  const popup = window.open('', '_blank', 'noopener,noreferrer,width=420,height=560');
  if (!popup) return;

  const phone = patient.phone ?? '—';
  const nationalId = patient.nationalId ?? '—';

  popup.document.write(`<!doctype html>
<html lang="${locale.startsWith('ar') ? 'ar' : 'en'}">
<head>
  <meta charset="utf-8" />
  <title>${name}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; text-align: center; }
    h1 { font-size: 1.25rem; margin: 0 0 8px; }
    p { margin: 4px 0; color: #444; }
    img { margin-top: 16px; width: 160px; height: 160px; }
  </style>
</head>
<body>
  <h1>${name}</h1>
  <p dir="ltr">${phone}</p>
  <p dir="ltr">${nationalId}</p>
  <img src="${qrUrl}" alt="${t('patients.actions.qr')}" width="160" height="160" />
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`);
  popup.document.close();
}
