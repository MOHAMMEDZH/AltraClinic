import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';

@Injectable()
export class DentalDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(tenantId: string) {
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const weekStart = new Date(dayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    const dentalPatientIds = await this.prisma.dentalRecord.findMany({
      where: { tenantId },
      select: { patientId: true },
    });
    const patientIds = dentalPatientIds.map((r) => r.patientId);

    const [
      todayAppointments,
      activePlans,
      pendingApprovalPlans,
      weekInvoices,
      perioAlerts,
    ] = await Promise.all([
      this.prisma.appointment.findMany({
        where: {
          tenantId,
          deletedAt: null,
          scheduledStart: { gte: dayStart, lt: dayEnd },
          status: { in: ['CONFIRMED', 'PENDING', 'IN_PROGRESS', 'CHECKED_IN'] },
          ...(patientIds.length
            ? {
                OR: [
                  { patientId: { in: patientIds } },
                  { serviceType: { contains: 'dental', mode: 'insensitive' } },
                ],
              }
            : { serviceType: { contains: 'dental', mode: 'insensitive' } }),
        },
        orderBy: { scheduledStart: 'asc' },
        take: 12,
        include: { patient: { select: { id: true, firstName: true, lastName: true } } },
      }),
      this.prisma.treatmentPlan.findMany({
        where: { tenantId, status: { in: ['APPROVED', 'IN_PROGRESS'] } },
        orderBy: { updatedAt: 'desc' },
        take: 8,
        include: { patient: { select: { id: true, firstName: true, lastName: true } } },
      }),
      this.prisma.treatmentPlan.count({
        where: { tenantId, status: 'PENDING_APPROVAL' },
      }),
      this.prisma.invoice.findMany({
        where: {
          tenantId,
          deletedAt: null,
          patientId: patientIds.length ? { in: patientIds } : undefined,
          invoiceDate: { gte: weekStart },
        },
        select: { amountTotal: true, amountPaid: true, currency: true },
      }),
      this.prisma.periodontalExam.findMany({
        where: { tenantId },
        orderBy: { examDate: 'desc' },
        take: 20,
        include: { patient: { select: { id: true, firstName: true, lastName: true } } },
      }),
    ]);

    let revenueThisWeek = 0;
    let collectedThisWeek = 0;
    for (const inv of weekInvoices) {
      revenueThisWeek += inv.amountTotal.toNumber();
      collectedThisWeek += inv.amountPaid.toNumber();
    }

    const clinicalAlerts: {
      id: string;
      patientId: string;
      patientName: string;
      message: string;
      severity: 'info' | 'warning' | 'critical';
      href: string;
    }[] = [];

    if (pendingApprovalPlans > 0) {
      clinicalAlerts.push({
        id: 'pending-plans',
        patientId: '',
        patientName: '',
        message: `${pendingApprovalPlans} treatment plan(s) pending approval`,
        severity: 'warning',
        href: '/dental',
      });
    }

    for (const exam of perioAlerts) {
      const summary = (exam.chartData as { summary?: { stage?: string; sites4Plus?: number } })?.summary;
      if (summary?.stage && ['moderate', 'severe'].includes(summary.stage)) {
        clinicalAlerts.push({
          id: `perio-${exam.id}`,
          patientId: exam.patientId,
          patientName: `${exam.patient.firstName} ${exam.patient.lastName}`.trim(),
          message: `Periodontitis (${summary.stage}) — ${summary.sites4Plus ?? 0} sites ≥4mm`,
          severity: summary.stage === 'severe' ? 'critical' : 'warning',
          href: `/dental/chart/${exam.patientId}?tab=perio`,
        });
      }
      if (clinicalAlerts.length >= 8) break;
    }

    const records = await this.prisma.dentalRecord.findMany({
      where: { tenantId },
      select: { patientId: true, odontogramState: true },
    });
    let pendingPlannedTeeth = 0;
    for (const row of records) {
      const teeth = (row.odontogramState as { teeth?: { status?: string }[] })?.teeth ?? [];
      pendingPlannedTeeth += teeth.filter((t) => t.status === 'planned').length;
    }

    return {
      todayAppointments: todayAppointments.map((a) => ({
        id: a.id,
        patientId: a.patientId,
        patientName: `${a.patient.firstName} ${a.patient.lastName}`.trim(),
        scheduledStart: a.scheduledStart.toISOString(),
        status: a.status,
        serviceType: a.serviceType,
      })),
      activeTreatmentPlans: activePlans.map((p) => ({
        id: p.id,
        patientId: p.patientId,
        patientName: `${p.patient.firstName} ${p.patient.lastName}`.trim(),
        title: p.title,
        status: p.status,
        totalEstimatedCost: p.totalEstimatedCost?.toNumber() ?? null,
      })),
      revenueSummary: {
        revenueThisWeek,
        collectedThisWeek,
        outstandingThisWeek: Math.max(0, revenueThisWeek - collectedThisWeek),
        currency: weekInvoices[0]?.currency ?? 'USD',
      },
      pendingProcedures: pendingPlannedTeeth,
      pendingApprovalPlans,
      followUpPatients: records.length > 0 ? Math.min(records.length, Math.ceil(pendingPlannedTeeth / 2)) : 0,
      clinicalAlerts: clinicalAlerts.slice(0, 10),
    };
  }
}
