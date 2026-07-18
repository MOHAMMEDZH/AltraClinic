import { Inject, Injectable } from '@nestjs/common';
import { Prisma, NotificationStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { REPORT_REPOSITORY } from '../../../infrastructure/provider.tokens';
import { ReportRepository } from '../../reporting/domain/repositories/report.repository.interface';
import {
  GlobalSearchParams,
  SEARCH_ENTITY_TYPES,
  SEARCH_ENTITY_URLS,
  SearchEntityType,
  SearchHit,
  SearchMatchKind,
} from '../domain/search.types';

@Injectable()
export class PrismaGlobalSearchRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REPORT_REPOSITORY) private readonly reportRepository: ReportRepository,
  ) {}

  async search(params: GlobalSearchParams): Promise<SearchHit[]> {
    const q = params.query.trim();
    const perTypeLimit = Math.max(5, Math.ceil(params.limit * 1.5));
    const hits: SearchHit[] = [];

    const tasks = params.types.map(async (type) => {
      switch (type) {
        case SEARCH_ENTITY_TYPES.USER:
          hits.push(...(await this.searchUsers(params.tenantId, params.branchId, q, perTypeLimit)));
          break;
        case SEARCH_ENTITY_TYPES.PATIENT:
          hits.push(...(await this.searchPatients(params.tenantId, params.branchId, q, perTypeLimit)));
          break;
        case SEARCH_ENTITY_TYPES.APPOINTMENT:
          hits.push(...(await this.searchAppointments(params.tenantId, params.branchId, q, perTypeLimit)));
          break;
        case SEARCH_ENTITY_TYPES.DIAGNOSIS:
          hits.push(...(await this.searchDiagnoses(params.tenantId, params.branchId, q, perTypeLimit)));
          break;
        case SEARCH_ENTITY_TYPES.TREATMENT:
          hits.push(...(await this.searchTreatments(params.tenantId, q, perTypeLimit)));
          break;
        case SEARCH_ENTITY_TYPES.INVOICE:
          hits.push(...(await this.searchInvoices(params.tenantId, params.branchId, q, perTypeLimit)));
          break;
        case SEARCH_ENTITY_TYPES.INVENTORY:
          hits.push(...(await this.searchInventory(params.tenantId, params.branchId, q, perTypeLimit)));
          break;
        case SEARCH_ENTITY_TYPES.REPORT:
          hits.push(...(await this.searchReports(params.tenantId, params.branchId, q, perTypeLimit)));
          break;
        case SEARCH_ENTITY_TYPES.LAB_RESULT:
          hits.push(...(await this.searchLabResults(params.tenantId, q, perTypeLimit)));
          break;
        case SEARCH_ENTITY_TYPES.CARE_PLAN:
          hits.push(...(await this.searchCarePlans(params.tenantId, q, perTypeLimit)));
          break;
        case SEARCH_ENTITY_TYPES.NOTE_TEMPLATE:
          hits.push(...(await this.searchNoteTemplates(params.tenantId, q, perTypeLimit)));
          break;
        case SEARCH_ENTITY_TYPES.PROBLEM:
          hits.push(...(await this.searchProblems(params.tenantId, q, perTypeLimit)));
          break;
        case SEARCH_ENTITY_TYPES.ENCOUNTER:
          hits.push(...(await this.searchEncounters(params.tenantId, params.branchId, q, perTypeLimit)));
          break;
        case SEARCH_ENTITY_TYPES.DENTAL_PLAN:
          hits.push(...(await this.searchDentalPlans(params.tenantId, q, perTypeLimit)));
          break;
        case SEARCH_ENTITY_TYPES.DENTAL_ORTHO:
          hits.push(...(await this.searchDentalOrtho(params.tenantId, q, perTypeLimit)));
          break;
        case SEARCH_ENTITY_TYPES.DENTAL_IMPLANT:
          hits.push(...(await this.searchDentalImplants(params.tenantId, q, perTypeLimit)));
          break;
        case SEARCH_ENTITY_TYPES.DENTAL_NOTE:
          hits.push(...(await this.searchDentalNotes(params.tenantId, q, perTypeLimit)));
          break;
        case SEARCH_ENTITY_TYPES.DENTAL_IMAGE:
          hits.push(...(await this.searchDentalImages(params.tenantId, q, perTypeLimit)));
          break;
        case SEARCH_ENTITY_TYPES.BEAUTY_PLAN:
          hits.push(...(await this.searchBeautyPlans(params.tenantId, q, perTypeLimit)));
          break;
        case SEARCH_ENTITY_TYPES.BEAUTY_SESSION:
          hits.push(...(await this.searchBeautySessions(params.tenantId, q, perTypeLimit)));
          break;
        case SEARCH_ENTITY_TYPES.BEAUTY_CONSULTATION:
          hits.push(...(await this.searchBeautyConsultations(params.tenantId, q, perTypeLimit)));
          break;
        case SEARCH_ENTITY_TYPES.BEAUTY_IMAGE:
          hits.push(...(await this.searchBeautyImages(params.tenantId, q, perTypeLimit)));
          break;
        case SEARCH_ENTITY_TYPES.NOTIFICATION:
          hits.push(...(await this.searchNotifications(params.tenantId, q, perTypeLimit)));
          break;
        case SEARCH_ENTITY_TYPES.WORKFLOW:
          hits.push(...(await this.searchWorkflows(params.tenantId, q, perTypeLimit)));
          break;
        case SEARCH_ENTITY_TYPES.WORKFLOW_TASK:
          hits.push(...(await this.searchWorkflowTasks(params.tenantId, q, perTypeLimit)));
          break;
        case SEARCH_ENTITY_TYPES.WORKFLOW_TEMPLATE:
          hits.push(...(await this.searchWorkflowTemplates(params.tenantId, q, perTypeLimit)));
          break;
      }
    });

    await Promise.all(tasks);
    return hits;
  }

  private branchFilter(branchId?: string | null): Prisma.PatientWhereInput {
    if (!branchId) return {};
    return { branchId };
  }

  private classifyMatch(value: string | null | undefined, query: string): SearchMatchKind {
    if (!value) return 'secondary';
    const v = value.toLowerCase();
    const q = query.toLowerCase();
    if (v === q) return 'exact';
    if (v.startsWith(q)) return 'prefix';
    if (v.includes(q)) return 'contains';
    return 'secondary';
  }

  private bestMatchKind(fields: (string | null | undefined)[], query: string): SearchMatchKind {
    const kinds = fields.map((f) => this.classifyMatch(f, query));
    if (kinds.includes('exact')) return 'exact';
    if (kinds.includes('prefix')) return 'prefix';
    if (kinds.includes('contains')) return 'contains';
    return 'secondary';
  }

  private async searchUsers(
    tenantId: string,
    branchId: string | null | undefined,
    q: string,
    limit: number,
  ): Promise<SearchHit[]> {
    const rows = await this.prisma.user.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
        OR: [
          { email: { contains: q, mode: 'insensitive' } },
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { firstNameAr: { contains: q, mode: 'insensitive' } },
          { lastNameAr: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q } },
        ],
      },
      take: limit,
      orderBy: { updatedAt: 'desc' },
    });

    return rows.map((row) => ({
      type: SEARCH_ENTITY_TYPES.USER,
      id: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      title: `${row.firstName} ${row.lastName}`.trim(),
      subtitle: row.email,
      url: SEARCH_ENTITY_URLS.user(row.id),
      matchKind: this.bestMatchKind([row.email, row.firstName, row.lastName, row.phone ?? ''], q),
      matchedField: 'name',
      createdAt: row.createdAt,
      metadata: row.email ? { email: row.email } : undefined,
    }));
  }

  private async searchPatients(
    tenantId: string,
    branchId: string | null | undefined,
    q: string,
    limit: number,
  ): Promise<SearchHit[]> {
    const rows = await this.prisma.patient.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...this.branchFilter(branchId),
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { firstNameAr: { contains: q, mode: 'insensitive' } },
          { lastNameAr: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q } },
          { email: { contains: q, mode: 'insensitive' } },
          { nationalId: { equals: q } },
          { nationalId: { contains: q } },
        ],
      },
      take: limit,
      orderBy: { updatedAt: 'desc' },
    });

    return rows.map((row) => {
      const title = `${row.firstName} ${row.lastName}`.trim();
      const matchKind = this.bestMatchKind(
        [row.phone, row.nationalId, row.email, row.firstName, row.lastName],
        q,
      );
      return {
        type: SEARCH_ENTITY_TYPES.PATIENT,
        id: row.id,
        tenantId: row.tenantId,
        branchId: row.branchId,
        title,
        subtitle: row.phone ?? row.email ?? null,
        url: SEARCH_ENTITY_URLS.patient(row.id),
        matchKind,
        matchedField: matchKind === 'exact' && row.nationalId === q ? 'nationalId' : 'name',
        createdAt: row.createdAt,
        metadata: row.phone ? { phone: row.phone } : undefined,
      };
    });
  }

  private async searchAppointments(
    tenantId: string,
    branchId: string | null | undefined,
    q: string,
    limit: number,
  ): Promise<SearchHit[]> {
    const rows = await this.prisma.appointment.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
        OR: [
          { notes: { contains: q, mode: 'insensitive' } },
          {
            patient: {
              OR: [
                { firstName: { contains: q, mode: 'insensitive' } },
                { lastName: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q } },
              ],
            },
          },
        ],
      },
      include: {
        patient: { select: { firstName: true, lastName: true, phone: true } },
      },
      take: limit,
      orderBy: { scheduledStart: 'desc' },
    });

    return rows.map((row) => ({
      type: SEARCH_ENTITY_TYPES.APPOINTMENT,
      id: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      title: `Appointment — ${row.patient.firstName} ${row.patient.lastName}`,
      subtitle: row.scheduledStart.toISOString(),
      url: SEARCH_ENTITY_URLS.appointment(row.id),
      matchKind: this.bestMatchKind([row.notes, row.patient.phone, row.patient.firstName], q),
      matchedField: 'appointment',
      createdAt: row.createdAt,
      metadata: { status: row.status },
    }));
  }

  private async searchDiagnoses(
    tenantId: string,
    branchId: string | null | undefined,
    q: string,
    limit: number,
  ): Promise<SearchHit[]> {
    const pattern = `%${q}%`;
    const branchClause = branchId
      ? Prisma.sql`AND e."branchId" = ${branchId}::uuid`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        tenant_id: string;
        branch_id: string | null;
        patient_id: string;
        chief_complaint: string | null;
        created_at: Date;
        first_name: string;
        last_name: string;
      }>
    >`
      SELECT e.id, e."tenantId" AS tenant_id, e."branchId" AS branch_id, e."patientId" AS patient_id,
             e."chiefComplaint" AS chief_complaint, e."createdAt" AS created_at,
             p."firstName" AS first_name, p."lastName" AS last_name
      FROM encounters e
      INNER JOIN patients p ON p.id = e."patientId"
      WHERE e."tenantId" = ${tenantId}::uuid
        AND e."deletedAt" IS NULL
        ${branchClause}
        AND (
          e."chiefComplaint" ILIKE ${pattern}
          OR e.diagnoses::text ILIKE ${pattern}
        )
      ORDER BY e."createdAt" DESC
      LIMIT ${limit}
    `;

    return rows.map((row) => ({
      type: SEARCH_ENTITY_TYPES.DIAGNOSIS,
      id: row.id,
      tenantId: row.tenant_id,
      branchId: row.branch_id,
      title: row.chief_complaint?.slice(0, 120) || `Encounter — ${row.first_name} ${row.last_name}`,
      subtitle: `${row.first_name} ${row.last_name}`,
      url: SEARCH_ENTITY_URLS.diagnosis(row.id),
      matchKind: this.classifyMatch(row.chief_complaint, q),
      matchedField: 'diagnoses',
      createdAt: row.created_at,
    }));
  }

  private async searchTreatments(
    tenantId: string,
    q: string,
    limit: number,
  ): Promise<SearchHit[]> {
    const half = Math.ceil(limit / 2);

    const [dental, beauty] = await Promise.all([
      this.prisma.dentalToothCondition.findMany({
        where: {
          tenantId,
          OR: [
            { conditionCode: { contains: q, mode: 'insensitive' } },
            { notes: { contains: q, mode: 'insensitive' } },
            { toothId: { contains: q } },
          ],
        },
        take: half,
        orderBy: { recordedAt: 'desc' },
        include: { dentalRecord: { select: { patientId: true } } },
      }),
      this.prisma.beautyAnnotation.findMany({
        where: {
          tenantId,
          OR: [
            { zone: { contains: q, mode: 'insensitive' } },
            { treatment: { contains: q, mode: 'insensitive' } },
            { notes: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: half,
        orderBy: { recordedAt: 'desc' },
        include: { beautyRecord: { select: { patientId: true } } },
      }),
    ]);

    const dentalHits: SearchHit[] = dental.map((row) => {
      const patientId = row.dentalRecord?.patientId ?? '';
      return {
        type: SEARCH_ENTITY_TYPES.TREATMENT,
        id: row.id,
        tenantId: row.tenantId,
        branchId: null,
        title: `Dental — ${row.conditionCode} (tooth ${row.toothId})`,
        subtitle: row.notes,
        url: patientId ? `/dental/chart/${patientId}?tab=procedures` : SEARCH_ENTITY_URLS.treatment(row.id),
        matchKind: this.bestMatchKind([row.conditionCode, row.notes, row.toothId], q),
        matchedField: 'dental',
        createdAt: row.recordedAt,
        metadata: { domain: 'dental', patientId },
      };
    });

    const beautyHits: SearchHit[] = beauty.map((row) => {
      const patientId = row.beautyRecord?.patientId ?? '';
      return {
        type: SEARCH_ENTITY_TYPES.TREATMENT,
        id: row.id,
        tenantId: row.tenantId,
        branchId: null,
        title: `Beauty — ${row.treatment} (${row.zone})`,
        subtitle: row.notes,
        url: patientId ? `/beauty/workspace/${patientId}?tab=face` : SEARCH_ENTITY_URLS.treatment(row.id),
        matchKind: this.bestMatchKind([row.treatment, row.zone, row.notes], q),
        matchedField: 'beauty',
        createdAt: row.recordedAt,
        metadata: { domain: 'beauty', patientId },
      };
    });

    return [...dentalHits, ...beautyHits];
  }

  private async searchInvoices(
    tenantId: string,
    branchId: string | null | undefined,
    q: string,
    limit: number,
  ): Promise<SearchHit[]> {
    const rows = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
        OR: [
          { invoiceNumber: { contains: q, mode: 'insensitive' } },
          { notes: { contains: q, mode: 'insensitive' } },
          {
            patient: {
              OR: [
                { firstName: { contains: q, mode: 'insensitive' } },
                { lastName: { contains: q, mode: 'insensitive' } },
              ],
            },
          },
          {
            lineItems: {
              some: {
                OR: [
                  { description: { contains: q, mode: 'insensitive' } },
                  { serviceCode: { contains: q, mode: 'insensitive' } },
                ],
              },
            },
          },
        ],
      },
      include: {
        patient: { select: { firstName: true, lastName: true } },
      },
      take: limit,
      orderBy: { invoiceDate: 'desc' },
    });

    return rows.map((row) => ({
      type: SEARCH_ENTITY_TYPES.INVOICE,
      id: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      title: `Invoice ${row.invoiceNumber}`,
      subtitle: `${row.patient.firstName} ${row.patient.lastName} — ${row.status}`,
      url: SEARCH_ENTITY_URLS.invoice(row.id),
      matchKind: this.bestMatchKind([row.invoiceNumber, row.notes], q),
      matchedField: 'invoiceNumber',
      createdAt: row.createdAt,
      metadata: { status: row.status },
    }));
  }

  private async searchInventory(
    tenantId: string,
    branchId: string | null | undefined,
    q: string,
    limit: number,
  ): Promise<SearchHit[]> {
    const rows = await this.prisma.inventoryItem.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
        OR: [
          { sku: { contains: q, mode: 'insensitive' } },
          { nameEn: { contains: q, mode: 'insensitive' } },
          { nameAr: { contains: q, mode: 'insensitive' } },
          { lotNumber: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: limit,
      orderBy: { updatedAt: 'desc' },
    });

    return rows.map((row) => ({
      type: SEARCH_ENTITY_TYPES.INVENTORY,
      id: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      title: row.nameEn,
      subtitle: `SKU: ${row.sku}`,
      url: SEARCH_ENTITY_URLS.inventory(row.id),
      matchKind: this.bestMatchKind([row.sku, row.nameEn, row.nameAr, row.lotNumber], q),
      matchedField: row.sku.toLowerCase() === q.toLowerCase() ? 'sku' : 'nameEn',
      createdAt: row.createdAt,
    }));
  }

  private async searchReports(
    tenantId: string,
    branchId: string | null | undefined,
    q: string,
    limit: number,
  ): Promise<SearchHit[]> {
    const reports = await this.reportRepository.list({ tenantId, branchId: branchId ?? undefined });
    const qLower = q.toLowerCase();

    return reports
      .filter(
        (r) =>
          r.name.toLowerCase().includes(qLower) ||
          r.type.type.toLowerCase().includes(qLower),
      )
      .slice(0, limit)
      .map((row) => ({
        type: SEARCH_ENTITY_TYPES.REPORT as SearchEntityType,
        id: row.reportId,
        tenantId: row.tenantId,
        branchId: row.branchId,
        title: row.name,
        subtitle: row.type.type,
        url: SEARCH_ENTITY_URLS.report(row.reportId),
        matchKind: this.classifyMatch(row.name, q),
        matchedField: 'name',
        createdAt: row.createdAt,
        metadata: { status: row.status.status },
      }));
  }

  private async searchLabResults(tenantId: string, q: string, limit: number): Promise<SearchHit[]> {
    const rows = await this.prisma.labResult.findMany({
      where: {
        tenantId,
        OR: [
          { testName: { contains: q, mode: 'insensitive' } },
          { value: { contains: q, mode: 'insensitive' } },
          { notes: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: limit,
      orderBy: { resultedAt: 'desc' },
    });

    return rows.map((row) => ({
      type: SEARCH_ENTITY_TYPES.LAB_RESULT,
      id: row.id,
      tenantId: row.tenantId,
      branchId: null,
      title: `${row.testName}: ${row.value}${row.unit ? ` ${row.unit}` : ''}`,
      subtitle: row.status,
      url: row.encounterId
        ? `/encounters/${row.encounterId}?tab=labs`
        : `/patients/${row.patientId}`,
      matchKind: this.bestMatchKind([row.testName, row.value, row.notes], q),
      matchedField: 'testName',
      createdAt: row.createdAt,
      metadata: { patientId: row.patientId, status: row.status ?? '' },
    }));
  }

  private async searchCarePlans(tenantId: string, q: string, limit: number): Promise<SearchHit[]> {
    const rows = await this.prisma.treatmentPlan.findMany({
      where: {
        tenantId,
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { clinicalNotes: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: { patient: { select: { firstName: true, lastName: true } } },
      take: limit,
      orderBy: { updatedAt: 'desc' },
    });

    return rows.map((row) => ({
      type: SEARCH_ENTITY_TYPES.CARE_PLAN,
      id: row.id,
      tenantId: row.tenantId,
      branchId: null,
      title: row.title,
      subtitle: `${row.patient.firstName} ${row.patient.lastName} — ${row.status}`,
      url: `/encounters?patientId=${row.patientId}`,
      matchKind: this.bestMatchKind([row.title, row.clinicalNotes], q),
      matchedField: 'title',
      createdAt: row.createdAt,
      metadata: { patientId: row.patientId, status: row.status },
    }));
  }

  private async searchNoteTemplates(tenantId: string, q: string, limit: number): Promise<SearchHit[]> {
    const rows = await this.prisma.clinicalNoteTemplate.findMany({
      where: {
        tenantId,
        isActive: true,
        name: { contains: q, mode: 'insensitive' },
      },
      take: limit,
      orderBy: { sortOrder: 'asc' },
    });

    return rows.map((row) => ({
      type: SEARCH_ENTITY_TYPES.NOTE_TEMPLATE,
      id: row.id,
      tenantId: row.tenantId,
      branchId: null,
      title: row.name,
      subtitle: row.noteType,
      url: '/encounters',
      matchKind: this.classifyMatch(row.name, q),
      matchedField: 'name',
      createdAt: row.createdAt,
    }));
  }

  private async searchProblems(tenantId: string, q: string, limit: number): Promise<SearchHit[]> {
    const rows = await this.prisma.patientProblem.findMany({
      where: {
        tenantId,
        OR: [
          { description: { contains: q, mode: 'insensitive' } },
          { code: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: { patient: { select: { firstName: true, lastName: true } } },
      take: limit,
      orderBy: { updatedAt: 'desc' },
    });

    return rows.map((row) => ({
      type: SEARCH_ENTITY_TYPES.PROBLEM,
      id: row.id,
      tenantId: row.tenantId,
      branchId: null,
      title: row.description,
      subtitle: `${row.patient.firstName} ${row.patient.lastName}${row.code ? ` · ${row.code}` : ''}`,
      url: `/patients/${row.patientId}`,
      matchKind: this.bestMatchKind([row.description, row.code], q),
      matchedField: 'description',
      createdAt: row.createdAt,
      metadata: { status: row.status },
    }));
  }

  private async searchEncounters(
    tenantId: string,
    branchId: string | null | undefined,
    q: string,
    limit: number,
  ): Promise<SearchHit[]> {
    const rows = await this.prisma.encounter.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
        OR: [
          { chiefComplaint: { contains: q, mode: 'insensitive' } },
          { patient: { firstName: { contains: q, mode: 'insensitive' } } },
          { patient: { lastName: { contains: q, mode: 'insensitive' } } },
        ],
      },
      include: { patient: { select: { firstName: true, lastName: true } } },
      take: limit,
      orderBy: { updatedAt: 'desc' },
    });

    return rows.map((row) => ({
      type: SEARCH_ENTITY_TYPES.ENCOUNTER,
      id: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      title: row.chiefComplaint ?? `Encounter — ${row.patient.firstName} ${row.patient.lastName}`,
      subtitle: `${row.patient.firstName} ${row.patient.lastName}`,
      url: `/encounters/${row.id}`,
      matchKind: this.bestMatchKind([row.chiefComplaint], q),
      matchedField: 'chiefComplaint',
      createdAt: row.createdAt,
      metadata: { status: row.status },
    }));
  }

  private async searchDentalPlans(tenantId: string, q: string, limit: number): Promise<SearchHit[]> {
    const rows = await this.prisma.treatmentPlan.findMany({
      where: {
        tenantId,
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { clinicalNotes: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: { patient: { select: { firstName: true, lastName: true } } },
      take: limit,
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row) => ({
      type: SEARCH_ENTITY_TYPES.DENTAL_PLAN,
      id: `${row.patientId}:${row.id}`,
      tenantId: row.tenantId,
      branchId: null,
      title: row.title,
      subtitle: `${row.patient.firstName} ${row.patient.lastName} · ${row.status}`,
      url: SEARCH_ENTITY_URLS.dental_plan(`${row.patientId}:${row.id}`),
      matchKind: this.bestMatchKind([row.title, row.clinicalNotes], q),
      matchedField: 'title',
      createdAt: row.updatedAt,
    }));
  }

  private async searchDentalOrtho(tenantId: string, q: string, limit: number): Promise<SearchHit[]> {
    const rows = await this.prisma.orthodonticCase.findMany({
      where: {
        tenantId,
        OR: [
          { applianceType: { contains: q, mode: 'insensitive' } },
          { notes: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: { patient: { select: { firstName: true, lastName: true } } },
      take: limit,
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row) => ({
      type: SEARCH_ENTITY_TYPES.DENTAL_ORTHO,
      id: `${row.patientId}:${row.id}`,
      tenantId: row.tenantId,
      branchId: null,
      title: `Ortho — ${row.applianceType}`,
      subtitle: `${row.patient.firstName} ${row.patient.lastName}`,
      url: SEARCH_ENTITY_URLS.dental_ortho(`${row.patientId}:${row.id}`),
      matchKind: this.bestMatchKind([row.applianceType, row.notes], q),
      matchedField: 'applianceType',
      createdAt: row.updatedAt,
    }));
  }

  private async searchDentalImplants(tenantId: string, q: string, limit: number): Promise<SearchHit[]> {
    const rows = await this.prisma.implantRecord.findMany({
      where: {
        tenantId,
        OR: [
          { toothId: { contains: q } },
          { implantSystem: { contains: q, mode: 'insensitive' } },
          { notes: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: { patient: { select: { firstName: true, lastName: true } } },
      take: limit,
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row) => ({
      type: SEARCH_ENTITY_TYPES.DENTAL_IMPLANT,
      id: `${row.patientId}:${row.id}`,
      tenantId: row.tenantId,
      branchId: null,
      title: `Implant tooth ${row.toothId}`,
      subtitle: row.implantSystem ?? `${row.patient.firstName} ${row.patient.lastName}`,
      url: SEARCH_ENTITY_URLS.dental_implant(`${row.patientId}:${row.id}`),
      matchKind: this.bestMatchKind([row.toothId, row.implantSystem, row.notes], q),
      matchedField: 'toothId',
      createdAt: row.updatedAt,
    }));
  }

  private async searchDentalNotes(tenantId: string, q: string, limit: number): Promise<SearchHit[]> {
    const rows = await this.prisma.dentalClinicalNote.findMany({
      where: {
        tenantId,
        OR: [
          { content: { contains: q, mode: 'insensitive' } },
          { noteType: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: { patient: { select: { firstName: true, lastName: true } } },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      type: SEARCH_ENTITY_TYPES.DENTAL_NOTE,
      id: `${row.patientId}:${row.id}`,
      tenantId: row.tenantId,
      branchId: null,
      title: `Dental note — ${row.noteType}`,
      subtitle: row.content.slice(0, 80),
      url: SEARCH_ENTITY_URLS.dental_note(`${row.patientId}:${row.id}`),
      matchKind: this.bestMatchKind([row.content, row.noteType], q),
      matchedField: 'content',
      createdAt: row.createdAt,
    }));
  }

  private async searchDentalImages(tenantId: string, q: string, limit: number): Promise<SearchHit[]> {
    const rows = await this.prisma.mediaAsset.findMany({
      where: {
        tenantId,
        ownerType: { in: ['dental_chart', 'patient'] },
        originalFilename: { contains: q, mode: 'insensitive' },
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      type: SEARCH_ENTITY_TYPES.DENTAL_IMAGE,
      id: `${row.patientId ?? row.ownerId}:${row.id}`,
      tenantId: row.tenantId,
      branchId: row.branchId,
      title: row.originalFilename,
      subtitle: String(row.category),
      url: row.patientId
        ? SEARCH_ENTITY_URLS.dental_image(`${row.patientId}:${row.id}`)
        : `/dental/imaging/${row.ownerId}`,
      matchKind: this.bestMatchKind([row.originalFilename], q),
      matchedField: 'originalFilename',
      createdAt: row.createdAt,
    }));
  }

  private async searchBeautyRecords(tenantId: string) {
    return this.prisma.beautyRecord.findMany({
      where: { tenantId },
      include: { patient: { select: { firstName: true, lastName: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
  }

  private matchesQ(text: string | undefined | null, q: string): boolean {
    if (!text) return false;
    return text.toLowerCase().includes(q.toLowerCase());
  }

  private async searchBeautyPlans(tenantId: string, q: string, limit: number): Promise<SearchHit[]> {
    const rows = await this.searchBeautyRecords(tenantId);
    const hits: SearchHit[] = [];
    for (const row of rows) {
      const state = row.bodyMapState as {
        treatmentPlans?: { id: string; title?: string; status?: string; notes?: string }[];
      } | null;
      for (const plan of state?.treatmentPlans ?? []) {
        if (!this.matchesQ(plan.title, q) && !this.matchesQ(plan.notes, q) && !this.matchesQ(plan.status, q)) continue;
        hits.push({
          type: SEARCH_ENTITY_TYPES.BEAUTY_PLAN,
          id: `${row.patientId}:${plan.id}`,
          tenantId: row.tenantId,
          branchId: null,
          title: plan.title ?? 'Beauty plan',
          subtitle: `${row.patient.firstName} ${row.patient.lastName} · ${plan.status ?? ''}`,
          url: SEARCH_ENTITY_URLS.beauty_plan(`${row.patientId}:${plan.id}`),
          matchKind: this.bestMatchKind([plan.title, plan.notes, plan.status], q),
          matchedField: 'title',
          createdAt: row.updatedAt,
        });
        if (hits.length >= limit) return hits;
      }
    }
    return hits;
  }

  private async searchBeautySessions(tenantId: string, q: string, limit: number): Promise<SearchHit[]> {
    const rows = await this.searchBeautyRecords(tenantId);
    const hits: SearchHit[] = [];
    for (const row of rows) {
      const state = row.bodyMapState as {
        sessions?: { id: string; type?: string; status?: string; notes?: string }[];
      } | null;
      for (const session of state?.sessions ?? []) {
        if (!this.matchesQ(session.type, q) && !this.matchesQ(session.notes, q) && !this.matchesQ(session.status, q)) continue;
        hits.push({
          type: SEARCH_ENTITY_TYPES.BEAUTY_SESSION,
          id: `${row.patientId}:${session.id}`,
          tenantId: row.tenantId,
          branchId: null,
          title: `Beauty session — ${session.type ?? 'treatment'}`,
          subtitle: `${row.patient.firstName} ${row.patient.lastName} · ${session.status ?? ''}`,
          url: SEARCH_ENTITY_URLS.beauty_session(`${row.patientId}:${session.id}`),
          matchKind: this.bestMatchKind([session.type, session.notes, session.status], q),
          matchedField: 'type',
          createdAt: row.updatedAt,
        });
        if (hits.length >= limit) return hits;
      }
    }
    return hits;
  }

  private async searchBeautyConsultations(tenantId: string, q: string, limit: number): Promise<SearchHit[]> {
    const rows = await this.searchBeautyRecords(tenantId);
    const hits: SearchHit[] = [];
    for (const row of rows) {
      const state = row.bodyMapState as {
        consultations?: { id: string; type?: string; notes?: string }[];
      } | null;
      for (const c of state?.consultations ?? []) {
        if (!this.matchesQ(c.type, q) && !this.matchesQ(c.notes, q)) continue;
        hits.push({
          type: SEARCH_ENTITY_TYPES.BEAUTY_CONSULTATION,
          id: `${row.patientId}:${c.id}`,
          tenantId: row.tenantId,
          branchId: null,
          title: `Beauty consultation — ${c.type ?? 'consult'}`,
          subtitle: `${row.patient.firstName} ${row.patient.lastName}`,
          url: SEARCH_ENTITY_URLS.beauty_consultation(`${row.patientId}:${c.id}`),
          matchKind: this.bestMatchKind([c.type, c.notes], q),
          matchedField: 'type',
          createdAt: row.updatedAt,
        });
        if (hits.length >= limit) return hits;
      }
    }
    return hits;
  }

  private async searchBeautyImages(tenantId: string, q: string, limit: number): Promise<SearchHit[]> {
    const rows = await this.prisma.mediaAsset.findMany({
      where: {
        tenantId,
        category: 'BEAUTY_BEFORE_AFTER',
        deletedAt: null,
        originalFilename: { contains: q, mode: 'insensitive' },
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      type: SEARCH_ENTITY_TYPES.BEAUTY_IMAGE,
      id: `${row.patientId ?? row.ownerId}:${row.id}`,
      tenantId: row.tenantId,
      branchId: row.branchId,
      title: row.originalFilename,
      subtitle: row.comparisonRole ?? 'beauty',
      url: row.patientId
        ? SEARCH_ENTITY_URLS.beauty_image(`${row.patientId}:${row.id}`)
        : `/beauty/imaging/${row.ownerId}`,
      matchKind: this.bestMatchKind([row.originalFilename], q),
      matchedField: 'originalFilename',
      createdAt: row.createdAt,
    }));
  }

  private async searchNotifications(tenantId: string, q: string, limit: number): Promise<SearchHit[]> {
    const rows = await this.prisma.notification.findMany({
      where: {
        tenantId,
        status: { not: 'DRAFT' as NotificationStatus },
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { body: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      type: SEARCH_ENTITY_TYPES.NOTIFICATION,
      id: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      title: row.title,
      subtitle: row.body.slice(0, 120),
      url: SEARCH_ENTITY_URLS.notification(row.id),
      matchKind: this.bestMatchKind([row.title, row.body], q),
      matchedField: 'title',
      createdAt: row.createdAt,
    }));
  }

  private async searchWorkflows(tenantId: string, q: string, limit: number): Promise<SearchHit[]> {
    const rows = await this.prisma.workflow.findMany({
      where: {
        tenantId,
        OR: [
          { nameEn: { contains: q, mode: 'insensitive' } },
          { nameAr: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: limit,
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row) => ({
      type: SEARCH_ENTITY_TYPES.WORKFLOW,
      id: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      title: row.nameEn,
      subtitle: row.status,
      url: SEARCH_ENTITY_URLS.workflow(row.id),
      matchKind: this.bestMatchKind([row.nameEn, row.nameAr], q),
      matchedField: 'nameEn',
      createdAt: row.createdAt,
    }));
  }

  private async searchWorkflowTasks(tenantId: string, q: string, limit: number): Promise<SearchHit[]> {
    const rows = await this.prisma.workflowTask.findMany({
      where: {
        tenantId,
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { titleAr: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: limit,
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row) => ({
      type: SEARCH_ENTITY_TYPES.WORKFLOW_TASK,
      id: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      title: row.title,
      subtitle: row.status,
      url: SEARCH_ENTITY_URLS.workflow_task(row.id),
      matchKind: this.bestMatchKind([row.title, row.titleAr], q),
      matchedField: 'title',
      createdAt: row.createdAt,
    }));
  }

  private async searchWorkflowTemplates(tenantId: string, q: string, limit: number): Promise<SearchHit[]> {
    const rows = await this.prisma.workflowTemplate.findMany({
      where: {
        tenantId,
        OR: [
          { nameEn: { contains: q, mode: 'insensitive' } },
          { key: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: limit,
      orderBy: { nameEn: 'asc' },
    });
    return rows.map((row) => ({
      type: SEARCH_ENTITY_TYPES.WORKFLOW_TEMPLATE,
      id: row.id,
      tenantId: row.tenantId,
      branchId: null,
      title: row.nameEn,
      subtitle: row.triggerType,
      url: SEARCH_ENTITY_URLS.workflow_template(row.id),
      matchKind: this.bestMatchKind([row.nameEn, row.key], q),
      matchedField: 'nameEn',
      createdAt: row.createdAt,
    }));
  }
}
