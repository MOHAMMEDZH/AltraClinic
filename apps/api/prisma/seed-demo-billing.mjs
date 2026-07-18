/**
 * Demo service prices and billing sequences for POS / pricing workspace.
 */
export const DEMO_SERVICE_CONSULT_ID = 'd1010000-0000-4000-8000-000000000001';
export const DEMO_SERVICE_CLEANING_ID = 'd1010000-0000-4000-8000-000000000002';
export const DEMO_SERVICE_XRAY_ID = 'd1010000-0000-4000-8000-000000000003';

const DEMO_SERVICES = [
  {
    id: DEMO_SERVICE_CONSULT_ID,
    serviceCode: 'CONSULT',
    nameEn: 'General consultation',
    nameAr: 'استشارة عامة',
    unitPrice: 150000,
    taxPercent: 0,
  },
  {
    id: DEMO_SERVICE_CLEANING_ID,
    serviceCode: 'CLEANING',
    nameEn: 'Dental cleaning',
    nameAr: 'تنظيف أسنان',
    unitPrice: 250000,
    taxPercent: 0,
  },
  {
    id: DEMO_SERVICE_XRAY_ID,
    serviceCode: 'XRAY',
    nameEn: 'Panoramic X-ray',
    nameAr: 'أشعة بانوراما',
    unitPrice: 80000,
    taxPercent: 0,
  },
];

export async function seedDemoBilling(prisma, { tenantId, doctorId }) {
  for (const svc of DEMO_SERVICES) {
    await prisma.servicePrice.upsert({
      where: { tenantId_serviceCode: { tenantId, serviceCode: svc.serviceCode } },
      create: {
        id: svc.id,
        tenantId,
        serviceCode: svc.serviceCode,
        nameEn: svc.nameEn,
        nameAr: svc.nameAr,
        unitPrice: svc.unitPrice,
        currency: 'SYP',
        taxPercent: svc.taxPercent,
        isActive: true,
      },
      update: {
        nameEn: svc.nameEn,
        nameAr: svc.nameAr,
        unitPrice: svc.unitPrice,
        taxPercent: svc.taxPercent,
        isActive: true,
      },
    });
  }

  for (const prefix of ['INV', 'RCP', 'CN']) {
    await prisma.tenantBillingSequence.upsert({
      where: { tenantId_prefix: { tenantId, prefix } },
      create: { tenantId, prefix, lastNumber: 0 },
      update: {},
    });
  }

  if (doctorId) {
    await prisma.commissionRule.upsert({
      where: { id: 'd2010000-0000-4000-8000-000000000001' },
      create: {
        id: 'd2010000-0000-4000-8000-000000000001',
        tenantId,
        providerId: doctorId,
        serviceType: 'CONSULT',
        rateType: 'PERCENTAGE',
        rateValue: 15,
        effectiveDate: new Date('2026-01-01'),
      },
      update: {
        rateValue: 15,
        serviceType: 'CONSULT',
        providerId: doctorId,
      },
    });
  }
}
