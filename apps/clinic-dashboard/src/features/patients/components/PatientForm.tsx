import { FormEvent, useState } from 'react';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import fieldStyles from '@/features/auth/components/AuthFormField.module.css';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { useI18n } from '@booking/i18n/react';
import authShared from '@/features/auth/auth-shared.module.css';
import type { CreatePatientPayload, PatientDetail, PatientGender, PatientProfileData } from '../types';
import styles from './PatientForm.module.css';

interface PatientFormProps {
  initial?: Partial<PatientDetail>;
  onSubmit: (payload: CreatePatientPayload) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
  loading?: boolean;
}

function parseList(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function joinList(values: string[] | undefined): string {
  return values?.join(', ') ?? '';
}

export function PatientForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
  loading,
}: PatientFormProps) {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const profile = initial?.profileData ?? {};

  const [firstName, setFirstName] = useState(initial?.firstName ?? '');
  const [lastName, setLastName] = useState(initial?.lastName ?? '');
  const [firstNameAr, setFirstNameAr] = useState(initial?.firstNameAr ?? '');
  const [lastNameAr, setLastNameAr] = useState(initial?.lastNameAr ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(initial?.dateOfBirth ?? '');
  const [gender, setGender] = useState<PatientGender | ''>(initial?.gender ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [nationalId, setNationalId] = useState(initial?.nationalId ?? '');
  const [bloodGroup, setBloodGroup] = useState(initial?.bloodGroup ?? '');
  const [addressLine1, setAddressLine1] = useState(initial?.addresses?.[0]?.line1 ?? '');
  const [city, setCity] = useState(initial?.addresses?.[0]?.city ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');

  const [emergencyName, setEmergencyName] = useState(profile.emergencyContact?.name ?? '');
  const [emergencyRelationship, setEmergencyRelationship] = useState(
    profile.emergencyContact?.relationship ?? '',
  );
  const [emergencyPhone, setEmergencyPhone] = useState(profile.emergencyContact?.phone ?? '');
  const [insuranceProvider, setInsuranceProvider] = useState(profile.insurance?.provider ?? '');
  const [policyNumber, setPolicyNumber] = useState(profile.insurance?.policyNumber ?? '');
  const [allergies, setAllergies] = useState(joinList(profile.allergies));
  const [chronicConditions, setChronicConditions] = useState(joinList(profile.chronicConditions));
  const [medicalHistory, setMedicalHistory] = useState(profile.medicalHistory ?? '');
  const [familyHistory, setFamilyHistory] = useState(profile.familyHistory ?? '');
  const [surgicalHistory, setSurgicalHistory] = useState(profile.surgicalHistory ?? '');
  const [socialHistory, setSocialHistory] = useState(profile.socialHistory ?? '');
  const [medicationHistory, setMedicationHistory] = useState(profile.medicationHistory ?? '');
  const [preferredLanguage, setPreferredLanguage] = useState(
    profile.preferences?.preferredLanguage ?? '',
  );
  const [commEmail, setCommEmail] = useState(profile.communication?.email ?? true);
  const [commWhatsapp, setCommWhatsapp] = useState(
    profile.communication?.whatsapp ?? Boolean(initial?.phone?.trim()),
  );
  const [commApptReminders, setCommApptReminders] = useState(
    profile.communication?.appointmentReminders ?? true,
  );
  const [commFollowUp, setCommFollowUp] = useState(profile.communication?.followUpReminders ?? true);
  const [consentTreatment, setConsentTreatment] = useState(profile.consent?.treatmentConsent ?? false);
  const [consentData, setConsentData] = useState(profile.consent?.dataProcessingConsent ?? false);
  const [consentMarketing, setConsentMarketing] = useState(profile.consent?.marketingConsent ?? false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const profileData: PatientProfileData = {
      emergencyContact: {
        name: emergencyName.trim() || undefined,
        relationship: emergencyRelationship.trim() || undefined,
        phone: emergencyPhone.trim() || undefined,
      },
      insurance: {
        provider: insuranceProvider.trim() || undefined,
        policyNumber: policyNumber.trim() || undefined,
      },
      preferences: {
        preferredLanguage: preferredLanguage.trim() || undefined,
      },
      communication: {
        sms: false,
        email: commEmail,
        whatsapp: commWhatsapp,
        appointmentReminders: commApptReminders,
        followUpReminders: commFollowUp,
      },
      consent: {
        treatmentConsent: consentTreatment,
        dataProcessingConsent: consentData,
        marketingConsent: consentMarketing,
        recordedAt:
          consentTreatment || consentData || consentMarketing
            ? new Date().toISOString()
            : profile.consent?.recordedAt,
      },
      allergies: parseList(allergies),
      chronicConditions: parseList(chronicConditions),
      medicalHistory: medicalHistory.trim() || undefined,
      familyHistory: familyHistory.trim() || undefined,
      surgicalHistory: surgicalHistory.trim() || undefined,
      socialHistory: socialHistory.trim() || undefined,
      medicationHistory: medicationHistory.trim() || undefined,
    };

    try {
      await onSubmit({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        firstNameAr: firstNameAr.trim() || undefined,
        lastNameAr: lastNameAr.trim() || undefined,
        dateOfBirth: dateOfBirth || undefined,
        gender: gender || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        nationalId: nationalId.trim() || undefined,
        bloodGroup: bloodGroup.trim() || undefined,
        addressLine1: addressLine1.trim() || undefined,
        city: city.trim() || undefined,
        notes: notes.trim() || undefined,
        profileData,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('patients.error.generic'));
    }
  }

  return (
    <form className={authShared.formStack} onSubmit={handleSubmit} noValidate>
      <fieldset className={styles.section}>
        <legend className={styles.legend}>{t('patients.detail.demographics')}</legend>
        <div className={styles.grid}>
          <AuthFormField label={t('patients.form.firstName')} value={firstName} onChange={(e) => setFirstName(e.target.value)} required autoComplete="given-name" />
          <AuthFormField label={t('patients.form.lastName')} value={lastName} onChange={(e) => setLastName(e.target.value)} required autoComplete="family-name" />
          <AuthFormField label={t('patients.form.firstNameAr')} value={firstNameAr} onChange={(e) => setFirstNameAr(e.target.value)} dir="rtl" />
          <AuthFormField label={t('patients.form.lastNameAr')} value={lastNameAr} onChange={(e) => setLastNameAr(e.target.value)} dir="rtl" />
          <AuthFormField label={t('patients.form.dob')} type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} dir="ltr" />
          <label className={fieldStyles.field}>
            <span className={fieldStyles.label}>{t('patients.form.gender')}</span>
            <select value={gender} onChange={(e) => setGender(e.target.value as PatientGender | '')} className={fieldStyles.input}>
              <option value="">{t('patients.gender.unknown')}</option>
              <option value="male">{t('patients.gender.male')}</option>
              <option value="female">{t('patients.gender.female')}</option>
              <option value="other">{t('patients.gender.other')}</option>
            </select>
          </label>
          <AuthFormField label={t('patients.form.bloodGroup')} value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} dir="ltr" />
        </div>
      </fieldset>

      <fieldset className={styles.section}>
        <legend className={styles.legend}>{t('patients.detail.contact')}</legend>
        <div className={styles.grid}>
          <AuthFormField label={t('patients.form.phone')} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" dir="ltr" />
          <AuthFormField label={t('patients.form.email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" dir="ltr" />
          <AuthFormField label={t('patients.form.nationalId')} value={nationalId} onChange={(e) => setNationalId(e.target.value)} dir="ltr" />
          <AuthFormField label={t('patients.form.address')} value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} autoComplete="street-address" />
          <AuthFormField label={t('patients.form.city')} value={city} onChange={(e) => setCity(e.target.value)} autoComplete="address-level2" />
        </div>
      </fieldset>

      <fieldset className={styles.section}>
        <legend className={styles.legend}>{t('patients.detail.emergency')}</legend>
        <div className={styles.grid}>
          <AuthFormField label={t('patients.profile.emergencyName')} value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} />
          <AuthFormField label={t('patients.profile.emergencyRelationship')} value={emergencyRelationship} onChange={(e) => setEmergencyRelationship(e.target.value)} />
          <AuthFormField label={t('patients.form.phone')} value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} dir="ltr" />
        </div>
      </fieldset>

      <fieldset className={styles.section}>
        <legend className={styles.legend}>{t('patients.detail.insurance')}</legend>
        <div className={styles.grid}>
          <AuthFormField label={t('patients.profile.insuranceProvider')} value={insuranceProvider} onChange={(e) => setInsuranceProvider(e.target.value)} />
          <AuthFormField label={t('patients.profile.policyNumber')} value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} dir="ltr" />
        </div>
      </fieldset>

      <fieldset className={styles.section}>
        <legend className={styles.legend}>{t('patients.profile.sectionClinical')}</legend>
        <AuthFormField label={t('patients.detail.allergies')} value={allergies} onChange={(e) => setAllergies(e.target.value)} helpText={t('patients.profile.listHint')} />
        <AuthFormField label={t('patients.detail.conditions')} value={chronicConditions} onChange={(e) => setChronicConditions(e.target.value)} helpText={t('patients.profile.listHint')} />
        <AuthFormField label={t('patients.detail.history')} value={medicalHistory} onChange={(e) => setMedicalHistory(e.target.value)} />
        <AuthFormField label={t('emr.summary.medicationHistory')} value={medicationHistory} onChange={(e) => setMedicationHistory(e.target.value)} />
        <AuthFormField label={t('emr.summary.familyHistory')} value={familyHistory} onChange={(e) => setFamilyHistory(e.target.value)} />
        <AuthFormField label={t('emr.summary.surgicalHistory')} value={surgicalHistory} onChange={(e) => setSurgicalHistory(e.target.value)} />
        <AuthFormField label={t('emr.summary.socialHistory')} value={socialHistory} onChange={(e) => setSocialHistory(e.target.value)} />
      </fieldset>

      <fieldset className={styles.section}>
        <legend className={styles.legend}>{t('patients.detail.communication')}</legend>
        <div className={styles.checkGrid}>
          <label className={styles.checkLabel}><input type="checkbox" checked={commWhatsapp} onChange={(e) => setCommWhatsapp(e.target.checked)} />{t('patients.comm.whatsapp')}</label>
          <label className={styles.checkLabel}><input type="checkbox" checked={commEmail} onChange={(e) => setCommEmail(e.target.checked)} />{t('patients.comm.email')}</label>
          <label className={styles.checkLabel}><input type="checkbox" checked={commApptReminders} onChange={(e) => setCommApptReminders(e.target.checked)} />{t('patients.comm.appointmentReminders')}</label>
          <label className={styles.checkLabel}><input type="checkbox" checked={commFollowUp} onChange={(e) => setCommFollowUp(e.target.checked)} />{t('patients.comm.followUpReminders')}</label>
        </div>
        <AuthFormField label={t('patients.detail.preferences')} value={preferredLanguage} onChange={(e) => setPreferredLanguage(e.target.value)} placeholder="en-US / ar-SY" />
      </fieldset>

      <fieldset className={styles.section}>
        <legend className={styles.legend}>{t('patients.detail.consent')}</legend>
        <div className={styles.checkGrid}>
          <label className={styles.checkLabel}><input type="checkbox" checked={consentTreatment} onChange={(e) => setConsentTreatment(e.target.checked)} />{t('patients.consent.treatment')}</label>
          <label className={styles.checkLabel}><input type="checkbox" checked={consentData} onChange={(e) => setConsentData(e.target.checked)} />{t('patients.consent.dataProcessing')}</label>
          <label className={styles.checkLabel}><input type="checkbox" checked={consentMarketing} onChange={(e) => setConsentMarketing(e.target.checked)} />{t('patients.consent.marketing')}</label>
        </div>
      </fieldset>

      <AuthFormField label={t('patients.form.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />

      {error && <AuthAlert variant="error">{error}</AuthAlert>}

      <div className={authShared.actions}>
        <AuthButton type="button" variant="secondary" onClick={onCancel}>
          {t('patients.actions.cancel')}
        </AuthButton>
        <AuthButton type="submit" loading={loading}>
          {submitLabel}
        </AuthButton>
      </div>
    </form>
  );
}
