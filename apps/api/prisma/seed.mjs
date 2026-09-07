/**
 * Development bootstrap: demo tenant + owner account.
 * Run: npx prisma db seed
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { seedDemoImaging } from './seed-demo-imaging.mjs';
import { seedDemoTreatmentPlan } from './seed-demo-treatment-plan.mjs';
import { seedDemoPeriodontal } from './seed-demo-periodontal.mjs';
import { seedDemoBeauty, seedDemoBeautyExtras } from './seed-demo-beauty.mjs';
import { seedDemoInventoryProcurement, seedDemoInventoryOperations } from './seed-demo-inventory.mjs';
import { seedDemoBilling } from './seed-demo-billing.mjs';
import { seedNotificationCenter } from './seed-notification-center.mjs';
import { seedWorkflowCenter } from './seed-workflow-center.mjs';
import { seedLicensingE2eTenants } from './seed-licensing-e2e.mjs';

const prisma = new PrismaClient();

export const DEV_TENANT_ID = 'a1000000-0000-4000-8000-000000000001';
export const DEV_OWNER_ID = 'a1000000-0000-4000-8000-000000000002';
export const DEV_INVENTORY_MANAGER_ID = 'a1000000-0000-4000-8000-000000000005';
export const DEV_DOCTOR_ID = 'a1000000-0000-4000-8000-000000000006';
export const DEV_RECEPTIONIST_ID = 'a1000000-0000-4000-8000-000000000007';
export const DEV_ACCOUNTANT_ID = 'a1000000-0000-4000-8000-000000000009';
export const DEV_GM_ID = 'a1000000-0000-4000-8000-000000000010';
export const DEV_NURSE_ID = 'a1000000-0000-4000-8000-000000000011';
export const DEV_DENTIST_ID = 'a1000000-0000-4000-8000-000000000018';
export const DEV_BRANCH_MANAGER_ID = 'a1000000-0000-4000-8000-000000000019';
export const DEV_SPECIALIST_ID = 'a1000000-0000-4000-8000-000000000032';
export const DEV_PATIENT_USER_ID = 'a1000000-0000-4000-8000-000000000033';
const DEV_PLATFORM_TENANT_ID = 'a1000000-0000-4000-8000-000000000003';
const DEV_SUBSCRIPTION_ID = 'a1000000-0000-4000-8000-000000000012';
const DEV_BRANCH_ID = 'a1000000-0000-4000-8000-000000000004';
const DEV_BRANCH_NORTH_ID = 'a1000000-0000-4000-8000-000000000008';
const DEV_DEPT_CLINICAL_ID = 'a1000000-0000-4000-8000-000000000020';
const DEV_DEPT_ADMIN_ID = 'a1000000-0000-4000-8000-000000000021';
const DEV_DEPT_FINANCE_ID = 'a1000000-0000-4000-8000-000000000022';
const DEV_REGION_CENTRAL_ID = 'a1000000-0000-4000-8000-000000000030';
const DEV_REGION_NORTH_ID = 'a1000000-0000-4000-8000-000000000031';
const DEV_NOTE_TEMPLATE_ID = 'a1000000-0000-4000-8000-000000000040';
const DEV_LAB_RESULT_ID = 'a1000000-0000-4000-8000-000000000041';
const DEV_CUSTOM_ROLE_ID = 'a1000000-0000-4000-8000-000000000042';

const OWNER_EMAIL = 'owner@demo.clinic';
const OWNER_PASSWORD = 'Owner123!';
const DEMO_TENANT_FEATURES = {
  smsInvites: true,
  /** Demo clinic is the inventory E2E positive fixture (business-tier inventory enabled). */
  subscriptionUiPlan: 'business',
  advancedSettings: {
    allowBackupRestore: true,
  },
};
const INVENTORY_MANAGER_EMAIL = 'inventory@demo.clinic';
const INVENTORY_MANAGER_PASSWORD = 'Inventory123!';
const DOCTOR_EMAIL = 'doctor@demo.clinic';
const DOCTOR_PASSWORD = 'Doctor123!';
const RECEPTIONIST_EMAIL = 'reception@demo.clinic';
const RECEPTIONIST_PASSWORD = 'Reception123!';
const ACCOUNTANT_EMAIL = 'accountant@demo.clinic';
const ACCOUNTANT_PASSWORD = 'Accountant123!';
const GM_EMAIL = 'gm@demo.clinic';
const GM_PASSWORD = 'Manager123!';
const NURSE_EMAIL = 'nurse@demo.clinic';
const NURSE_PASSWORD = 'Nurse123!';
const DENTIST_EMAIL = 'dentist@demo.clinic';
const DENTIST_PASSWORD = 'Dentist123!';
const BRANCH_MANAGER_EMAIL = 'branch@demo.clinic';
const BRANCH_MANAGER_PASSWORD = 'Branch123!';
const SPECIALIST_EMAIL = 'specialist@demo.clinic';
const SPECIALIST_PASSWORD = 'Specialist123!';
const PATIENT_USER_EMAIL = 'patient@demo.clinic';
const PATIENT_USER_PASSWORD = 'Patient123!';

