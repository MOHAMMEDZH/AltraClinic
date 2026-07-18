import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';

@Injectable()
export class BeautyDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(tenantId: string) {
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const weekStart = new Date(dayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    const beautyRecords = await this.prisma.beautyRecord.findMany({
      where: { tenantId },
      include: { patient: { select: { id: true, firstName: true, lastName: true } } },
    });
    const patientIds = beautyRecords.map((r) => r.patientId);

    const [todayAppointments, weekInvoices, recentBeforeAfter] = await Promise.all([
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
                  { serviceType: { contains: 'beauty', mode: 'insensitive' } },
                  { serviceType: { contains: 'aesthetic', mode: 'insensitive' } },
                ],
              }
            : {
                OR: [
                  { serviceType: { contains: 'beauty', mode: 'insensitive' } },
                  { serviceType: { contains: 'aesthetic', mode: 'insensitive' } },
                ],
              }),
        },
        orderBy: { scheduledStart: 'asc' },
        take: 12,
        include: { patient: { select: { id: true, firstName: true, lastName: true } } },
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
      this.prisma.mediaAsset.findMany({
        where: { tenantId, category: 'BEAUTY_BEFORE_AFTER', deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: { id: true, patientId: true, originalFilename: true, comparisonRole: true, createdAt: true },
      }),
    ]);

    let revenueThisWeek = 0;
    let collectedThisWeek = 0;
    for (const inv of weekInvoices) {
      revenueThisWeek += inv.amountTotal.toNumber();
      collectedThisWeek += inv.amountPaid.toNumber();
    }

    const activePlans: {
      id: string;
      patientId: string;
      patientName: string;
      title: string;
      status: string;
      estimatedCost: number;
    }[] = [];
    const upcomingSessions: {
      id: string;
      patientId: string;
      patientName: string;
      type: string;
      scheduledAt: string;
    }[] = [];
    const clinicalAlerts: {
      id: string;
      patientId: string;
      patientName: string;
      message: string;
      severity: 'info' | 'warning' | 'critical';
      href: string;
    }[] = [];
    let followUpPatients = 0;

    for (const row of beautyRecords) {
      const patientName = `${row.patient.firstName} ${row.patient.lastName}`.trim();
      const state = row.bodyMapState as {
        treatmentPlans?: { id?: string; title?: string; status?: string; estimatedCost?: number }[];
        sessions?: { id?: string; type?: string; status?: string; scheduledAt?: string }[];
        consents?: { type?: string; granted?: boolean }[];
      } | null;

      for (const plan of state?.treatmentPlans ?? []) {
        if (plan.status === 'active' || plan.status === 'approved') {
          activePlans.push({
            id: plan.id ?? '',
            patientId: row.patientId,
            patientName,
            title: plan.title ?? 'Treatment plan',
            status: plan.status ?? 'active',
            estimatedCost: plan.estimatedCost ?? 0,
          });
        }
        if (plan.status === 'draft' && clinicalAlerts.length < 10) {
          clinicalAlerts.push({
            id: `draft-${plan.id}-${row.patientId}`,
            patientId: row.patientId,
            patientName,
            message: `Draft plan pending: ${plan.title ?? 'Untitled'}`,
            severity: 'info',
            href: `/beauty/workspace/${row.patientId}?tab=plans`,
          });
        }
      }

      for (const session of state?.sessions ?? []) {
        if (session.status === 'scheduled' && session.scheduledAt) {
          upcomingSessions.push({
            id: session.id ?? '',
            patientId: row.patientId,
            patientName,
            type: session.type ?? 'session',
            scheduledAt: session.scheduledAt,
          });
        }
        if (session.status === 'follow_up_due') {
          followUpPatients++;
          if (clinicalAlerts.length < 10) {
            clinicalAlerts.push({
              id: `followup-${session.id}-${row.patientId}`,
              patientId: row.patientId,
              patientName,
              message: `Follow-up due — ${session.type ?? 'session'}`,
              severity: 'warning',
              href: `/beauty/workspace/${row.patientId}?tab=sessions`,
            });
          }
        }
      }

      const photoConsent = (state?.consents ?? []).find((c) => c.type === 'photo');
      if (photoConsent && !photoConsent.granted && clinicalAlerts.length < 10) {
        clinicalAlerts.push({
          id: `consent-photo-${row.patientId}`,
          patientId: row.patientId,
          patientName,
          message: 'Photo consent not recorded',
          severity: 'warning',
          href: `/beauty/workspace/${row.patientId}?tab=gallery`,
        });
      }
    }

    upcomingSessions.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

    return {
      todayAppointments: todayAppointments.map((a) => ({
        id: a.id,
        patientId: a.patientId,
        patientName: `${a.patient.firstName} ${a.patient.lastName}`.trim(),
        scheduledStart: a.scheduledStart.toISOString(),
        status: a.status,
        serviceType: a.serviceType,
      })),
      activeTreatmentPlans: activePlans.slice(0, 8),
      upcomingSessions: upcomingSessions.slice(0, 10),
      revenueSummary: {
        revenueThisWeek,
        collectedThisWeek,
        outstandingThisWeek: Math.max(0, revenueThisWeek - collectedThisWeek),
        currency: weekInvoices[0]?.currency ?? 'USD',
      },
      followUpPatients,
      beforeAfterActivity: recentBeforeAfter.map((m) => ({
        id: m.id,
        patientId: m.patientId,
        filename: m.originalFilename,
        role: m.comparisonRole,
        createdAt: m.createdAt.toISOString(),
      })),
      clinicalAlerts: clinicalAlerts.slice(0, 10),
    };
  }
}
