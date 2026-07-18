/**
 * Demo beauty record for Sarah Hassan — botox plan, sessions, face annotations.
 */
export async function seedDemoBeauty(prisma, { tenantId, sarahId, ownerId }) {
  const recordId = 'c1000000-0000-4000-8000-000000000001';
  const planId = 'c1000000-0000-4000-8000-000000000002';
  const consultId = 'c1000000-0000-4000-8000-000000000003';
  const session1Id = 'c1000000-0000-4000-8000-000000000004';
  const session2Id = 'c1000000-0000-4000-8000-000000000005';
  const ann1Id = 'c1000000-0000-4000-8000-000000000006';
  const ann2Id = 'c1000000-0000-4000-8000-000000000007';

  const consultDate = new Date();
  consultDate.setMonth(consultDate.getMonth() - 2);
  const session1Date = new Date();
  session1Date.setMonth(session1Date.getMonth() - 1);
  const session2Date = new Date();
  session2Date.setDate(session2Date.getDate() + 14);

  const bodyMapState = {
    version: 1,
    profile: {
      skinType: 'combination',
      concerns: ['fine_lines', 'volume_loss'],
      allergies: [],
      notes: 'Interested in natural-looking rejuvenation. Previous filler elsewhere 2 years ago.',
    },
    consultations: [
      {
        id: consultId,
        type: 'initial',
        status: 'completed',
        date: consultDate.toISOString(),
        clinicianId: ownerId,
        skinAssessment: { hydration: 'moderate', elasticity: 'good', pigmentation: 'mild' },
        facialAssessment: { symmetry: 'balanced', volumeLoss: 'moderate', dynamicLines: 'forehead, glabella' },
        recommendations: ['botox_forehead', 'filler_nasolabial'],
        notes: 'Discussed realistic expectations. Consent obtained for photography.',
        consentPhoto: true,
        consentTreatment: true,
      },
    ],
    treatmentPlans: [
      {
        id: planId,
        title: 'Upper face rejuvenation',
        status: 'active',
        procedures: ['botox', 'filler'],
        sessionSequence: [
          { id: 'c1000000-0000-4000-8000-000000000010', type: 'consultation', label: 'Initial consultation', estimatedCost: 100 },
          { id: 'c1000000-0000-4000-8000-000000000011', type: 'botox', label: 'Botox session 1', estimatedCost: 350 },
          { id: 'c1000000-0000-4000-8000-000000000012', type: 'filler', label: 'Filler session', estimatedCost: 400 },
        ],
        sessionsPlanned: 3,
        sessionsCompleted: 1,
        estimatedCost: 850,
        approvedAt: consultDate.toISOString(),
        approvedBy: ownerId,
        notes: 'Botox session 1 complete. Filler session scheduled.',
      },
    ],
    sessions: [
      {
        id: session1Id,
        planId,
        type: 'botox',
        status: 'completed',
        scheduledAt: session1Date.toISOString(),
        completedAt: session1Date.toISOString(),
        clinicianId: ownerId,
        outcome: 'good',
        notes: '20 units forehead, 12 units glabella. No adverse events.',
        products: [{ name: 'Botox', units: 32, lot: 'BX-2026-001' }],
      },
      {
        id: session2Id,
        planId,
        type: 'filler',
        status: 'scheduled',
        scheduledAt: session2Date.toISOString(),
        clinicianId: ownerId,
        outcome: null,
        notes: 'Nasolabial fold correction — 1ml planned.',
        products: [],
      },
    ],
    measurements: [
      { id: 'm1', type: 'custom', label: 'Glabella line depth', value: 2.1, unit: 'mm', recordedAt: consultDate.toISOString() },
      { id: 'm2', type: 'custom', label: 'Glabella line depth', value: 1.2, unit: 'mm', recordedAt: session1Date.toISOString() },
    ],
    consents: [
      { id: 'c1', type: 'photo', granted: true, grantedAt: consultDate.toISOString(), grantedBy: sarahId },
      { id: 'c2', type: 'treatment', granted: true, grantedAt: consultDate.toISOString(), grantedBy: sarahId },
    ],
  };

  await prisma.beautyRecord.upsert({
    where: { id: recordId },
    create: {
      id: recordId,
      tenantId,
      patientId: sarahId,
      bodyMapState,
    },
    update: { bodyMapState },
  });

  await prisma.beautyAnnotation.upsert({
    where: { id: ann1Id },
    create: {
      id: ann1Id,
      beautyRecordId: recordId,
      tenantId,
      zone: 'forehead',
      treatment: 'botox',
      coordinates: { x: 50, y: 18, view: 'front' },
      parameters: { units: 20, depthMm: 2 },
      recordedBy: ownerId,
      recordedAt: session1Date,
      notes: 'Forehead — 20 units',
    },
    update: {
      coordinates: { x: 50, y: 18, view: 'front' },
      parameters: { units: 20, depthMm: 2 },
      notes: 'Forehead — 20 units',
    },
  });

  await prisma.beautyAnnotation.upsert({
    where: { id: ann2Id },
    create: {
      id: ann2Id,
      beautyRecordId: recordId,
      tenantId,
      zone: 'glabella',
      treatment: 'botox',
      coordinates: { x: 50, y: 28, view: 'front' },
      parameters: { units: 12, depthMm: 3 },
      recordedBy: ownerId,
      recordedAt: session1Date,
      notes: 'Glabella — 12 units',
    },
    update: {
      coordinates: { x: 50, y: 28, view: 'front' },
      parameters: { units: 12, depthMm: 3 },
      notes: 'Glabella — 12 units',
    },
  });

  console.log('  ✓ Demo beauty record (Sarah Hassan)');
}

export async function seedDemoBeautyExtras(prisma, { tenantId, sarahId, ownerId }) {
  const session2Date = new Date();
  session2Date.setDate(session2Date.getDate() + 14);
  const apptId = 'c1000000-0000-4000-8000-000000000020';

  await prisma.appointment.upsert({
    where: { id: apptId },
    create: {
      id: apptId,
      tenantId,
      patientId: sarahId,
      providerId: ownerId,
      scheduledStart: session2Date,
      scheduledEnd: new Date(session2Date.getTime() + 60 * 60 * 1000),
      status: 'CONFIRMED',
      serviceType: 'beauty:filler',
      notes: 'Beauty filler session — linked from demo seed',
    },
    update: {
      scheduledStart: session2Date,
      scheduledEnd: new Date(session2Date.getTime() + 60 * 60 * 1000),
      serviceType: 'beauty:filler',
    },
  });

  const record = await prisma.beautyRecord.findFirst({ where: { tenantId, patientId: sarahId } });
  if (record) {
    const state = record.bodyMapState;
    const sessions = state?.sessions ?? [];
    const session2Id = 'c1000000-0000-4000-8000-000000000005';
    const nextSessions = sessions.map((s) =>
      s.id === session2Id ? { ...s, appointmentId: apptId } : s,
    );
    await prisma.beautyRecord.update({
      where: { id: record.id },
      data: { bodyMapState: { ...state, sessions: nextSessions } },
    });
  }

  console.log('  ✓ Demo beauty appointment link');
}
