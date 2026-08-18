import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { EncounterStatus as PrismaEncounterStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { generateEntityId } from '../../../../common/id-generator.util';
import { RequiredConsentGateService } from '../../../clinical-forms/services/required-consent-gate.service';
import type {
  ClinicalSearchResult,
  DiagnosisRecord,
  EmrDashboardResponse,
  EmrMetricsSummary,
  EncounterDetail,
  EncounterListFilter,
  EncounterListItem,
  EncounterStatus,
  MedicationRecord,
  ObservationRecord,
  SoapNotes,
  StructuredClinicalNote,
} from '../../domain/emr.types';

const CLINICAL_NOTES_TYPE = 'clinical_notes';

const STATUS_MAP: Record<PrismaEncounterStatus, EncounterStatus> = {
  DRAFT: 'draft',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  SIGNED: 'signed',
};

@Injectable()
export class EmrEncounterService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly consentGate?: RequiredConsentGateService,
  ) {}

  async list(filter: EncounterListFilter): Promise<{ items: EncounterListItem[]; total: number }> {
    const where = this.buildWhere(filter);

    const [rows, total] = await Promise.all([
      this.prisma.encounter.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: filter.offset,
        take: filter.limit,
        include: { patient: { select: { firstName: true, lastName: true } } },
      }),
      this.prisma.encounter.count({ where }),
    ]);

    return { total, items: rows.map((r) => this.toListItem(r)) };
  }

  async findDetail(id: string, tenantId: string): Promise<EncounterDetail | null> {
    const row = await this.prisma.encounter.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { patient: { select: { firstName: true, lastName: true } } },
    });
    return row ? this.toDetail(row) : null;
  }

  async create(
    tenantId: string,
    branchId: string | null,
    input: {
      patientId: string;
      clinicianId: string;
      chiefComplaint?: string | null;
      clinicalNotes?: string | null;
      appointmentId?: string | null;
      followUpDate?: string | null;
      diagnoses?: DiagnosisRecord[];
      medications?: MedicationRecord[];
      observations?: ObservationRecord[];
    },
  ): Promise<EncounterDetail> {
    const id = generateEntityId('encounter');
    let observations = input.observations ?? [];
    if (input.clinicalNotes?.trim()) {
      observations = [
        ...observations.filter((o) => o.type !== CLINICAL_NOTES_TYPE),
        { type: CLINICAL_NOTES_TYPE, value: input.clinicalNotes.trim() },
      ];
    }

    const row = await this.prisma.encounter.create({
      data: {
        id,
        tenantId,
        branchId,
        patientId: input.patientId,
        clinicianId: input.clinicianId,
        appointmentId: input.appointmentId ?? null,
        chiefComplaint: input.chiefComplaint?.trim() || null,
        diagnoses: this.asJson(input.diagnoses ?? []),
        medications: this.asJson(input.medications ?? []),
        observations: this.asJson(observations),
        followUpDate: input.followUpDate ? new Date(input.followUpDate) : null,
        status: 'IN_PROGRESS',
      },
      include: { patient: { select: { firstName: true, lastName: true } } },
    });
    return this.toDetail(row);
  }

  async getMetrics(tenantId: string, branchId?: string | null): Promise<EmrMetricsSummary> {
    const dashboard = await this.getDashboard(tenantId, branchId);
    return dashboard;
  }

  async getDashboard(tenantId: string, branchId?: string | null): Promise<EmrDashboardResponse> {
    const branchFilter = branchId ? { branchId } : {};
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    const [todayEncounters, weekEncounters, pendingFollowUps, todayRows, activeEncounters, unsignedToday] =
      await Promise.all([
        this.prisma.encounter.count({
          where: { tenantId, deletedAt: null, createdAt: { gte: todayStart }, ...branchFilter },
        }),
        this.prisma.encounter.count({
          where: { tenantId, deletedAt: null, createdAt: { gte: weekStart }, ...branchFilter },
        }),
        this.prisma.encounter.count({
          where: {
            tenantId,
            deletedAt: null,
            followUpDate: { gte: todayStart },
            ...branchFilter,
          },
        }),
        this.prisma.encounter.findMany({
          where: { tenantId, deletedAt: null, createdAt: { gte: todayStart }, ...branchFilter },
          include: { patient: { select: { firstName: true, lastName: true } } },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
        this.prisma.encounter.count({
          where: {
            tenantId,
            deletedAt: null,
            status: { in: ['DRAFT', 'IN_PROGRESS'] },
            ...branchFilter,
          },
        }),
        this.prisma.encounter.count({
          where: {
            tenantId,
            deletedAt: null,
            createdAt: { gte: todayStart },
            status: { in: ['DRAFT', 'IN_PROGRESS', 'COMPLETED'] },
            signedAt: null,
            ...branchFilter,
          },
        }),
      ]);

    const patientsWithEncountersToday = new Set(todayRows.map((r) => r.patientId)).size;
    const openDocumentation = todayRows.filter((r) => this.isDocumentationIncomplete(r)).length;
    const pendingDocumentationList = todayRows
      .filter((r) => this.isDocumentationIncomplete(r))
      .slice(0, 10)
      .map((r) => this.toListItem(r));

    const patientIdsToday = [...new Set(todayRows.map((r) => r.patientId))];
    const patientsToday =
      patientIdsToday.length > 0
        ? await this.prisma.patient.findMany({
            where: { tenantId, id: { in: patientIdsToday }, deletedAt: null },
            select: { id: true, firstName: true, lastName: true, profileData: true },
          })
        : [];

    const clinicalAlerts: import('../../domain/emr.types').ClinicalAlert[] = [];
    for (const p of patientsToday) {
      const profile = (p.profileData ?? {}) as { allergies?: string[] };
      if (profile.allergies?.length) {
        clinicalAlerts.push({
          id: `allergy-${p.id}`,
          patientId: p.id,
          patientName: `${p.firstName} ${p.lastName}`.trim(),
          alertType: 'allergy',
          message: `Allergies: ${profile.allergies.join(', ')}`,
          severity: 'high',
        });
      }
    }
    for (const row of todayRows.filter((r) => this.isDocumentationIncomplete(r)).slice(0, 5)) {
      clinicalAlerts.push({
        id: `pending-${row.id}`,
        patientId: row.patientId,
        patientName: `${row.patient.firstName} ${row.patient.lastName}`.trim(),
        alertType: 'pending_documentation',
        message: row.chiefComplaint ?? 'Documentation incomplete',
        encounterId: row.id,
        severity: 'medium',
      });
    }
    for (const row of todayRows.filter((r) => !r.signedAt && r.status !== 'SIGNED').slice(0, 5)) {
      if (clinicalAlerts.some((a) => a.encounterId === row.id)) continue;
      clinicalAlerts.push({
        id: `unsigned-${row.id}`,
        patientId: row.patientId,
        patientName: `${row.patient.firstName} ${row.patient.lastName}`.trim(),
        alertType: 'unsigned_encounter',
        message: 'Encounter not signed',
        encounterId: row.id,
        severity: 'low',
      });
    }

    const followUpRows = await this.prisma.encounter.findMany({
      where: {
        tenantId,
        deletedAt: null,
        followUpDate: { gte: todayStart, lte: new Date(todayStart.getTime() + 14 * 86400000) },
        ...branchFilter,
      },
      include: { patient: { select: { firstName: true, lastName: true } } },
      orderBy: { followUpDate: 'asc' },
      take: 10,
    });

    const followUpTasks = followUpRows.map((r) => ({
      encounterId: r.id,
      patientId: r.patientId,
      patientName: `${r.patient.firstName} ${r.patient.lastName}`.trim(),
      followUpDate: r.followUpDate!.toISOString(),
      chiefComplaint: r.chiefComplaint,
    }));

    const documentedToday = todayRows.filter((r) => !this.isDocumentationIncomplete(r)).length;
    const documentationComplianceRate =
      todayRows.length > 0 ? Math.round((documentedToday / todayRows.length) * 100) : 100;

    return {
      todayEncounters,
      weekEncounters,
      pendingFollowUps,
      patientsWithEncountersToday,
      openDocumentation,
      unsignedToday,
      activeEncounters,
      recentEncounters: todayRows.slice(0, 8).map((r) => this.toListItem(r)),
      pendingDocumentationList,
      clinicalAlerts: clinicalAlerts.slice(0, 12),
      documentationComplianceRate,
      followUpTasks,
    };
  }

  async getPrescriptionHistory(
    tenantId: string,
    patientId: string,
    limit = 50,
  ): Promise<import('../../domain/emr.types').PrescriptionHistoryItem[]> {
    const rows = await this.prisma.encounter.findMany({
      where: { tenantId, patientId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, patientId: true, createdAt: true, medications: true },
    });

    const items: import('../../domain/emr.types').PrescriptionHistoryItem[] = [];
    for (const row of rows) {
      const meds = this.parseMedications(row.medications);
      meds.forEach((med, idx) => {
        items.push({
          id: `${row.id}-rx-${idx}`,
          encounterId: row.id,
          patientId: row.patientId,
          name: med.name,
          dose: med.dose,
          route: med.route,
          frequency: med.frequency,
          refillsAllowed: med.refillsAllowed ?? null,
          refillsRemaining: med.refillsRemaining ?? null,
          lastRefillDate: med.lastRefillDate ?? null,
          prescribedAt: row.createdAt.toISOString(),
        });
      });
    }
    return items;
  }

  async clinicalSearch(
    tenantId: string,
    branchId: string | null,
    q: string,
    limit = 20,
  ): Promise<ClinicalSearchResult> {
    const term = q.trim();
    if (!term) return { encounters: [], total: 0 };

    const branchFilter = branchId ? { branchId } : {};
    const where: Prisma.EncounterWhereInput = {
      tenantId,
      deletedAt: null,
      ...branchFilter,
      OR: [
        { chiefComplaint: { contains: term, mode: 'insensitive' } },
        { patient: { firstName: { contains: term, mode: 'insensitive' } } },
        { patient: { lastName: { contains: term, mode: 'insensitive' } } },
      ],
    };

    const [rows, total] = await Promise.all([
      this.prisma.encounter.findMany({
        where,
        take: Math.min(limit, 50),
        orderBy: { updatedAt: 'desc' },
        include: { patient: { select: { firstName: true, lastName: true } } },
      }),
      this.prisma.encounter.count({ where }),
    ]);

    return { total, encounters: rows.map((r) => this.toListItem(r)) };
  }

  async updateClinical(
    id: string,
    tenantId: string,
    input: {
      chiefComplaint?: string | null;
      clinicalNotes?: string | null;
      followUpDate?: string | null;
      diagnoses?: DiagnosisRecord[];
      medications?: MedicationRecord[];
      observations?: ObservationRecord[];
      appointmentId?: string | null;
    },
  ): Promise<EncounterDetail | null> {
    const existing = await this.prisma.encounter.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) return null;
    this.assertEditable(existing.status);

    let observations = input.observations ?? this.parseObservations(existing.observations);
    if (input.clinicalNotes !== undefined) {
      observations = observations.filter((o) => o.type !== CLINICAL_NOTES_TYPE);
      if (input.clinicalNotes?.trim()) {
        observations.push({ type: CLINICAL_NOTES_TYPE, value: input.clinicalNotes.trim() });
      }
    }

    const updated = await this.prisma.encounter.update({
      where: { id },
      data: {
        ...(input.chiefComplaint !== undefined ? { chiefComplaint: input.chiefComplaint } : {}),
        ...(input.followUpDate !== undefined
          ? { followUpDate: input.followUpDate ? new Date(input.followUpDate) : null }
          : {}),
        ...(input.appointmentId !== undefined ? { appointmentId: input.appointmentId } : {}),
        ...(input.diagnoses !== undefined ? { diagnoses: this.asJson(input.diagnoses) } : {}),
        ...(input.medications !== undefined
          ? { medications: this.asJson(input.medications) }
          : {}),
        ...(input.observations !== undefined || input.clinicalNotes !== undefined
          ? { observations: this.asJson(observations) }
          : {}),
      },
      include: { patient: { select: { firstName: true, lastName: true } } },
    });

    return this.toDetail(updated);
  }

  async updateSoapNotes(id: string, tenantId: string, soap: SoapNotes): Promise<EncounterDetail | null> {
    const existing = await this.prisma.encounter.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) return null;
    this.assertEditable(existing.status);

    const updated = await this.prisma.encounter.update({
      where: { id },
      data: { soapNotes: this.asJson(soap) },
      include: { patient: { select: { firstName: true, lastName: true } } },
    });
    return this.toDetail(updated);
  }

  async updateStructuredNotes(
    id: string,
    tenantId: string,
    notes: StructuredClinicalNote[],
  ): Promise<EncounterDetail | null> {
    const existing = await this.prisma.encounter.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) return null;
    this.assertEditable(existing.status);

    const updated = await this.prisma.encounter.update({
      where: { id },
      data: { structuredNotes: this.asJson(notes) },
      include: { patient: { select: { firstName: true, lastName: true } } },
    });
    return this.toDetail(updated);
  }

  async recordMedicationRefill(
    id: string,
    tenantId: string,
    medicationIndex: number,
  ): Promise<EncounterDetail | null> {
    const existing = await this.prisma.encounter.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) return null;
    this.assertEditable(existing.status);

    const medications = this.parseMedications(existing.medications);
    if (medicationIndex < 0 || medicationIndex >= medications.length) {
      throw new BadRequestException('Invalid medication index');
    }

    const med = medications[medicationIndex];
    const allowed = med.refillsAllowed ?? 0;
    const remaining = med.refillsRemaining ?? allowed;
    if (remaining <= 0) {
      throw new BadRequestException('No refills remaining');
    }

    medications[medicationIndex] = {
      ...med,
      refillsRemaining: remaining - 1,
      lastRefillDate: new Date().toISOString().slice(0, 10),
    };

    const updated = await this.prisma.encounter.update({
      where: { id },
      data: { medications: this.asJson(medications) },
      include: { patient: { select: { firstName: true, lastName: true } } },
    });
    return this.toDetail(updated);
  }

  async appendVitals(
    id: string,
    tenantId: string,
    newObservations: ObservationRecord[],
    recordedBy: string | null,
  ): Promise<EncounterDetail | null> {
    const existing = await this.prisma.encounter.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) return null;
    this.assertEditable(existing.status);

    const now = new Date().toISOString();
    const stamped = newObservations.map((o) => ({
      ...o,
      recordedAt: o.recordedAt ?? now,
      recordedBy: o.recordedBy ?? recordedBy ?? undefined,
    }));

    const observations = [...this.parseObservations(existing.observations), ...stamped];
    const updated = await this.prisma.encounter.update({
      where: { id },
      data: { observations: this.asJson(observations) },
      include: { patient: { select: { firstName: true, lastName: true } } },
    });
    return this.toDetail(updated);
  }

  async completeEncounter(
    id: string,
    tenantId: string,
    _actorUserId: string | null,
  ): Promise<EncounterDetail | null> {
    const existing = await this.prisma.encounter.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) return null;
    if (existing.status === 'SIGNED') {
      throw new BadRequestException('Signed encounters cannot be modified');
    }

    if (this.consentGate && existing.appointmentId) {
      const appt = await this.prisma.appointment.findFirst({
        where: { id: existing.appointmentId, tenantId, deletedAt: null },
        select: { clinicalServiceId: true, patientId: true },
      });
      if (appt?.clinicalServiceId) {
        await this.consentGate.assertRequiredConsentsSatisfied({
          tenantId,
          patientId: appt.patientId ?? existing.patientId,
          clinicalServiceId: appt.clinicalServiceId,
          appointmentId: existing.appointmentId,
        });
      }
    }

    const updated = await this.prisma.encounter.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: new Date() },
      include: { patient: { select: { firstName: true, lastName: true } } },
    });
    return this.toDetail(updated);
  }

  async signEncounter(
    id: string,
    tenantId: string,
    signedBy: string,
  ): Promise<EncounterDetail | null> {
    const existing = await this.prisma.encounter.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) return null;
    if (existing.status === 'SIGNED') {
      throw new BadRequestException('Encounter is already signed');
    }

    const updated = await this.prisma.encounter.update({
      where: { id },
      data: {
        status: 'SIGNED',
        signedAt: new Date(),
        signedBy,
        completedAt: existing.completedAt ?? new Date(),
      },
      include: { patient: { select: { firstName: true, lastName: true } } },
    });
    return this.toDetail(updated);
  }

  async coSignEncounter(
    id: string,
    tenantId: string,
    coSignedBy: string,
  ): Promise<EncounterDetail | null> {
    const existing = await this.prisma.encounter.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) return null;
    if (existing.status !== 'SIGNED' && existing.status !== 'COMPLETED') {
      throw new BadRequestException('Encounter must be completed or signed before co-signature');
    }
    if (existing.coSignedAt) {
      throw new BadRequestException('Encounter is already co-signed');
    }

    const updated = await this.prisma.encounter.update({
      where: { id },
      data: { coSignedAt: new Date(), coSignedBy },
      include: { patient: { select: { firstName: true, lastName: true } } },
    });
    return this.toDetail(updated);
  }

  extractClinicalNotes(observations: ObservationRecord[]): string | null {
    const note = observations.find((o) => o.type === CLINICAL_NOTES_TYPE);
    return note?.value?.trim() || null;
  }

  stripClinicalNotes(observations: ObservationRecord[]): ObservationRecord[] {
    return observations.filter((o) => o.type !== CLINICAL_NOTES_TYPE);
  }

  private asJson<T>(value: T): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private assertEditable(status: PrismaEncounterStatus): void {
    if (status === 'SIGNED') {
      throw new BadRequestException('Signed encounters are read-only');
    }
  }

  private buildWhere(filter: EncounterListFilter): Prisma.EncounterWhereInput {
    const where: Prisma.EncounterWhereInput = {
      tenantId: filter.tenantId,
      deletedAt: null,
    };
    if (filter.branchId) where.branchId = filter.branchId;
    if (filter.patientId) where.patientId = filter.patientId;
    if (filter.clinicianId) where.clinicianId = filter.clinicianId;
    if (filter.appointmentId) where.appointmentId = filter.appointmentId;
    if (filter.status) {
      where.status = filter.status.toUpperCase() as PrismaEncounterStatus;
    }
    if (filter.from || filter.to) {
      where.createdAt = {};
      if (filter.from) where.createdAt.gte = new Date(filter.from);
      if (filter.to) where.createdAt.lte = new Date(filter.to);
    }
    if (filter.q?.trim()) {
      const q = filter.q.trim();
      where.OR = [
        { chiefComplaint: { contains: q, mode: 'insensitive' } },
        { patient: { firstName: { contains: q, mode: 'insensitive' } } },
        { patient: { lastName: { contains: q, mode: 'insensitive' } } },
      ];
    }
    return where;
  }

  private isDocumentationIncomplete(row: {
    diagnoses: unknown;
    observations: unknown;
    soapNotes: unknown;
  }): boolean {
    const dx = this.parseDiagnoses(row.diagnoses);
    const obs = this.parseObservations(row.observations);
    const hasNotes = obs.some((o) => o.type === CLINICAL_NOTES_TYPE && o.value.trim());
    const soap = this.parseSoap(row.soapNotes);
    const hasSoap = Boolean(soap.subjective?.trim() || soap.assessment?.trim());
    return dx.length === 0 || (!hasNotes && !hasSoap);
  }

  private toListItem(row: {
    id: string;
    tenantId: string;
    branchId: string | null;
    patientId: string;
    clinicianId: string;
    appointmentId: string | null;
    chiefComplaint: string | null;
    status: PrismaEncounterStatus;
    diagnoses: unknown;
    medications: unknown;
    observations: unknown;
    followUpDate: Date | null;
    completedAt: Date | null;
    signedAt: Date | null;
    createdAt: Date;
    patient: { firstName: string; lastName: string };
  }): EncounterListItem {
    const diagnoses = this.parseDiagnoses(row.diagnoses);
    const medications = this.parseMedications(row.medications);
    const observations = this.stripClinicalNotes(this.parseObservations(row.observations));
    return {
      id: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      patientId: row.patientId,
      patientName: `${row.patient.firstName} ${row.patient.lastName}`.trim(),
      clinicianId: row.clinicianId,
      appointmentId: row.appointmentId,
      chiefComplaint: row.chiefComplaint,
      status: STATUS_MAP[row.status],
      diagnosesCount: diagnoses.length,
      medicationsCount: medications.length,
      observationsCount: observations.length,
      followUpDate: row.followUpDate?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
      signedAt: row.signedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toDetail(row: {
    id: string;
    tenantId: string;
    branchId: string | null;
    patientId: string;
    clinicianId: string;
    appointmentId: string | null;
    chiefComplaint: string | null;
    status: PrismaEncounterStatus;
    diagnoses: unknown;
    medications: unknown;
    observations: unknown;
    soapNotes: unknown;
    structuredNotes?: unknown;
    followUpDate: Date | null;
    completedAt: Date | null;
    signedAt: Date | null;
    signedBy: string | null;
    coSignedBy: string | null;
    coSignedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    patient: { firstName: string; lastName: string };
  }): EncounterDetail {
    const observations = this.parseObservations(row.observations);
    const clinicalNotes = this.extractClinicalNotes(observations);
    return {
      ...this.toListItem(row),
      diagnoses: this.parseDiagnoses(row.diagnoses),
      medications: this.parseMedications(row.medications),
      observations: this.stripClinicalNotes(observations),
      clinicalNotes,
      soapNotes: this.parseSoap(row.soapNotes),
      structuredNotes: this.parseStructuredNotes(row.structuredNotes),
      signedBy: row.signedBy,
      coSignedBy: row.coSignedBy,
      coSignedAt: row.coSignedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
      isReadOnly: row.status === 'SIGNED',
    };
  }

  private parseSoap(raw: unknown): SoapNotes {
    if (!raw || typeof raw !== 'object') return {};
    const s = raw as SoapNotes;
    return {
      subjective: s.subjective ?? '',
      objective: s.objective ?? '',
      assessment: s.assessment ?? '',
      plan: s.plan ?? '',
    };
  }

  private parseDiagnoses(raw: unknown): DiagnosisRecord[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((d) => ({
      code: String((d as DiagnosisRecord).code ?? ''),
      description: String((d as DiagnosisRecord).description ?? ''),
      system: (d as DiagnosisRecord).system,
      severity: (d as DiagnosisRecord).severity,
    }));
  }

  private parseMedications(raw: unknown): MedicationRecord[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((m) => ({
      name: String((m as MedicationRecord).name ?? ''),
      dose: (m as MedicationRecord).dose ?? null,
      route: (m as MedicationRecord).route ?? null,
      frequency: (m as MedicationRecord).frequency ?? null,
      refillsAllowed:
        (m as MedicationRecord).refillsAllowed != null
          ? Number((m as MedicationRecord).refillsAllowed)
          : null,
      refillsRemaining:
        (m as MedicationRecord).refillsRemaining != null
          ? Number((m as MedicationRecord).refillsRemaining)
          : null,
      lastRefillDate: (m as MedicationRecord).lastRefillDate ?? null,
    }));
  }

  private parseStructuredNotes(raw: unknown): StructuredClinicalNote[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((n) => {
      const note = n as StructuredClinicalNote;
      return {
        id: String(note.id ?? ''),
        type: (note.type ?? 'consultation') as StructuredClinicalNote['type'],
        title: note.title ?? null,
        body: note.body ?? null,
        soap: note.soap ? this.parseSoap(note.soap) : undefined,
        createdAt: String(note.createdAt ?? new Date().toISOString()),
      };
    });
  }

  private parseObservations(raw: unknown): ObservationRecord[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((o) => ({
      type: String((o as ObservationRecord).type ?? ''),
      value: String((o as ObservationRecord).value ?? ''),
      unit: (o as ObservationRecord).unit,
      recordedAt: (o as ObservationRecord).recordedAt,
      recordedBy: (o as ObservationRecord).recordedBy,
    }));
  }
}
