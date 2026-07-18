/**
 * Demo workflow center: 15 healthcare templates, instances, tasks, approvals, automation, logs.
 */
const TEMPLATE_DEFS = [
  { key: 'patient-registration-review', nameEn: 'Patient Registration Review', nameAr: 'مراجعة تسجيل المريض', category: 'clinical', triggerType: 'patient.registered', steps: [{ type: 'task', labelEn: 'Verify documents' }, { type: 'approval', labelEn: 'Reception sign-off' }] },
  { key: 'treatment-plan-approval', nameEn: 'Treatment Plan Approval', nameAr: 'موافقة خطة العلاج', category: 'clinical', triggerType: 'appointment.created', steps: [{ type: 'approval', labelEn: 'Clinical review' }, { type: 'task', labelEn: 'Schedule follow-up' }] },
  { key: 'refund-approval', nameEn: 'Refund Approval', nameAr: 'موافقة استرداد', category: 'financial', triggerType: 'payment.received', steps: [{ type: 'approval', labelEn: 'Accountant review' }, { type: 'approval', labelEn: 'Manager approval' }, { type: 'task', labelEn: 'Process refund' }] },
  { key: 'discount-approval', nameEn: 'Discount Approval', nameAr: 'موافقة خصم', category: 'financial', triggerType: 'invoice.created', steps: [{ type: 'approval', labelEn: 'Manager approval' }] },
  { key: 'purchase-order-approval', nameEn: 'Purchase Order Approval', nameAr: 'موافقة أمر شراء', category: 'inventory', triggerType: 'inventory.low_stock', steps: [{ type: 'approval', labelEn: 'Inventory manager' }, { type: 'task', labelEn: 'Place order' }] },
  { key: 'inventory-adjustment-approval', nameEn: 'Inventory Adjustment Approval', nameAr: 'موافقة تعديل مخزون', category: 'inventory', triggerType: 'inventory.low_stock', steps: [{ type: 'approval', labelEn: 'Inventory manager' }, { type: 'approval', labelEn: 'Owner approval' }] },
  { key: 'low-stock-reorder', nameEn: 'Low Stock Reorder Workflow', nameAr: 'إعادة طلب عند انخفاض المخزون', category: 'inventory', triggerType: 'inventory.low_stock', steps: [{ type: 'task', labelEn: 'Review stock level' }, { type: 'automation', labelEn: 'Create PO draft' }] },
  { key: 'expiring-product-review', nameEn: 'Expiring Product Review', nameAr: 'مراجعة منتجات منتهية', category: 'inventory', triggerType: 'inventory.low_stock', steps: [{ type: 'task', labelEn: 'Review expiry list' }, { type: 'notification', labelEn: 'Alert inventory team' }] },
  { key: 'subscription-renewal-reminder', nameEn: 'Subscription Renewal Reminder', nameAr: 'تذكير تجديد الاشتراك', category: 'subscription', triggerType: 'subscription.expiring', steps: [{ type: 'notification', labelEn: 'Send reminder' }, { type: 'task', labelEn: 'Follow up with owner' }] },
  { key: 'data-export-approval', nameEn: 'Data Export Approval', nameAr: 'موافقة تصدير البيانات', category: 'security', triggerType: 'security.alert', status: 'DRAFT', steps: [{ type: 'approval', labelEn: 'Owner approval' }] },
  { key: 'new-user-onboarding', nameEn: 'New User Onboarding', nameAr: 'إعداد مستخدم جديد', category: 'administrative', triggerType: 'user.created', steps: [{ type: 'task', labelEn: 'Provision access' }, { type: 'task', labelEn: 'Assign training' }] },
  { key: 'permission-change-approval', nameEn: 'Permission Change Approval', nameAr: 'موافقة تغيير صلاحيات', category: 'security', triggerType: 'user.created', steps: [{ type: 'approval', labelEn: 'Manager approval' }, { type: 'approval', labelEn: 'Owner approval' }] },
  { key: 'incident-review', nameEn: 'Incident Review', nameAr: 'مراجعة حادث', category: 'security', triggerType: 'security.alert', steps: [{ type: 'task', labelEn: 'Document incident' }, { type: 'approval', labelEn: 'Compliance review' }] },
  { key: 'complaint-handling', nameEn: 'Complaint Handling', nameAr: 'معالجة شكوى', category: 'administrative', triggerType: 'patient.registered', steps: [{ type: 'task', labelEn: 'Acknowledge complaint' }, { type: 'task', labelEn: 'Resolution follow-up' }] },
  { key: 'follow-up-reminder', nameEn: 'Follow-Up Reminder Workflow', nameAr: 'تذكير متابعة', category: 'clinical', triggerType: 'appointment.created', steps: [{ type: 'delay', labelEn: 'Wait 7 days' }, { type: 'notification', labelEn: 'Send reminder' }] },
];

