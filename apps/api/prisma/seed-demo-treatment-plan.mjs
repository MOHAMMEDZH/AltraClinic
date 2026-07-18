/**
 * Seeds a demo multi-visit treatment plan for Sarah.
 */
export async function seedDemoTreatmentPlan(prisma, { tenantId, sarahId, ownerId }) {
  const planId = 'd1000000-0000-4000-8000-000000000001';
  const phase1Id = 'd1000000-0000-4000-8000-000000000011';
  const phase2Id = 'd1000000-0000-4000-8000-000000000012';
  const phase3Id = 'd1000000-0000-4000-8000-000000000013';

  const item1Id = 'd1000000-0000-4000-8000-000000000021';
  const item2Id = 'd1000000-0000-4000-8000-000000000022';
  const item3Id = 'd1000000-0000-4000-8000-000000000023';
  const item4Id = 'd1000000-0000-4000-8000-000000000024';
  const item5Id = 'd1000000-0000-4000-8000-000000000025';
  const item6Id = 'd1000000-0000-4000-8000-000000000026';

  const visit2 = new Date();
  visit2.setDate(visit2.getDate() + 14);
  const visit3 = new Date();
  visit3.setDate(visit3.getDate() + 42);

  await prisma.treatmentPlan.upsert({
    where: { id: planId },
    create: {
      id: planId,
      tenantId,
      patientId: sarahId,
      title: 'Comprehensive restorative plan — Sarah',
      status: 'IN_PROGRESS',
      clinicalNotes: 'Patient presents with caries #9 and #24. Plan phased over 3 visits with crown on #24 following RCT.',
      totalEstimatedCost: 4850,
      totalEstimatedMinutes: 330,
      currency: 'USD',
      consentSignedAt: new Date(Date.now() - 7 * 86400000),
      consentRecordedBy: ownerId,
      consentMethod: 'in_clinic',
      approvedAt: new Date(Date.now() - 6 * 86400000),
      approvedBy: ownerId,
      submittedAt: new Date(Date.now() - 7 * 86400000),
      submittedBy: ownerId,
      insuranceSnapshot: {
        provider: 'Delta Dental PPO',
        memberId: 'DD-8847291',
        groupNumber: 'GRP-2201',
        planType: 'PPO',
        coveragePercent: 80,
        annualMaximum: 1500,
        deductibleRemaining: 50,
      },
      createdBy: ownerId,
    },
    update: {
      title: 'Comprehensive restorative plan — Sarah',
      status: 'IN_PROGRESS',
      clinicalNotes: 'Patient presents with caries #9 and #24. Plan phased over 3 visits with crown on #24 following RCT.',
      totalEstimatedCost: 4850,
      totalEstimatedMinutes: 330,
    },
  });

  const phases = [
    {
      id: phase1Id,
      name: 'Visit 1 — Urgent care',
      sortOrder: 0,
      visitNumber: 1,
      estimatedVisitDate: new Date(Date.now() - 3 * 86400000),
      items: [
        {
          id: item1Id,
          code: 'D0140',
          description: 'Limited oral evaluation — problem focused',
          toothNumbers: [],
          sortOrder: 0,
          estimatedMinutes: 20,
          estimatedCost: 85,
          status: 'COMPLETED',
          completedAt: new Date(Date.now() - 3 * 86400000),
          completedBy: ownerId,
          insuranceEstimate: 68,
          patientPortion: 17,
        },
        {
          id: item2Id,
          code: 'D3310',
          description: 'Root canal — anterior (#9)',
          toothNumbers: [9],
          sortOrder: 1,
          estimatedMinutes: 90,
          estimatedCost: 950,
          status: 'COMPLETED',
          completedAt: new Date(Date.now() - 3 * 86400000),
          completedBy: ownerId,
          dependsOnItemId: item1Id,
          insuranceEstimate: 760,
          patientPortion: 190,
        },
      ],
    },
    {
      id: phase2Id,
      name: 'Visit 2 — Restorative',
      sortOrder: 1,
      visitNumber: 2,
      estimatedVisitDate: visit2,
      items: [
        {
          id: item3Id,
          code: 'D2391',
          description: 'Composite filling — one surface (#9)',
          toothNumbers: [9],
          sortOrder: 0,
          estimatedMinutes: 45,
          estimatedCost: 220,
          status: 'SCHEDULED',
          dependsOnItemId: item2Id,
          insuranceEstimate: 176,
          patientPortion: 44,
        },
        {
          id: item4Id,
          code: 'D3330',
          description: 'Root canal — molar (#24)',
          toothNumbers: [24],
          sortOrder: 1,
          estimatedMinutes: 120,
          estimatedCost: 1200,
          status: 'PLANNED',
          dependsOnItemId: item2Id,
          requiresPreAuth: true,
          preAuthStatus: 'approved',
          insuranceEstimate: 960,
          patientPortion: 240,
        },
      ],
    },
    {
      id: phase3Id,
      name: 'Visit 3 — Prosthetics',
      sortOrder: 2,
      visitNumber: 3,
      estimatedVisitDate: visit3,
      items: [
        {
          id: item5Id,
          code: 'D2740',
          description: 'Crown — porcelain/ceramic (#24)',
          toothNumbers: [24],
          sortOrder: 0,
          estimatedMinutes: 75,
          estimatedCost: 1450,
          status: 'PLANNED',
          dependsOnItemId: item4Id,
          insuranceEstimate: 580,
          patientPortion: 870,
        },
        {
          id: item6Id,
          code: 'D0120',
          description: 'Periodic oral evaluation — follow-up',
          toothNumbers: [],
          sortOrder: 1,
          estimatedMinutes: 20,
          estimatedCost: 65,
          status: 'PLANNED',
          dependsOnItemId: item5Id,
          insuranceEstimate: 52,
          patientPortion: 13,
        },
      ],
    },
  ];

  for (const phase of phases) {
    await prisma.treatmentPhase.upsert({
      where: { id: phase.id },
      create: {
        id: phase.id,
        planId,
        tenantId,
        name: phase.name,
        sortOrder: phase.sortOrder,
        visitNumber: phase.visitNumber,
        estimatedVisitDate: phase.estimatedVisitDate,
      },
      update: {
        name: phase.name,
        sortOrder: phase.sortOrder,
        visitNumber: phase.visitNumber,
        estimatedVisitDate: phase.estimatedVisitDate,
      },
    });

    for (const item of phase.items) {
      await prisma.treatmentPlanItem.upsert({
        where: { id: item.id },
        create: {
          id: item.id,
          phaseId: phase.id,
          tenantId,
          sortOrder: item.sortOrder,
          code: item.code,
          description: item.description,
          toothNumbers: item.toothNumbers,
          status: item.status,
          estimatedMinutes: item.estimatedMinutes,
          estimatedCost: item.estimatedCost,
          dependsOnItemId: item.dependsOnItemId ?? null,
          completedAt: item.completedAt ?? null,
          completedBy: item.completedBy ?? null,
          insuranceEligible: true,
          insuranceEstimate: item.insuranceEstimate,
          patientPortion: item.patientPortion,
          requiresPreAuth: item.requiresPreAuth ?? false,
          preAuthStatus: item.preAuthStatus ?? null,
        },
        update: {
          sortOrder: item.sortOrder,
          code: item.code,
          description: item.description,
          toothNumbers: item.toothNumbers,
          status: item.status,
          estimatedMinutes: item.estimatedMinutes,
          estimatedCost: item.estimatedCost,
          dependsOnItemId: item.dependsOnItemId ?? null,
          completedAt: item.completedAt ?? null,
          completedBy: item.completedBy ?? null,
          insuranceEstimate: item.insuranceEstimate,
          patientPortion: item.patientPortion,
          requiresPreAuth: item.requiresPreAuth ?? false,
          preAuthStatus: item.preAuthStatus ?? null,
        },
      });
    }
  }

  console.log('Seeded demo treatment plan for Sarah (3 visits, 6 procedures).');
}
