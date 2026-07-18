/**
 * Seeds demo periodontal exams for Sarah — baseline (3 months ago) and follow-up (improved).
 */
function site(pd, recession = 0, bop = false) {
  return { pd, recession, bop };
}

function tooth(toothNumber, sites, mobility = 0, furcation = null, plaqueIndex = 0) {
  return {
    toothNumber,
    mobility,
    furcation,
    plaqueIndex,
    sites: {
      mb: site(sites[0][0], sites[0][1] ?? 0, sites[0][2] ?? false),
      b: site(sites[1][0], sites[1][1] ?? 0, sites[1][2] ?? false),
      db: site(sites[2][0], sites[2][1] ?? 0, sites[2][2] ?? false),
      ml: site(sites[3][0], sites[3][1] ?? 0, sites[3][2] ?? false),
      l: site(sites[4][0], sites[4][1] ?? 0, sites[4][2] ?? false),
      dl: site(sites[5][0], sites[5][1] ?? 0, sites[5][2] ?? false),
    },
  };
}

function defaultTeeth() {
  const teeth = [];
  for (let n = 1; n <= 32; n++) {
    teeth.push(tooth(n, [[2, 0, false], [2, 0, false], [2, 0, false], [2, 0, false], [2, 0, false], [2, 0, false]]));
  }
  // Periodontal involvement — upper molars and premolars
  teeth[2] = tooth(3, [[4, 1, true], [5, 1, true], [4, 0, true], [3, 0, false], [4, 0, true], [3, 0, false]], 0, null, 2);
  teeth[13] = tooth(14, [[5, 2, true], [6, 2, true], [5, 1, true], [4, 1, true], [5, 1, true], [4, 0, true]], 1, 1, 2);
  teeth[14] = tooth(15, [[4, 0, true], [5, 0, true], [4, 0, true], [3, 0, false], [4, 0, true], [3, 0, false]], 0, null, 1);
  teeth[18] = tooth(19, [[6, 2, true], [7, 3, true], [6, 2, true], [5, 1, true], [6, 1, true], [5, 1, true]], 2, 2, 3);
  teeth[19] = tooth(20, [[5, 1, true], [6, 1, true], [5, 1, true], [4, 0, true], [5, 0, true], [4, 0, true]], 1, 1, 2);
  teeth[29] = tooth(30, [[4, 1, true], [5, 1, true], [4, 0, true], [3, 0, true], [4, 0, true], [3, 0, false]], 0, null, 1);
  return teeth;
}

function improvedTeeth() {
  const teeth = defaultTeeth();
  teeth[13] = tooth(14, [[4, 2, false], [5, 2, false], [4, 1, false], [3, 1, false], [4, 0, false], [3, 0, false]], 1, 1, 1);
  teeth[18] = tooth(19, [[5, 2, false], [6, 3, false], [5, 2, false], [4, 1, false], [5, 1, false], [4, 1, false]], 1, 2, 2);
  teeth[19] = tooth(20, [[4, 1, false], [5, 1, false], [4, 1, false], [3, 0, false], [4, 0, false], [3, 0, false]], 0, 1, 1);
  return teeth;
}

export async function seedDemoPeriodontal(prisma, { tenantId, sarahId, ownerId }) {
  const baselineId = 'a2000000-0000-4000-8000-000000000001';
  const followUpId = 'a2000000-0000-4000-8000-000000000002';

  const baselineDate = new Date();
  baselineDate.setMonth(baselineDate.getMonth() - 3);
  const followUpDate = new Date();
  followUpDate.setDate(followUpDate.getDate() - 7);

  const baselineTeeth = defaultTeeth();
  const followUpTeeth = improvedTeeth();

  await prisma.periodontalExam.upsert({
    where: { id: baselineId },
    create: {
      id: baselineId,
      tenantId,
      patientId: sarahId,
      recordedBy: ownerId,
      examDate: baselineDate,
      notes: 'Initial comprehensive periodontal charting. Moderate periodontitis upper molars.',
      chartData: { teeth: baselineTeeth },
    },
    update: {
      examDate: baselineDate,
      notes: 'Initial comprehensive periodontal charting. Moderate periodontitis upper molars.',
      chartData: { teeth: baselineTeeth },
    },
  });

  await prisma.periodontalExam.upsert({
    where: { id: followUpId },
    create: {
      id: followUpId,
      tenantId,
      patientId: sarahId,
      recordedBy: ownerId,
      examDate: followUpDate,
      notes: '3-month re-evaluation post SRP. BOP reduced, pocket depths improved.',
      chartData: { teeth: followUpTeeth },
    },
    update: {
      examDate: followUpDate,
      notes: '3-month re-evaluation post SRP. BOP reduced, pocket depths improved.',
      chartData: { teeth: followUpTeeth },
    },
  });

  return { baselineId, followUpId };
}
