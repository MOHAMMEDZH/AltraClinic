export type PatientGender = 'male' | 'female' | 'other';

export interface PatientProfileData {
  emergencyContact?: {
    name?: string;
    relationship?: string;
    phone?: string;
  };
  insurance?: {
    provider?: string;
    policyNumber?: string;
    groupNumber?: string;
    validUntil?: string;
  };
  preferences?: {
    preferredLanguage?: string;
    preferredProviderId?: string;
  };
  communication?: {
    sms?: boolean;
    email?: boolean;
    whatsapp?: boolean;
    appointmentReminders?: boolean;
    followUpReminders?: boolean;
  };
  consent?: {
    treatmentConsent?: boolean;
    dataProcessingConsent?: boolean;
    marketingConsent?: boolean;
    recordedAt?: string;
  };
  allergies?: string[];
  chronicConditions?: string[];
  medicalHistory?: string;
  familyHistory?: string;
  surgicalHistory?: string;
  socialHistory?: string;
  medicationHistory?: string;
  mergedIntoId?: string;
}

export interface PatientListFilter {
  tenantId: string;
  branchId?: string | null;
  q?: string;
  status?: 'active' | 'archived' | 'all';
  gender?: PatientGender;
  limit: number;
  offset: number;
}

export interface PatientListItem {
  id: string;
  firstName: string;
  lastName: string;
  firstNameAr: string | null;
  lastNameAr: string | null;
  phone: string | null;
  email: string | null;
  dateOfBirth: string | null;
  gender: PatientGender | null;
  nationalId: string | null;
  bloodGroup: string | null;
  createdAt: Date;
  archived: boolean;
  lastVisitAt: Date | null;
}

export interface PatientDetailRecord {
  id: string;
  tenantId: string;
  branchId: string | null;
  firstName: string;
  lastName: string;
  firstNameAr: string | null;
  lastNameAr: string | null;
  dateOfBirth: string | null;
  gender: PatientGender | null;
  phone: string | null;
  email: string | null;
  nationalId: string | null;
  bloodGroup: string | null;
  notes: string | null;
  profileData: PatientProfileData;
  addresses: Array<{
    id: string;
    line1: string;
    line2: string | null;
    city: string;
    state: string | null;
    postalCode: string | null;
    country: string;
    isPrimary: boolean;
  }>;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PatientTimelineEntry {
  id: string;
  type:
    | 'appointment'
    | 'encounter'
    | 'invoice'
    | 'note'
    | 'document'
    | 'imaging'
    | 'audit'
    | 'perio'
    | 'diagnosis'
    | 'prescription'
    | 'treatment';
  title: string;
  subtitle: string | null;
  occurredAt: string;
  status: string | null;
  metadata?: Record<string, unknown>;
}

export interface PatientDuplicateCandidate {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  nationalId: string | null;
  dateOfBirth: string | null;
  matchScore: number;
  matchReasons: string[];
}