export async function seedWorkflowCenter(prisma, { tenantId, ownerId, branchId, doctorId, accountantId }) {
  const templateIds = [];

  for (let i = 0; i < TEMPLATE_DEFS.length; i++) {
    const tpl = TEMPLATE_DEFS[i];
    const id = `f2000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`;
    templateIds.push(id);
    const status = tpl.status ?? 'ACTIVE';
    await prisma.workflowTemplate.upsert({
      where: { tenantId_key: { tenantId, key: tpl.key } },
      create: {
        id,
        tenantId,
        key: tpl.key,
        nameEn: tpl.nameEn,
        nameAr: tpl.nameAr,
        descriptionEn: tpl.nameEn,
        descriptionAr: tpl.nameAr,
        category: tpl.category,
        triggerType: tpl.triggerType,
        steps: tpl.steps,
        status,
        isSystem: true,
        slaHours: 48,
        publishedAt: status === 'ACTIVE' ? new Date() : null,
        createdBy: ownerId,
        updatedBy: ownerId,
      },
      update: { nameEn: tpl.nameEn, nameAr: tpl.nameAr, steps: tpl.steps, status, publishedAt: status === 'ACTIVE' ? new Date() : null },
    });
  }

  const workflowId = 'f2100000-0000-4000-8000-000000000001';
  await prisma.workflow.upsert({
    where: { id: workflowId },
    create: {
      id: workflowId,
      tenantId,
      branchId,
      templateId: templateIds[2],
      nameEn: 'Refund request — Invoice #1042',
      nameAr: 'طلب استرداد — فاتورة 1042',
      descriptionEn: 'Patient requested partial refund for cancelled procedure',
      descriptionAr: 'طلب المريض استرداداً جزئياً لإجراء ملغى',
      steps: ['Accountant review', 'Manager approval', 'Process refund'],
      currentStepIndex: 0,
      status: 'ACTIVE',
      triggerType: 'payment.received',
      createdBy: ownerId,
    },
    update: { status: 'ACTIVE', currentStepIndex: 0 },
  });

  const workflowId2 = 'f2100000-0000-4000-8000-000000000002';
  await prisma.workflow.upsert({
    where: { id: workflowId2 },
    create: {
      id: workflowId2,
      tenantId,
      branchId,
      templateId: templateIds[1],
      nameEn: 'Treatment plan — Sarah Al-Hassan',
      nameAr: 'خطة علاج — سارة الحسن',
      descriptionEn: 'Dental treatment plan pending clinical sign-off',
      descriptionAr: 'خطة علاج أسنان بانتظار الموافقة السريرية',
      steps: ['Clinical review', 'Schedule follow-up'],
      currentStepIndex: 1,
      status: 'ACTIVE',
      triggerType: 'appointment.created',
      createdBy: doctorId,
    },
    update: { status: 'ACTIVE', currentStepIndex: 1 },
  });

  const workflowId3 = 'f2100000-0000-4000-8000-000000000003';
  await prisma.workflow.upsert({
    where: { id: workflowId3 },
    create: {
      id: workflowId3,
      tenantId,
      branchId,
      nameEn: 'Failed automation — PO sync',
      nameAr: 'أتمتة فاشلة — مزامنة PO',
      descriptionEn: 'External procurement webhook failed',
      descriptionAr: 'فشل webhook المشتريات الخارجي',
      steps: ['Retry', 'Manual review'],
      currentStepIndex: 0,
      status: 'FAILED',
      triggerType: 'inventory.low_stock',
      createdBy: ownerId,
    },
    update: { status: 'FAILED' },
  });

  await prisma.workflowTask.upsert({
    where: { id: 'f2200000-0000-4000-8000-000000000001' },
    create: {
      id: 'f2200000-0000-4000-8000-000000000001',
      tenantId,
      branchId,
      workflowId,
      title: 'Review refund documentation',
      titleAr: 'مراجعة مستندات الاسترداد',
      status: 'ASSIGNED',
      priority: 'HIGH',
      assigneeId: accountantId,
      assignedBy: ownerId,
      dueAt: new Date(Date.now() + 86400000),
      metadata: { comments: [{ text: 'Please verify invoice attachments', actorId: ownerId, at: new Date().toISOString() }] },
    },
    update: { status: 'ASSIGNED', assigneeId: accountantId },
  });

  await prisma.workflowTask.upsert({
    where: { id: 'f2200000-0000-4000-8000-000000000002' },
    create: {
      id: 'f2200000-0000-4000-8000-000000000002',
      tenantId,
      branchId,
      workflowId: workflowId2,
      title: 'Schedule follow-up appointment',
      titleAr: 'جدولة موعد متابعة',
      status: 'PENDING',
      priority: 'MEDIUM',
      assigneeId: ownerId,
      dueAt: new Date(Date.now() - 86400000),
    },
    update: { status: 'PENDING' },
  });

  await prisma.workflowApproval.upsert({
    where: { id: 'f2300000-0000-4000-8000-000000000001' },
    create: {
      id: 'f2300000-0000-4000-8000-000000000001',
      tenantId,
      branchId,
      workflowId,
      title: 'Refund approval — $250',
      titleAr: 'موافقة استرداد — 250$',
      category: 'financial',
      status: 'PENDING',
      mode: 'SEQUENTIAL',
      requestedBy: ownerId,
      dueAt: new Date(Date.now() + 172800000),
    },
    update: { status: 'PENDING' },
  });

  await prisma.workflowAutomationRule.upsert({
    where: { id: 'f2400000-0000-4000-8000-000000000001' },
    create: {
      id: 'f2400000-0000-4000-8000-000000000001',
      tenantId,
      templateId: templateIds[6],
      name: 'Low stock reorder task',
      nameAr: 'مهمة إعادة طلب عند انخفاض المخزون',
      eventType: 'inventory.low_stock',
      actionType: 'create_task',
      actionConfig: { assignRole: 'inventory_manager' },
      isActive: true,
      createdBy: ownerId,
    },
    update: { isActive: true },
  });

  await prisma.workflowAutomationRule.upsert({
    where: { id: 'f2400000-0000-4000-8000-000000000002' },
    create: {
      id: 'f2400000-0000-4000-8000-000000000002',
      tenantId,
      name: 'Appointment follow-up reminder',
      nameAr: 'تذكير متابعة الموعد',
      eventType: 'appointment.created',
      actionType: 'send_notification',
      actionConfig: {},
      isActive: true,
      createdBy: ownerId,
    },
    update: { isActive: true },
  });

  const logEntries = [
    { workflowId, eventType: 'workflow.started', stepIndex: 0 },
    { workflowId, eventType: 'step.entered', stepIndex: 0 },
    { workflowId: workflowId2, eventType: 'workflow.started', stepIndex: 0 },
    { workflowId: workflowId2, eventType: 'step.advanced', stepIndex: 1 },
    { workflowId: workflowId3, eventType: 'workflow.failed', stepIndex: 0 },
  ];

  for (let i = 0; i < logEntries.length; i++) {
    const entry = logEntries[i];
    const logId = `f2500000-0000-4000-8000-00000000000${i + 1}`;
    await prisma.workflowExecutionLog.upsert({
      where: { id: logId },
      create: {
        id: logId,
        tenantId,
        workflowId: entry.workflowId,
        stepIndex: entry.stepIndex,
        eventType: entry.eventType,
        actorId: ownerId,
        details: { source: 'seed' },
      },
      update: {},
    });
  }
}
