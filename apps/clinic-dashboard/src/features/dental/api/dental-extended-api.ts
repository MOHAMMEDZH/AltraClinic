import { apiRequest } from '@/lib/api-client';
import type {
  DentalClinicalNote,
  DentalPatientSummary,
  DentalTimelineEntry,
  ImplantRecord,
  OdontogramMode,
  OrthodonticCase,
  ToothRecord,
} from '../types/dental.types';

export async function fetchDentalPatientSummary(
  token: string,
  tenantId: string,
  patientId: string,
): Promise<DentalPatientSummary> {
  return apiRequest(`/dental/patients/${patientId}/summary`, { token, tenantId });
}

export async function fetchDentalTimeline(
  token: string,
  tenantId: string,
  patientId: string,
  limit = 50,
): Promise<DentalTimelineEntry[]> {
  return apiRequest(`/dental/patients/${patientId}/timeline?limit=${limit}`, { token, tenantId });
}

export async function updateOdontogramMode(
  token: string,
  tenantId: string,
  patientId: string,
  mode: OdontogramMode,
): Promise<{ odontogramMode: OdontogramMode; teeth: ToothRecord[] }> {
  return apiRequest(`/dental/chart/${patientId}/mode`, {
    method: 'PATCH',
    body: { mode },
    token,
    tenantId,
  });
}

export async function fetchOrthodonticCases(
  token: string,
  tenantId: string,
  patientId: string,
): Promise<{ items: OrthodonticCase[] }> {
  return apiRequest(`/dental/ortho/${patientId}/cases`, { token, tenantId });
}

export async function createOrthodonticCase(
  token: string,
  tenantId: string,
  body: {
    patientId: string;
    applianceType: string;
    startDate?: string | null;
    estimatedEndDate?: string | null;
    notes?: string | null;
  },
): Promise<OrthodonticCase> {
  return apiRequest('/dental/ortho/cases', { method: 'POST', body, token, tenantId });
}

export async function updateOrthodonticCase(
  token: string,
  tenantId: string,
  caseId: string,
  body: Partial<{
    status: string;
    applianceType: string;
    startDate: string | null;
    estimatedEndDate: string | null;
    notes: string | null;
    clinicalData: Record<string, unknown>;
  }>,
): Promise<OrthodonticCase> {
  return apiRequest(`/dental/ortho/cases/${caseId}`, { method: 'PATCH', body, token, tenantId });
}

export async function fetchImplantRecords(
  token: string,
  tenantId: string,
  patientId: string,
): Promise<{ items: ImplantRecord[] }> {
  return apiRequest(`/dental/implants/${patientId}`, { token, tenantId });
}

export async function createImplantRecord(
  token: string,
  tenantId: string,
  body: {
    patientId: string;
    toothId: string;
    implantSystem?: string | null;
    implantDiameter?: number | null;
    implantLength?: number | null;
    status?: string;
    notes?: string | null;
  },
): Promise<ImplantRecord> {
  return apiRequest('/dental/implants', { method: 'POST', body, token, tenantId });
}

export async function updateImplantRecord(
  token: string,
  tenantId: string,
  implantId: string,
  body: Partial<{
    status: string;
    implantSystem: string | null;
    placedAt: string | null;
    restoredAt: string | null;
    notes: string | null;
  }>,
): Promise<ImplantRecord> {
  return apiRequest(`/dental/implants/${implantId}`, { method: 'PATCH', body, token, tenantId });
}

export async function fetchDentalClinicalNotes(
  token: string,
  tenantId: string,
  patientId: string,
): Promise<{ items: DentalClinicalNote[] }> {
  return apiRequest(`/dental/notes/${patientId}`, { token, tenantId });
}

export async function createDentalClinicalNote(
  token: string,
  tenantId: string,
  body: { patientId: string; noteType?: string; content: string; dentalRecordId?: string | null },
): Promise<DentalClinicalNote> {
  return apiRequest('/dental/notes', { method: 'POST', body, token, tenantId });
}

export async function createTreatmentPlanInvoice(
  token: string,
  tenantId: string,
  planId: string,
): Promise<{ invoiceId: string; patientId: string; planId: string }> {
  return apiRequest(`/dental/treatment-plans/${planId}/invoice`, { method: 'POST', token, tenantId });
}
