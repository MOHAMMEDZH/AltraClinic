export type ToothStatus =
  | 'healthy'
  | 'filled'
  | 'missing'
  | 'decayed'
  | 'crown'
  | 'implant'
  | 'root_canal'
  | 'bridge'
  | 'extraction'
  | 'planned';

export type ToothSurface = 'mesial' | 'distal' | 'occlusal' | 'buccal' | 'lingual' | 'incisal';

export interface ToothRecord {
  toothNumber: number;
  status: ToothStatus;
  notes?: string | null;
  surfaces?: Partial<Record<ToothSurface, string>>;
}

export interface DentalChart {
  id: string;
  tenantId: string;
  patientId: string;
  teeth: ToothRecord[];
  procedures: DentalProcedureRecord[];
  createdAt: string;
  updatedAt: string;
  odontogramMode?: OdontogramMode;
}

export interface DentalMetricsSummary {
  chartsTotal: number;
  proceduresThisWeek: number;
  activePatients: number;
  pendingPlannedTeeth: number;
  followUpDue: number;
}

export interface DentalOverviewItem {
  patientId: string;
  patientName: string;
  chartId: string;
  procedureCount: number;
  lastUpdated: string;
  plannedCount: number;
}

export interface CreateTreatmentPayload {
  patientId: string;
  providerId: string;
  procedures: { code: string; description: string; toothNumbers: number[] }[];
  notes?: string;
}

export type DentalViewMode = 'dentist' | 'reception' | 'manager';
export type OdontogramMode = 'adult' | 'pediatric';

export interface DentalProcedureRecord {
  id: string;
  code: string;
  description: string;
  toothNumbers: number[];
  performedAt: string | null;
  providerId: string | null;
}

export interface DentalPatientSummary {
  patientId: string;
  patientName: string;
  dateOfBirth: string | null;
  hasChart: boolean;
  chartId: string | null;
  odontogramMode: OdontogramMode;
  lastChartUpdate: string | null;
  procedureCount: number;
  plannedTeeth: number;
  treatmentPlanCount: number;
  activePlan: { id: string; title: string; status: string; totalEstimatedCost: number | null } | null;
  perioExamCount: number;
  activeOrthoCases: number;
  activeImplants: number;
  clinicalNoteCount: number;
  invoiceCount: number;
}

export interface DentalTimelineEntry {
  id: string;
  type:
    | 'procedure'
    | 'treatment'
    | 'perio'
    | 'ortho'
    | 'implant'
    | 'dental_note'
    | 'appointment'
    | 'invoice'
    | 'imaging';
  title: string;
  subtitle: string | null;
  occurredAt: string;
  metadata?: Record<string, unknown>;
}

export interface OrthodonticCase {
  id: string;
  patientId: string;
  status: string;
  applianceType: string;
  startDate: string | null;
  estimatedEndDate: string | null;
  notes: string | null;
  clinicalData: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ImplantRecord {
  id: string;
  patientId: string;
  toothId: string;
  implantSystem: string | null;
  implantDiameter: number | null;
  implantLength: number | null;
  abutmentType: string | null;
  status: string;
  placedAt: string | null;
  restoredAt: string | null;
  notes: string | null;
  surgicalData: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DentalClinicalNote {
  id: string;
  patientId: string;
  noteType: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface DentalClinicalInventoryItem {
  itemId: string;
  sku: string;
  nameEn: string;
  nameAr: string | null;
  unit: string;
  quantityOnHand: number;
}

export interface DentalProcedureMaterialMapping {
  mappingId: string;
  itemId: string;
  sku: string;
  nameEn: string;
  nameAr: string | null;
  unit: string;
  defaultQuantity: number;
  quantityOnHand: number;
  notes: string | null;
}

export interface DentalMaterialUsage {
  id: string;
  itemId: string;
  sku: string;
  itemName: string;
  quantityUsed: number;
  unit: string;
  consumedBy: string;
  notes: string | null;
  encounterId: string | null;
  patientId: string | null;
  procedureCode: string | null;
  consumedAt: string;
}

export interface DentalMaterialsResponse {
  consumptions: DentalMaterialUsage[];
  total: number;
  limit: number;
  offset: number;
}
