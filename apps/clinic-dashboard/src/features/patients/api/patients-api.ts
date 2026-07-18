import { apiRequest } from '@/lib/api-client';
import type {
  CreatePatientPayload,
  PatientDetail,
  PatientDuplicateCandidate,
  PatientListParams,
  PatientListResponse,
  PatientTimelineEntry,
  UpdatePatientPayload,
} from '../types';

function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export async function fetchPatients(
  token: string,
  tenantId: string,
  params: PatientListParams = {},
): Promise<PatientListResponse> {
  return apiRequest<PatientListResponse>(
    `/patients${qs({
      q: params.q,
      status: params.status,
      gender: params.gender,
      branchId: params.branchId,
      limit: params.limit,
      offset: params.offset,
    })}`,
    { token, tenantId },
  );
}

export async function fetchPatient(
  token: string,
  tenantId: string,
  patientId: string,
): Promise<PatientDetail> {
  return apiRequest<PatientDetail>(`/patients/${patientId}`, { token, tenantId });
}

export async function createPatient(
  token: string,
  tenantId: string,
  payload: CreatePatientPayload,
): Promise<{ id: string }> {
  return apiRequest<{ id: string }>('/patients', {
    method: 'POST',
    body: payload,
    token,
    tenantId,
  });
}

export async function quickRegisterPatient(
  token: string,
  tenantId: string,
  payload: { firstName: string; lastName: string; phone?: string; gender?: string },
): Promise<{ id: string }> {
  return apiRequest<{ id: string }>('/patients/quick', {
    method: 'POST',
    body: payload,
    token,
    tenantId,
  });
}

export async function updatePatient(
  token: string,
  tenantId: string,
  patientId: string,
  payload: UpdatePatientPayload,
): Promise<PatientDetail> {
  return apiRequest<PatientDetail>(`/patients/${patientId}`, {
    method: 'PATCH',
    body: payload,
    token,
    tenantId,
  });
}

export async function archivePatient(
  token: string,
  tenantId: string,
  patientId: string,
): Promise<{ id: string; archived: boolean }> {
  return apiRequest(`/patients/${patientId}/archive`, {
    method: 'POST',
    token,
    tenantId,
  });
}

export async function reactivatePatient(
  token: string,
  tenantId: string,
  patientId: string,
): Promise<{ id: string; archived: boolean }> {
  return apiRequest(`/patients/${patientId}/reactivate`, {
    method: 'POST',
    token,
    tenantId,
  });
}

export async function mergePatients(
  token: string,
  tenantId: string,
  targetId: string,
  sourceId: string,
): Promise<{ targetId: string; archivedSourceId: string }> {
  return apiRequest('/patients/merge', {
    method: 'POST',
    body: { targetId, sourceId },
    token,
    tenantId,
  });
}

export async function fetchPatientTimeline(
  token: string,
  tenantId: string,
  patientId: string,
  limit = 50,
): Promise<{ patientId: string; items: PatientTimelineEntry[] }> {
  return apiRequest(`/patients/${patientId}/timeline${qs({ limit })}`, {
    token,
    tenantId,
  });
}

export async function fetchPatientDuplicates(
  token: string,
  tenantId: string,
  patientId: string,
): Promise<{ patientId: string; candidates: PatientDuplicateCandidate[] }> {
  return apiRequest(`/patients/${patientId}/duplicates`, { token, tenantId });
}

export async function globalSearchPatients(
  token: string,
  tenantId: string,
  q: string,
  limit = 20,
): Promise<Array<{ id: string; title: string; subtitle: string | null }>> {
  const res = await apiRequest<{
    hits: Array<{ type: string; id: string; title: string; subtitle: string | null }>;
  }>(`/search${qs({ q, types: 'patient', limit })}`, { token, tenantId });
  return res.hits.filter((h) => h.type === 'patient');
}

/** Demo fallback when API unavailable */
export function createDemoPatientList(): PatientListResponse {
  const now = new Date().toISOString();
  return {
    total: 3,
    items: [
      {
        id: 'demo-p1',
        firstName: 'Sarah',
        lastName: 'Hassan',
        firstNameAr: 'سارة',
        lastNameAr: 'حسن',
        phone: '+963 944 123 456',
        email: 'sarah.hassan@example.com',
        dateOfBirth: '1990-04-12',
        gender: 'female',
        nationalId: 'NID-001',
        bloodGroup: 'O+',
        createdAt: now,
        archived: false,
        lastVisitAt: now,
      },
      {
        id: 'demo-p2',
        firstName: 'Omar',
        lastName: 'Khalil',
        firstNameAr: 'عمر',
        lastNameAr: 'خليل',
        phone: '+963 955 987 654',
        email: null,
        dateOfBirth: '1985-11-03',
        gender: 'male',
        nationalId: null,
        bloodGroup: 'A+',
        createdAt: now,
        archived: false,
        lastVisitAt: null,
      },
      {
        id: 'demo-p3',
        firstName: 'Layla',
        lastName: 'Nasser',
        firstNameAr: 'ليلى',
        lastNameAr: 'ناصر',
        phone: '+963 933 555 111',
        email: 'layla.n@example.com',
        dateOfBirth: '2001-07-22',
        gender: 'female',
        nationalId: 'NID-003',
        bloodGroup: null,
        createdAt: now,
        archived: false,
        lastVisitAt: now,
      },
    ],
  };
}
