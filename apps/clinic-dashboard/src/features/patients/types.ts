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
}

export interface PatientAddress {
  id: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string | null;
  country: string;
  isPrimary: boolean;
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
  createdAt: string;
  archived: boolean;
  lastVisitAt: string | null;
}

export interface PatientDetail extends PatientListItem {
  tenantId: string;
  branchId: string | null;
  notes: string | null;
  profileData: PatientProfileData;
  addresses: PatientAddress[];
  updatedAt: string;
}

export interface PatientListResponse {
  items: PatientListItem[];
  total: number;
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
    | 'treatment'
    | 'ortho'
    | 'implant'
    | 'dental_note'
    | 'procedure';
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

export interface CreatePatientPayload {
  firstName: string;
  lastName: string;
  firstNameAr?: string;
  lastNameAr?: string;
  dateOfBirth?: string;
  gender?: PatientGender;
  phone?: string;
  email?: string;
  nationalId?: string;
  bloodGroup?: string;
  notes?: string;
  profileData?: PatientProfileData;
  addressLine1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export type UpdatePatientPayload = Partial<CreatePatientPayload> & {
  branchId?: string | null;
  profileData?: PatientProfileData;
};

export interface PatientListParams {
  q?: string;
  status?: 'active' | 'archived' | 'all';
  gender?: PatientGender;
  branchId?: string;
  limit?: number;
  offset?: number;
}

export type PatientTabId =
  | 'overview'
  | 'medical'
  | 'appointments'
  | 'billing'
  | 'documents'
  | 'notes'
  | 'activity';

export type PatientListFilterKey = 'all' | 'active' | 'archived' | 'male' | 'female';