async function main() {
  const passwordHash = await bcrypt.hash(OWNER_PASSWORD, 12);
  const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.tenant.upsert({
    where: { id: DEV_TENANT_ID },
    create: {
      id: DEV_TENANT_ID,
      name: 'Demo Clinic',
      slug: 'demo-clinic',
      status: 'ACTIVE',
      lifecycleStatus: 'TRIAL',
      timezone: 'Asia/Damascus',
      locale: 'en-US',
      trialStartedAt: new Date(),
      trialEndsAt,
      features: DEMO_TENANT_FEATURES,
    },
    update: {
      name: 'Demo Clinic',
      status: 'ACTIVE',
      lifecycleStatus: 'TRIAL',
      locale: 'en-US',
      features: DEMO_TENANT_FEATURES,
    },
  });

  await prisma.region.upsert({
    where: { id: DEV_REGION_CENTRAL_ID },
    create: {
      id: DEV_REGION_CENTRAL_ID,
      tenantId: DEV_TENANT_ID,
      name: 'Central Region',
      nameAr: 'المنطقة الوسطى',
      isActive: true,
    },
    update: { name: 'Central Region', nameAr: 'المنطقة الوسطى', isActive: true },
  });

  await prisma.region.upsert({
    where: { id: DEV_REGION_NORTH_ID },
    create: {
      id: DEV_REGION_NORTH_ID,
      tenantId: DEV_TENANT_ID,
      name: 'North Region',
      nameAr: 'المنطقة الشمالية',
      isActive: true,
    },
    update: { name: 'North Region', nameAr: 'المنطقة الشمالية', isActive: true },
  });

  await prisma.branch.upsert({
    where: { id: DEV_BRANCH_ID },
    create: {
      id: DEV_BRANCH_ID,
      tenantId: DEV_TENANT_ID,
      name: 'Main Branch',
      regionId: DEV_REGION_CENTRAL_ID,
      isActive: true,
    },
    update: { name: 'Main Branch', regionId: DEV_REGION_CENTRAL_ID, isActive: true },
  });

  await prisma.branch.upsert({
    where: { id: DEV_BRANCH_NORTH_ID },
    create: {
      id: DEV_BRANCH_NORTH_ID,
      tenantId: DEV_TENANT_ID,
      name: 'North Branch',
      regionId: DEV_REGION_NORTH_ID,
      isActive: true,
    },
    update: { name: 'North Branch', regionId: DEV_REGION_NORTH_ID, isActive: true },
  });

  const departments = [
    { id: DEV_DEPT_CLINICAL_ID, name: 'Clinical', nameAr: 'العيادة' },
    { id: DEV_DEPT_ADMIN_ID, name: 'Administration', nameAr: 'الإدارة' },
    { id: DEV_DEPT_FINANCE_ID, name: 'Finance', nameAr: 'المالية' },
  ];
  for (const dept of departments) {
    await prisma.department.upsert({
      where: { id: dept.id },
      create: {
        id: dept.id,
        tenantId: DEV_TENANT_ID,
        branchId: DEV_BRANCH_ID,
        name: dept.name,
        nameAr: dept.nameAr,
        isActive: true,
      },
      update: { name: dept.name, nameAr: dept.nameAr, isActive: true },
    });
  }

  await prisma.platformTenant.upsert({
    where: { tenantId: DEV_TENANT_ID },
    create: {
      id: DEV_PLATFORM_TENANT_ID,
      tenantId: DEV_TENANT_ID,
      displayName: 'Demo Clinic',
      region: 'ME_SOUTH',
      plan: 'PRO',
      maxBranches: 10,
      maxUsers: 100,
      status: 'ACTIVE',
      provisionedBy: DEV_OWNER_ID,
      activatedAt: new Date(),
      trialEndsAt,
    },
    update: {
      displayName: 'Demo Clinic',
      status: 'ACTIVE',
      plan: 'PRO',
    },
  });

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: DEV_TENANT_ID, email: OWNER_EMAIL } },
    create: {
      id: DEV_OWNER_ID,
      tenantId: DEV_TENANT_ID,
      branchId: DEV_BRANCH_ID,
      email: OWNER_EMAIL,
      passwordHash,
      firstName: 'Demo',
      lastName: 'Owner',
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      roles: {
        create: [{ id: randomUUID(), role: 'OWNER' }],
      },
    },
    update: {
      passwordHash,
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      branchId: DEV_BRANCH_ID,
      mfaEnabled: false,
      mfaSecret: null,
    },
  });

  await prisma.mfaBackupCode.deleteMany({ where: { userId: DEV_OWNER_ID } });
  await prisma.trustedDevice.deleteMany({ where: { userId: DEV_OWNER_ID } });

  const existingRoles = await prisma.userRoleAssignment.findMany({
    where: { userId: DEV_OWNER_ID },
  });
  if (!existingRoles.some((r) => r.role === 'OWNER')) {
    await prisma.userRoleAssignment.create({
      data: { id: randomUUID(), userId: DEV_OWNER_ID, role: 'OWNER' },
    });
  }

  const inventoryManagerHash = await bcrypt.hash(INVENTORY_MANAGER_PASSWORD, 12);
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: DEV_TENANT_ID, email: INVENTORY_MANAGER_EMAIL } },
    create: {
      id: DEV_INVENTORY_MANAGER_ID,
      tenantId: DEV_TENANT_ID,
      branchId: DEV_BRANCH_ID,
      email: INVENTORY_MANAGER_EMAIL,
      passwordHash: inventoryManagerHash,
      firstName: 'Demo',
      lastName: 'Inventory',
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      roles: {
        create: [{ id: randomUUID(), role: 'INVENTORY_MANAGER' }],
      },
    },
    update: {
      passwordHash: inventoryManagerHash,
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      branchId: DEV_BRANCH_ID,
    },
  });

  const inventoryManagerRoles = await prisma.userRoleAssignment.findMany({
    where: { userId: DEV_INVENTORY_MANAGER_ID },
  });
  if (!inventoryManagerRoles.some((r) => r.role === 'INVENTORY_MANAGER')) {
    await prisma.userRoleAssignment.create({
      data: { id: randomUUID(), userId: DEV_INVENTORY_MANAGER_ID, role: 'INVENTORY_MANAGER' },
    });
  }

  const doctorHash = await bcrypt.hash(DOCTOR_PASSWORD, 12);
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: DEV_TENANT_ID, email: DOCTOR_EMAIL } },
    create: {
      id: DEV_DOCTOR_ID,
      tenantId: DEV_TENANT_ID,
      branchId: DEV_BRANCH_ID,
      email: DOCTOR_EMAIL,
      passwordHash: doctorHash,
      firstName: 'Demo',
      lastName: 'Doctor',
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      roles: {
        create: [{ id: randomUUID(), role: 'DOCTOR' }],
      },
    },
    update: {
      passwordHash: doctorHash,
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      branchId: DEV_BRANCH_ID,
    },
  });

  const doctorRoles = await prisma.userRoleAssignment.findMany({
    where: { userId: DEV_DOCTOR_ID },
  });
  if (!doctorRoles.some((r) => r.role === 'DOCTOR')) {
    await prisma.userRoleAssignment.create({
      data: { id: randomUUID(), userId: DEV_DOCTOR_ID, role: 'DOCTOR' },
    });
  }

  const receptionistHash = await bcrypt.hash(RECEPTIONIST_PASSWORD, 12);
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: DEV_TENANT_ID, email: RECEPTIONIST_EMAIL } },
    create: {
      id: DEV_RECEPTIONIST_ID,
      tenantId: DEV_TENANT_ID,
      branchId: DEV_BRANCH_ID,
      email: RECEPTIONIST_EMAIL,
      passwordHash: receptionistHash,
      firstName: 'Demo',
      lastName: 'Reception',
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      roles: {
        create: [{ id: randomUUID(), role: 'RECEPTIONIST' }],
      },
    },
    update: {
      passwordHash: receptionistHash,
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      branchId: DEV_BRANCH_ID,
    },
  });

  const receptionistRoles = await prisma.userRoleAssignment.findMany({
    where: { userId: DEV_RECEPTIONIST_ID },
  });
  if (!receptionistRoles.some((r) => r.role === 'RECEPTIONIST')) {
    await prisma.userRoleAssignment.create({
      data: { id: randomUUID(), userId: DEV_RECEPTIONIST_ID, role: 'RECEPTIONIST' },
    });
  }

  const accountantHash = await bcrypt.hash(ACCOUNTANT_PASSWORD, 12);
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: DEV_TENANT_ID, email: ACCOUNTANT_EMAIL } },
    create: {
      id: DEV_ACCOUNTANT_ID,
      tenantId: DEV_TENANT_ID,
      branchId: DEV_BRANCH_ID,
      email: ACCOUNTANT_EMAIL,
      passwordHash: accountantHash,
      firstName: 'Demo',
      lastName: 'Accountant',
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      roles: {
        create: [{ id: randomUUID(), role: 'ACCOUNTANT' }],
      },
    },
    update: {
      passwordHash: accountantHash,
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      branchId: DEV_BRANCH_ID,
    },
  });

  const accountantRoles = await prisma.userRoleAssignment.findMany({
    where: { userId: DEV_ACCOUNTANT_ID },
  });
  if (!accountantRoles.some((r) => r.role === 'ACCOUNTANT')) {
    await prisma.userRoleAssignment.create({
      data: { id: randomUUID(), userId: DEV_ACCOUNTANT_ID, role: 'ACCOUNTANT' },
    });
  }

  const gmHash = await bcrypt.hash(GM_PASSWORD, 12);
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: DEV_TENANT_ID, email: GM_EMAIL } },
    create: {
      id: DEV_GM_ID,
      tenantId: DEV_TENANT_ID,
      branchId: DEV_BRANCH_ID,
      email: GM_EMAIL,
      passwordHash: gmHash,
      firstName: 'Demo',
      lastName: 'Manager',
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      roles: {
        create: [{ id: randomUUID(), role: 'GENERAL_MANAGER' }],
      },
    },
    update: {
      passwordHash: gmHash,
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      branchId: DEV_BRANCH_ID,
    },
  });

  const gmRoles = await prisma.userRoleAssignment.findMany({
    where: { userId: DEV_GM_ID },
  });
  if (!gmRoles.some((r) => r.role === 'GENERAL_MANAGER')) {
    await prisma.userRoleAssignment.create({
      data: { id: randomUUID(), userId: DEV_GM_ID, role: 'GENERAL_MANAGER' },
    });
  }

  const nurseHash = await bcrypt.hash(NURSE_PASSWORD, 12);
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: DEV_TENANT_ID, email: NURSE_EMAIL } },
    create: {
      id: DEV_NURSE_ID,
      tenantId: DEV_TENANT_ID,
      branchId: DEV_BRANCH_ID,
      email: NURSE_EMAIL,
      passwordHash: nurseHash,
      firstName: 'Demo',
      lastName: 'Nurse',
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      roles: {
        create: [{ id: randomUUID(), role: 'NURSE' }],
      },
    },
    update: {
      passwordHash: nurseHash,
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      branchId: DEV_BRANCH_ID,
    },
  });

  const nurseRoles = await prisma.userRoleAssignment.findMany({
    where: { userId: DEV_NURSE_ID },
  });
  if (!nurseRoles.some((r) => r.role === 'NURSE')) {
    await prisma.userRoleAssignment.create({
      data: { id: randomUUID(), userId: DEV_NURSE_ID, role: 'NURSE' },
    });
  }

  const dentistHash = await bcrypt.hash(DENTIST_PASSWORD, 12);
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: DEV_TENANT_ID, email: DENTIST_EMAIL } },
    create: {
      id: DEV_DENTIST_ID,
      tenantId: DEV_TENANT_ID,
      branchId: DEV_BRANCH_ID,
      email: DENTIST_EMAIL,
      passwordHash: dentistHash,
      firstName: 'Demo',
      lastName: 'Dentist',
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      roles: {
        create: [{ id: randomUUID(), role: 'DENTIST' }],
      },
    },
    update: {
      passwordHash: dentistHash,
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      branchId: DEV_BRANCH_ID,
    },
  });

  const dentistRoles = await prisma.userRoleAssignment.findMany({
    where: { userId: DEV_DENTIST_ID },
  });
  if (!dentistRoles.some((r) => r.role === 'DENTIST')) {
    await prisma.userRoleAssignment.create({
      data: { id: randomUUID(), userId: DEV_DENTIST_ID, role: 'DENTIST' },
    });
  }

  const branchManagerHash = await bcrypt.hash(BRANCH_MANAGER_PASSWORD, 12);
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: DEV_TENANT_ID, email: BRANCH_MANAGER_EMAIL } },
    create: {
      id: DEV_BRANCH_MANAGER_ID,
      tenantId: DEV_TENANT_ID,
      branchId: DEV_BRANCH_NORTH_ID,
      email: BRANCH_MANAGER_EMAIL,
      passwordHash: branchManagerHash,
      firstName: 'Demo',
      lastName: 'Branch',
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      roles: {
        create: [{ id: randomUUID(), role: 'BRANCH_MANAGER' }],
      },
    },
    update: {
      passwordHash: branchManagerHash,
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      branchId: DEV_BRANCH_NORTH_ID,
    },
  });

  const branchManagerRoles = await prisma.userRoleAssignment.findMany({
    where: { userId: DEV_BRANCH_MANAGER_ID },
  });
  if (!branchManagerRoles.some((r) => r.role === 'BRANCH_MANAGER')) {
    await prisma.userRoleAssignment.create({
      data: { id: randomUUID(), userId: DEV_BRANCH_MANAGER_ID, role: 'BRANCH_MANAGER' },
    });
  }

  const specialistHash = await bcrypt.hash(SPECIALIST_PASSWORD, 12);
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: DEV_TENANT_ID, email: SPECIALIST_EMAIL } },
    create: {
      id: DEV_SPECIALIST_ID,
      tenantId: DEV_TENANT_ID,
      branchId: DEV_BRANCH_ID,
      email: SPECIALIST_EMAIL,
      passwordHash: specialistHash,
      firstName: 'Demo',
      lastName: 'Specialist',
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      roles: {
        create: [{ id: randomUUID(), role: 'SPECIALIST' }],
      },
    },
    update: {
      passwordHash: specialistHash,
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      branchId: DEV_BRANCH_ID,
    },
  });

  const specialistRoles = await prisma.userRoleAssignment.findMany({
    where: { userId: DEV_SPECIALIST_ID },
  });
  if (!specialistRoles.some((r) => r.role === 'SPECIALIST')) {
    await prisma.userRoleAssignment.create({
      data: { id: randomUUID(), userId: DEV_SPECIALIST_ID, role: 'SPECIALIST' },
    });
  }

  const patientUserHash = await bcrypt.hash(PATIENT_USER_PASSWORD, 12);
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: DEV_TENANT_ID, email: PATIENT_USER_EMAIL } },
    create: {
      id: DEV_PATIENT_USER_ID,
      tenantId: DEV_TENANT_ID,
      branchId: DEV_BRANCH_ID,
      email: PATIENT_USER_EMAIL,
      passwordHash: patientUserHash,
      firstName: 'Demo',
      lastName: 'Patient',
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      roles: {
        create: [{ id: randomUUID(), role: 'PATIENT' }],
      },
    },
    update: {
      passwordHash: patientUserHash,
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      branchId: DEV_BRANCH_ID,
    },
  });

  const patientRoles = await prisma.userRoleAssignment.findMany({
    where: { userId: DEV_PATIENT_USER_ID },
  });
  if (!patientRoles.some((r) => r.role === 'PATIENT')) {
    await prisma.userRoleAssignment.create({
      data: { id: randomUUID(), userId: DEV_PATIENT_USER_ID, role: 'PATIENT' },
    });
  }

  await prisma.userRegionAccess.deleteMany({
    where: { userId: DEV_BRANCH_MANAGER_ID, tenantId: DEV_TENANT_ID },
  });
  await prisma.userRegionAccess.create({
    data: {
      tenantId: DEV_TENANT_ID,
      userId: DEV_BRANCH_MANAGER_ID,
      regionId: DEV_REGION_NORTH_ID,
    },
  });

  const subscriptionEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  await prisma.platformSubscription.upsert({
    where: { id: DEV_SUBSCRIPTION_ID },
    create: {
      id: DEV_SUBSCRIPTION_ID,
      platformTenantId: DEV_PLATFORM_TENANT_ID,
      plan: 'PRO',
      status: 'ACTIVE',
      billingCycleMonths: 12,
      pricePerMonth: 299,
      currency: 'USD',
      startDate: new Date(),
      endDate: subscriptionEnd,
      paidManuallyBy: DEV_OWNER_ID,
      paidManuallyAt: new Date(),
      paymentReference: 'DEMO-INV-2026',
    },
    update: {
      plan: 'PRO',
      status: 'ACTIVE',
      pricePerMonth: 299,
      endDate: subscriptionEnd,
    },
  });

  const demoNotifications = [
    {
      id: 'a1000000-0000-4000-8000-000000000013',
      title: 'Low stock alert',
      body: 'Surgical masks are below the reorder threshold at Main Branch.',
      priority: 'HIGH',
      status: 'DELIVERED',
      readAt: null,
    },
    {
      id: 'a1000000-0000-4000-8000-000000000014',
      title: 'Outstanding invoices',
      body: '3 invoices are overdue and need follow-up.',
      priority: 'MEDIUM',
      status: 'DELIVERED',
      readAt: null,
    },
    {
      id: 'a1000000-0000-4000-8000-000000000015',
      title: 'Trial reminder',
      body: 'Your clinic trial ends in 30 days. Review subscription options.',
      priority: 'LOW',
      status: 'READ',
      readAt: new Date(),
    },
  ];

  for (const note of demoNotifications) {
    await prisma.notification.upsert({
      where: { id: note.id },
      create: {
        id: note.id,
        tenantId: DEV_TENANT_ID,
        branchId: DEV_BRANCH_ID,
        recipientId: DEV_OWNER_ID,
        channel: 'IN_APP',
        title: note.title,
        body: note.body,
        priority: note.priority,
        status: note.status,
        readAt: note.readAt,
        deliveredAt: new Date(),
      },
      update: {
        title: note.title,
        body: note.body,
        priority: note.priority,
        status: note.status,
        readAt: note.readAt,
      },
    });
  }

  const demoWorkflows = [
    {
      id: 'a1000000-0000-4000-8000-000000000016',
      nameEn: 'Month-end billing closure',
      nameAr: 'إغلاق الفوترة نهاية الشهر',
      descriptionEn: 'Review invoices, approve adjustments, and close the billing period.',
      descriptionAr: 'مراجعة الفواتير والموافقة على التعديلات وإغلاق فترة الفوترة.',
      steps: ['Review invoices', 'Approve adjustments', 'Close period'],
      currentStepIndex: 1,
    },
    {
      id: 'a1000000-0000-4000-8000-000000000017',
      nameEn: 'Inventory replenishment',
      nameAr: 'تجديد المخزون',
      descriptionEn: 'Approve purchase orders for low-stock consumables.',
      descriptionAr: 'الموافقة على أوامر الشراء للمستهلكات منخفضة المخزون.',
      steps: ['Review POs', 'Approve orders', 'Confirm delivery'],
      currentStepIndex: 0,
    },
  ];

  for (const flow of demoWorkflows) {
    await prisma.workflow.upsert({
      where: { id: flow.id },
      create: {
        id: flow.id,
        tenantId: DEV_TENANT_ID,
        branchId: DEV_BRANCH_ID,
        nameEn: flow.nameEn,
        nameAr: flow.nameAr,
        descriptionEn: flow.descriptionEn,
        descriptionAr: flow.descriptionAr,
        steps: flow.steps,
        currentStepIndex: flow.currentStepIndex,
        status: 'ACTIVE',
        createdBy: DEV_OWNER_ID,
      },
      update: {
        nameEn: flow.nameEn,
        nameAr: flow.nameAr,
        descriptionEn: flow.descriptionEn,
        descriptionAr: flow.descriptionAr,
        steps: flow.steps,
        currentStepIndex: flow.currentStepIndex,
        status: 'ACTIVE',
      },
    });
  }

  const demoPatients = [
    {
      id: 'b1000000-0000-4000-8000-000000000001',
      firstName: 'Sarah',
      lastName: 'Hassan',
      firstNameAr: 'سارة',
      lastNameAr: 'حسن',
      phone: '+963944123456',
      email: 'sarah.hassan@demo.clinic',
      dateOfBirth: new Date('1990-04-12'),
      gender: 'female',
      nationalId: 'NID-001',
      bloodGroup: 'O+',
    },
    {
      id: 'b1000000-0000-4000-8000-000000000002',
      firstName: 'Omar',
      lastName: 'Khalil',
      firstNameAr: 'عمر',
      lastNameAr: 'خليل',
      phone: '+963955987654',
      gender: 'male',
      bloodGroup: 'A+',
    },
  ];

  const sarahProfileData = {
    allergies: ['Penicillin'],
    communication: {
      sms: true,
      email: true,
      whatsapp: true,
      appointmentReminders: true,
      followUpReminders: true,
    },
  };

  for (const p of demoPatients) {
    const profileData = p.id === 'b1000000-0000-4000-8000-000000000001' ? sarahProfileData : undefined;
    await prisma.patient.upsert({
      where: { id: p.id },
      create: {
        ...p,
        tenantId: DEV_TENANT_ID,
        branchId: DEV_BRANCH_ID,
        ...(profileData ? { profileData } : {}),
      },
      update: {
        firstName: p.firstName,
        lastName: p.lastName,
        phone: p.phone ?? null,
        ...(profileData ? { profileData } : {}),
      },
    });
  }

  const today = new Date();
  const atTime = (hour, minute) => {
    const d = new Date(today);
    d.setHours(hour, minute, 0, 0);
    return d;
  };

  const demoAppointments = [
    {
      id: 'c1000000-0000-4000-8000-000000000001',
      patientId: 'b1000000-0000-4000-8000-000000000001',
      providerId: DEV_OWNER_ID,
      scheduledStart: atTime(9, 0),
      scheduledEnd: atTime(9, 30),
      status: 'CONFIRMED',
      notes: 'Follow-up consultation',
      serviceType: 'follow_up',
      isEmergency: false,
    },
    {
      id: 'c1000000-0000-4000-8000-000000000002',
      patientId: 'b1000000-0000-4000-8000-000000000002',
      providerId: DEV_OWNER_ID,
      scheduledStart: atTime(10, 30),
      scheduledEnd: atTime(11, 0),
      status: 'PENDING',
      notes: null,
      serviceType: 'consultation',
      isEmergency: false,
    },
    {
      id: 'c1000000-0000-4000-8000-000000000003',
      patientId: 'b1000000-0000-4000-8000-000000000001',
      providerId: DEV_OWNER_ID,
      scheduledStart: atTime(14, 0),
      scheduledEnd: atTime(14, 45),
      status: 'PENDING',
      notes: 'Dental cleaning',
      serviceType: 'cleaning',
      isEmergency: false,
    },
    {
      id: 'c1000000-0000-4000-8000-000000000004',
      patientId: 'b1000000-0000-4000-8000-000000000002',
      providerId: DEV_OWNER_ID,
      scheduledStart: atTime(16, 0),
      scheduledEnd: atTime(16, 30),
      status: 'NO_SHOW',
      notes: null,
      serviceType: 'consultation',
      isEmergency: false,
    },
  ];

  for (const appt of demoAppointments) {
    await prisma.appointment.upsert({
      where: { id: appt.id },
      create: {
        ...appt,
        tenantId: DEV_TENANT_ID,
        branchId: DEV_BRANCH_ID,
      },
      update: {
        scheduledStart: appt.scheduledStart,
        scheduledEnd: appt.scheduledEnd,
        status: appt.status,
        notes: appt.notes,
        serviceType: appt.serviceType,
        isEmergency: appt.isEmergency,
      },
    });
  }

  await prisma.appointmentWaitlist.upsert({
    where: { id: 'e1000000-0000-4000-8000-000000000001' },
    create: {
      id: 'e1000000-0000-4000-8000-000000000001',
      tenantId: DEV_TENANT_ID,
      branchId: DEV_BRANCH_ID,
      patientId: 'b1000000-0000-4000-8000-000000000002',
      providerId: DEV_OWNER_ID,
      preferredDate: atTime(12, 0),
      durationMin: 30,
      notes: 'Prefers morning slots',
      status: 'OPEN',
    },
    update: {
      status: 'OPEN',
      preferredDate: atTime(12, 0),
    },
  });

  const demoResources = [
    {
      id: 'f1000000-0000-4000-8000-000000000001',
      name: 'Consultation Room 1',
      resourceType: 'ROOM',
    },
    {
      id: 'f1000000-0000-4000-8000-000000000002',
      name: 'Dental Suite A',
      resourceType: 'ROOM',
    },
    {
      id: 'f1000000-0000-4000-8000-000000000003',
      name: 'X-Ray Unit',
      resourceType: 'EQUIPMENT',
    },
  ];

  for (const resource of demoResources) {
    await prisma.schedulingResource.upsert({
      where: { id: resource.id },
      create: {
        ...resource,
        tenantId: DEV_TENANT_ID,
        branchId: DEV_BRANCH_ID,
        isActive: true,
      },
      update: { name: resource.name, isActive: true },
    });
  }

  await prisma.appointment.updateMany({
    where: { id: 'c1000000-0000-4000-8000-000000000001', tenantId: DEV_TENANT_ID },
    data: { resourceId: 'f1000000-0000-4000-8000-000000000001' },
  });

  const demoTemplates = [
    {
      id: 'a1100000-0000-4000-8000-000000000001',
      name: 'Standard consultation',
      serviceType: 'consultation',
      durationMin: 30,
    },
    {
      id: 'a1100000-0000-4000-8000-000000000002',
      name: 'Dental cleaning',
      serviceType: 'cleaning',
      durationMin: 45,
    },
  ];

  for (const template of demoTemplates) {
    await prisma.appointmentTemplate.upsert({
      where: { id: template.id },
      create: {
        ...template,
        tenantId: DEV_TENANT_ID,
        branchId: DEV_BRANCH_ID,
      },
      update: {
        name: template.name,
        serviceType: template.serviceType,
        durationMin: template.durationMin,
      },
    });
  }

  const demoQueueTickets = [
    {
      id: 'd1000000-0000-4000-8000-000000000001',
      appointmentId: 'c1000000-0000-4000-8000-000000000001',
      patientId: 'b1000000-0000-4000-8000-000000000001',
      providerId: DEV_OWNER_ID,
      scheduledStart: atTime(9, 0),
      scheduledEnd: atTime(9, 30),
      status: 'WAITING',
      priority: 'APPOINTMENT',
      checkedInAt: atTime(8, 45),
    },
    {
      id: 'd1000000-0000-4000-8000-000000000002',
      appointmentId: 'c1000000-0000-4000-8000-000000000002',
      patientId: 'b1000000-0000-4000-8000-000000000002',
      providerId: DEV_OWNER_ID,
      scheduledStart: atTime(10, 30),
      scheduledEnd: atTime(11, 0),
      status: 'CALLED',
      priority: 'APPOINTMENT',
      checkedInAt: atTime(10, 15),
      calledAt: atTime(10, 20),
    },
    {
      id: 'd1000000-0000-4000-8000-000000000003',
      appointmentId: 'c1000000-0000-4000-8000-000000000003',
      patientId: 'b1000000-0000-4000-8000-000000000001',
      providerId: DEV_OWNER_ID,
      scheduledStart: atTime(11, 0),
      scheduledEnd: atTime(11, 30),
      status: 'SERVING',
      priority: 'APPOINTMENT',
      checkedInAt: atTime(10, 50),
      calledAt: atTime(10, 55),
      servedAt: atTime(11, 0),
    },
  ];

  for (const ticket of demoQueueTickets) {
    await prisma.queueTicket.upsert({
      where: { id: ticket.id },
      create: {
        ...ticket,
        tenantId: DEV_TENANT_ID,
        branchId: DEV_BRANCH_ID,
      },
      update: {
        status: ticket.status,
        priority: ticket.priority,
        checkedInAt: ticket.checkedInAt,
        calledAt: ticket.calledAt ?? null,
        servedAt: ticket.servedAt ?? null,
        scheduledStart: ticket.scheduledStart,
        scheduledEnd: ticket.scheduledEnd,
      },
    });
  }

  const followUp = new Date(today);
  followUp.setDate(followUp.getDate() + 14);

  const demoEncounters = [
    {
      id: 'e1000000-0000-4000-8000-000000000001',
      patientId: 'b1000000-0000-4000-8000-000000000001',
      appointmentId: 'c1000000-0000-4000-8000-000000000001',
      chiefComplaint: 'Persistent headache and fatigue',
      diagnoses: [{ code: 'R51', description: 'Headache' }],
      medications: [{
        name: 'Paracetamol',
        dose: '500mg',
        route: 'oral',
        frequency: 'TID',
        refillsAllowed: 2,
        refillsRemaining: 2,
      }],
      structuredNotes: [{
        id: 'note-demo-progress-1',
        type: 'progress',
        title: 'Progress note',
        body: 'Symptoms improving with analgesics.',
        createdAt: atTime(9, 20).toISOString(),
      }],
      observations: [
        { type: 'blood_pressure', value: '120/80', unit: 'mmHg' },
        { type: 'heart_rate', value: '72', unit: 'bpm' },
        { type: 'clinical_notes', value: 'Patient reports 3-day headache. No neurological deficits on exam.' },
      ],
      followUpDate: followUp,
      createdAt: atTime(9, 15),
    },
    {
      id: 'e1000000-0000-4000-8000-000000000002',
      patientId: 'b1000000-0000-4000-8000-000000000002',
      appointmentId: 'c1000000-0000-4000-8000-000000000002',
      chiefComplaint: 'Routine dental check-up',
      diagnoses: [{ code: 'K02.9', description: 'Dental caries, unspecified' }],
      medications: [],
      observations: [
        { type: 'temperature', value: '36.8', unit: '°C' },
        { type: 'weight', value: '78', unit: 'kg' },
      ],
      followUpDate: null,
      createdAt: atTime(10, 45),
    },
    {
      id: 'e1000000-0000-4000-8000-000000000003',
      patientId: 'b1000000-0000-4000-8000-000000000001',
      appointmentId: null,
      chiefComplaint: 'Skin consultation — acne treatment follow-up',
      diagnoses: [{ code: 'L70.0', description: 'Acne vulgaris' }],
      medications: [{ name: 'Topical retinoid', dose: '0.05%', route: 'topical', frequency: 'QD' }],
      observations: [
        { type: 'clinical_notes', value: 'Improvement noted. Continue current regimen for 4 weeks.' },
      ],
      followUpDate: followUp,
      createdAt: atTime(8, 30),
    },
  ];

  for (const enc of demoEncounters) {
    await prisma.encounter.upsert({
      where: { id: enc.id },
      create: {
        id: enc.id,
        tenantId: DEV_TENANT_ID,
        branchId: DEV_BRANCH_ID,
        patientId: enc.patientId,
        clinicianId: DEV_OWNER_ID,
        appointmentId: enc.appointmentId,
        chiefComplaint: enc.chiefComplaint,
        diagnoses: enc.diagnoses,
        medications: enc.medications,
        observations: enc.observations,
        followUpDate: enc.followUpDate,
        createdAt: enc.createdAt,
        status: 'IN_PROGRESS',
        structuredNotes: enc.structuredNotes ?? [],
      },
      update: {
        chiefComplaint: enc.chiefComplaint,
        diagnoses: enc.diagnoses,
        medications: enc.medications,
        observations: enc.observations,
        followUpDate: enc.followUpDate,
        createdAt: enc.createdAt,
        status: 'IN_PROGRESS',
        structuredNotes: enc.structuredNotes ?? [],
      },
    });
  }

  await prisma.clinicalNoteTemplate.upsert({
    where: { id: DEV_NOTE_TEMPLATE_ID },
    create: {
      id: DEV_NOTE_TEMPLATE_ID,
      tenantId: DEV_TENANT_ID,
      name: 'Internal medicine consult',
      noteType: 'CONSULTATION',
      soapNotes: {
        subjective: 'Patient presents for evaluation of…',
        objective: 'General exam…',
        assessment: 'Working diagnosis…',
        plan: 'Labs, follow-up in 1 week.',
      },
      sortOrder: 0,
    },
    update: { isActive: true },
  });

  await prisma.labResult.upsert({
    where: { id: DEV_LAB_RESULT_ID },
    create: {
      id: DEV_LAB_RESULT_ID,
      tenantId: DEV_TENANT_ID,
      patientId: 'b1000000-0000-4000-8000-000000000001',
      encounterId: 'e1000000-0000-4000-8000-000000000001',
      testName: 'Complete blood count',
      value: '12.5',
      unit: 'g/dL',
      referenceRange: '12.0–15.5',
      status: 'normal',
      resultedAt: atTime(9, 30),
    },
    update: {},
  });

  const makeTeeth = (overrides = {}) => {
    const teeth = [];
    for (let i = 1; i <= 32; i++) {
      teeth.push({ toothNumber: i, status: 'healthy', notes: null });
    }
    for (const [num, status] of Object.entries(overrides)) {
      const t = teeth.find((x) => x.toothNumber === Number(num));
      if (t) t.status = status;
    }
    return teeth;
  };

  const demoDentalRecords = [
    {
      id: 'f1000000-0000-4000-8000-000000000001',
      patientId: 'b1000000-0000-4000-8000-000000000002',
      teeth: makeTeeth({ 3: 'decayed', 14: 'filled', 19: 'crown', 30: 'missing' }),
      procedures: [
        {
          id: 'dproc-demo-1',
          code: 'D2391',
          description: 'Composite filling — one surface',
          toothNumbers: [14],
          performedAt: atTime(10, 50).toISOString(),
          providerId: DEV_OWNER_ID,
        },
        {
          id: 'dproc-demo-2',
          code: 'D2740',
          description: 'Crown — porcelain/ceramic',
          toothNumbers: [19],
          performedAt: atTime(11, 10).toISOString(),
          providerId: DEV_OWNER_ID,
        },
      ],
    },
    {
      id: 'f1000000-0000-4000-8000-000000000002',
      patientId: 'b1000000-0000-4000-8000-000000000001',
      teeth: makeTeeth({ 8: 'planned', 9: 'decayed', 24: 'filled' }),
      procedures: [
        {
          id: 'dproc-demo-3',
          code: 'D0120',
          description: 'Periodic oral evaluation',
          toothNumbers: [],
          performedAt: atTime(9, 0).toISOString(),
          providerId: DEV_OWNER_ID,
        },
      ],
    },
  ];

  for (const rec of demoDentalRecords) {
    await prisma.dentalRecord.upsert({
      where: { patientId: rec.patientId },
      create: {
        id: rec.id,
        tenantId: DEV_TENANT_ID,
        patientId: rec.patientId,
        odontogramState: { teeth: rec.teeth, procedures: rec.procedures },
      },
      update: {
        odontogramState: { teeth: rec.teeth, procedures: rec.procedures },
      },
    });
  }

  await seedDemoImaging(prisma, {
    tenantId: DEV_TENANT_ID,
    branchId: DEV_BRANCH_ID,
    ownerId: DEV_OWNER_ID,
    sarahId: 'b1000000-0000-4000-8000-000000000001',
    omarId: 'b1000000-0000-4000-8000-000000000002',
    encounterSarahId: 'e1000000-0000-4000-8000-000000000001',
  });

  await seedDemoTreatmentPlan(prisma, {
    tenantId: DEV_TENANT_ID,
    sarahId: 'b1000000-0000-4000-8000-000000000001',
    ownerId: DEV_OWNER_ID,
  });

  await seedDemoPeriodontal(prisma, {
    tenantId: DEV_TENANT_ID,
    sarahId: 'b1000000-0000-4000-8000-000000000001',
    ownerId: DEV_OWNER_ID,
  });

  await seedDemoBeauty(prisma, {
    tenantId: DEV_TENANT_ID,
    sarahId: 'b1000000-0000-4000-8000-000000000001',
    ownerId: DEV_OWNER_ID,
  });

  await seedDemoBeautyExtras(prisma, {
    tenantId: DEV_TENANT_ID,
    sarahId: 'b1000000-0000-4000-8000-000000000001',
    ownerId: DEV_OWNER_ID,
  });

  const demoInventoryItems = [
    {
      id: 'a2010000-0000-4000-8000-000000000001',
      sku: 'GLV-M-100',
      barcode: '8901234567890',
      nameEn: 'Nitrile Gloves (M)',
      nameAr: 'قفازات نيتrile (M)',
      unit: 'box',
      quantityOnHand: 24,
      reorderThreshold: 10,
    },
    {
      id: 'a2010000-0000-4000-8000-000000000002',
      sku: 'SYR-5ML',
      barcode: '8901234567891',
      nameEn: 'Syringe 5ml',
      nameAr: 'حقنة 5ml',
      unit: 'pcs',
      quantityOnHand: 150,
      reorderThreshold: 50,
    },
    {
      id: 'a2010000-0000-4000-8000-000000000003',
      sku: 'MASK-3PLY',
      barcode: '8901234567892',
      nameEn: 'Surgical Mask 3-ply',
      nameAr: 'كمامة جراحية',
      unit: 'box',
      quantityOnHand: 5,
      reorderThreshold: 20,
    },
  ];

  for (const item of demoInventoryItems) {
    await prisma.inventoryItem.upsert({
      where: { id: item.id },
      create: {
        id: item.id,
        tenantId: DEV_TENANT_ID,
        branchId: DEV_BRANCH_ID,
        sku: item.sku,
        barcode: item.barcode,
        nameEn: item.nameEn,
        nameAr: item.nameAr,
        unit: item.unit,
        quantityOnHand: item.quantityOnHand,
        reorderThreshold: item.reorderThreshold,
      },
      update: {
        sku: item.sku,
        barcode: item.barcode,
        nameEn: item.nameEn,
        nameAr: item.nameAr,
        unit: item.unit,
        quantityOnHand: item.quantityOnHand,
        reorderThreshold: item.reorderThreshold,
        deletedAt: null,
      },
    });
  }

  await seedDemoInventoryProcurement(prisma, {
    tenantId: DEV_TENANT_ID,
    ownerId: DEV_OWNER_ID,
    inventoryManagerId: DEV_INVENTORY_MANAGER_ID,
    doctorId: DEV_DOCTOR_ID,
    gloveItemId: 'a2010000-0000-4000-8000-000000000001',
    syringeItemId: 'a2010000-0000-4000-8000-000000000002',
    maskItemId: 'a2010000-0000-4000-8000-000000000003',
  });

  await seedDemoInventoryOperations(prisma, {
    tenantId: DEV_TENANT_ID,
    branchId: DEV_BRANCH_ID,
    inventoryManagerId: DEV_INVENTORY_MANAGER_ID,
    gloveItemId: 'a2010000-0000-4000-8000-000000000001',
    syringeItemId: 'a2010000-0000-4000-8000-000000000002',
    maskItemId: 'a2010000-0000-4000-8000-000000000003',
  });

  await seedDemoBilling(prisma, { tenantId: DEV_TENANT_ID, doctorId: DEV_DOCTOR_ID });

  await seedNotificationCenter(prisma, { tenantId: DEV_TENANT_ID, ownerId: DEV_OWNER_ID });

  await seedWorkflowCenter(prisma, {
    tenantId: DEV_TENANT_ID,
    ownerId: DEV_OWNER_ID,
    branchId: DEV_BRANCH_ID,
    doctorId: DEV_DOCTOR_ID,
    accountantId: DEV_ACCOUNTANT_ID,
  });

  await prisma.customRole.upsert({
    where: { id: DEV_CUSTOM_ROLE_ID },
    create: {
      id: DEV_CUSTOM_ROLE_ID,
      tenantId: DEV_TENANT_ID,
      name: 'Demo custom role',
      description: 'Seeded custom role for user-management E2E',
      permissions: {},
      isArchived: false,
    },
    update: {
      name: 'Demo custom role',
      description: 'Seeded custom role for user-management E2E',
      permissions: {},
      isArchived: false,
    },
  });

  await seedLicensingE2eTenants(prisma);

  console.log('\n--- Dev login credentials ---');
  console.log(`Organization ID: ${DEV_TENANT_ID}`);
  console.log(`Owner email:     ${OWNER_EMAIL}`);
  console.log(`Owner password:  ${OWNER_PASSWORD}`);
  console.log(`Inventory email: ${INVENTORY_MANAGER_EMAIL}`);
  console.log(`Inventory pwd:   ${INVENTORY_MANAGER_PASSWORD}`);
  console.log(`Doctor email:    ${DOCTOR_EMAIL}`);
  console.log(`Doctor password: ${DOCTOR_PASSWORD}`);
  console.log(`Reception email: ${RECEPTIONIST_EMAIL}`);
  console.log(`Reception pwd:   ${RECEPTIONIST_PASSWORD}`);
  console.log(`Accountant email:${ACCOUNTANT_EMAIL}`);
  console.log(`Accountant pwd:  ${ACCOUNTANT_PASSWORD}`);
  console.log(`GM email:        ${GM_EMAIL}`);
  console.log(`GM password:     ${GM_PASSWORD}`);
  console.log(`Nurse email:     ${NURSE_EMAIL}`);
  console.log(`Nurse password:  ${NURSE_PASSWORD}`);
  console.log(`Dentist email:   ${DENTIST_EMAIL}`);
  console.log(`Dentist pwd:     ${DENTIST_PASSWORD}`);
  console.log(`Branch mgr email:${BRANCH_MANAGER_EMAIL}`);
  console.log(`Branch mgr pwd:  ${BRANCH_MANAGER_PASSWORD}`);
  console.log(`Specialist email:${SPECIALIST_EMAIL}`);
  console.log(`Specialist pwd:  ${SPECIALIST_PASSWORD}`);
  console.log(`Patient email:   ${PATIENT_USER_EMAIL}`);
  console.log(`Patient pwd:     ${PATIENT_USER_PASSWORD}`);
  console.log('-----------------------------\n');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
