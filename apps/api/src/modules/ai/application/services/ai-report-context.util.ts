import { PrismaService } from '../../../../infrastructure/prisma.service';

export interface ResolvedReportContext {
  label: string;
  type?: string;
  status?: string;
}

export function humanizeReportSlug(slug: string): string {
  return slug
    .split(/[-_/]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export async function resolveReportContext(
  prisma: PrismaService,
  tenantId: string,
  reportId: string,
): Promise<ResolvedReportContext> {
  const operational = await prisma.operationalReportRecord.findFirst({
    where: { id: reportId, tenantId },
    select: { name: true, reportType: true, status: true },
  });
  if (operational) {
    return { label: operational.name, type: operational.reportType, status: operational.status };
  }

  const analytics = await prisma.analyticsReportRecord.findFirst({
    where: { id: reportId, tenantId },
    select: { name: true, reportType: true, status: true },
  });
  if (analytics) {
    return { label: analytics.name, type: analytics.reportType, status: analytics.status };
  }

  const custom = await prisma.reportCustomDefinitionRecord.findFirst({
    where: { id: reportId, tenantId },
    select: { name: true, reportType: true },
  });
  if (custom) {
    return { label: custom.name, type: custom.reportType };
  }

  return { label: humanizeReportSlug(reportId), type: 'catalog' };
}
