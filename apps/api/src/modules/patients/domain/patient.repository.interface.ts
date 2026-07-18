import { Patient } from './patient.entity';
import type {
  PatientDetailRecord,
  PatientDuplicateCandidate,
  PatientListFilter,
  PatientListItem,
  PatientProfileData,
  PatientTimelineEntry,
} from './patient.types';

export interface PatientUpdateInput {
  firstName?: string;
  lastName?: string;
  firstNameAr?: string | null;
  lastNameAr?: string | null;
  dateOfBirth?: string | null;
  gender?: 'male' | 'female' | 'other' | null;
  phone?: string | null;
  email?: string | null;
  nationalId?: string | null;
  bloodGroup?: string | null;
  notes?: string | null;
  profileData?: PatientProfileData;
  branchId?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

export interface PatientRepository {
  save(patient: Patient): Promise<void>;
  findById(id: string, tenantId: string): Promise<Patient | null>;
  findByIdentifier?(identifier: string, tenantId: string): Promise<Patient | null>;
  findDetailById(id: string, tenantId: string): Promise<PatientDetailRecord | null>;
  list(filter: PatientListFilter): Promise<{ items: PatientListItem[]; total: number }>;
  update(id: string, tenantId: string, input: PatientUpdateInput): Promise<PatientDetailRecord | null>;
  archive(id: string, tenantId: string): Promise<boolean>;
  reactivate(id: string, tenantId: string): Promise<boolean>;
  findDuplicates(id: string, tenantId: string): Promise<PatientDuplicateCandidate[]>;
  merge(
    tenantId: string,
    targetId: string,
    sourceId: string,
  ): Promise<{ targetId: string; archivedSourceId: string }>;
  getTimeline(id: string, tenantId: string, limit?: number): Promise<PatientTimelineEntry[]>;
}
