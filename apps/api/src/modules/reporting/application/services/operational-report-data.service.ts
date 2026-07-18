import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';

export interface OperationalReportRows {
  headers: string[];
  rows: string[][];
  title: string;
}

@Injectable()
export class OperationalReportDataService {
  constructor(private readonly prisma: PrismaService) {}

  async build(
    tenantId: string,
    reportType: string,
    dateStart: Date,
    dateEnd: Date,
    branchId?: string | null,
  ): Promise<OperationalReportRows> {
    switch (reportType) {
      case 'patient-report':
        return this.buildPatientReport(tenantId, branchId);
      case 'revenue-report':
        return this.buildRevenueReport(tenantId, dateStart, dateEnd, branchId);
      case 'compliance-report':
        return this.buildComplianceReport(tenantId, dateStart, dateEnd);
      case 'appointment-report':
      default:
        return this.buildAppointmentReport(tenantId, dateStart, dateEnd, branchId);
    }
  }

  private async buildAppointmentReport(
    tenantId: string,
    dateStart: Date,
    dateEnd: Date,
    branchId?: string | null,
  ): Promise<OperationalReportRows> {
    const rows = await this.prisma.appointment.findMany({
      where: {
        tenantId,
        deletedAt: null,
        scheduledStart: { gte: dateStart, lte: dateEnd },
        ...(branchId ? { branchId } : {}),
      },
      orderBy: { scheduledStart: 'desc' },
      take: 5000,
      select: {
        id: true,
        patientId: true,
        providerId: true,
        scheduledStart: true,
        status: true,
        branchId: true,
      },
    });
    return {
      title: 'Appointment report',
      headers: ['ID', 'Patient', 'Provider', 'Scheduled', 'Status', 'Branch'],
      rows: rows.map((r) => [
        r.id,
        r.patientId,
        r.providerId,
        r.scheduledStart.toISOString(),
        r.status,
        r.branchId ?? '',
      ]),
    };
  }

  private async buildPatientReport(
    tenantId: string,
    branchId?: string | null,
  ): Promise<OperationalReportRows> {
    const rows = await this.prisma.patient.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        createdAt: true,
        branchId: true,
      },
    });
    return {
      title: 'Patient report',
      headers: ['ID', 'First name', 'Last name', 'Phone', 'Created', 'Branch'],
      rows: rows.map((r) => [
        r.id,
        r.firstName,
        r.lastName,
        r.phone ?? '',
        r.createdAt.toISOString(),
        r.branchId ?? '',
      ]),
    };
  }

  private async buildRevenueReport(
    tenantId: string,
    dateStart: Date,
    dateEnd: Date,
    branchId?: string | null,
  ): Promise<OperationalReportRows> {
    const rows = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        deletedAt: null,
        invoiceDate: { gte: dateStart, lte: dateEnd },
        ...(branchId ? { branchId } : {}),
      },
      orderBy: { invoiceDate: 'desc' },
      take: 5000,
      select: {
        id: true,
        invoiceNumber: true,
        amountTotal: true,
        status: true,
        invoiceDate: true,
        branchId: true,
      },
    });
    return {
      title: 'Revenue report',
      headers: ['ID', 'Invoice #', 'Amount', 'Status', 'Issued', 'Branch'],
      rows: rows.map((r) => [
        r.id,
        r.invoiceNumber,
        String(r.amountTotal),
        String(r.status),
        r.invoiceDate.toISOString().slice(0, 10),
        r.branchId ?? '',
      ]),
    };
  }

  private async buildComplianceReport(
    tenantId: string,
    dateStart: Date,
    dateEnd: Date,
  ): Promise<OperationalReportRows> {
    const rows = await this.prisma.auditEntry.findMany({
      where: {
        tenantId,
        createdAt: { gte: dateStart, lte: dateEnd },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
      select: {
        id: true,
        action: true,
        resourceType: true,
        actorId: true,
        createdAt: true,
        category: true,
      },
    });
    return {
      title: 'Compliance / audit report',
      headers: ['ID', 'Action', 'Resource', 'Actor', 'Category', 'Created'],
      rows: rows.map((r) => [
        r.id,
        r.action,
        r.resourceType,
        r.actorId,
        r.category,
        r.createdAt.toISOString(),
      ]),
    };
  }

  static toCsv(data: OperationalReportRows, reportName: string): string {
    const lines = [`# ${reportName}`, `# ${data.title}`, '', data.headers.join(',')];
    for (const row of data.rows) {
      lines.push(row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','));
    }
    return lines.join('\n');
  }
}
