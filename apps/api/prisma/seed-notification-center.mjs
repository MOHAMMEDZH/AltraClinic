/**
 * Demo notification center: templates, channel configs, automation rules, sample inbox items.
 */
export async function seedNotificationCenter(prisma, { tenantId, ownerId }) {
  const channels = ['IN_APP', 'EMAIL', 'SMS', 'PUSH', 'WHATSAPP'];
  for (const channel of channels) {
    await prisma.tenantChannelConfig.upsert({
      where: { tenantId_channel: { tenantId, channel } },
      create: {
        tenantId,
        channel,
        isEnabled: channel !== 'PUSH',
        provider: channel === 'SMS' ? 'twilio' : channel === 'EMAIL' ? 'smtp' : channel === 'WHATSAPP' ? 'whatsapp' : null,
        providerStatus: channel === 'IN_APP' ? 'healthy' : 'unknown',
      },
      update: { isEnabled: channel !== 'PUSH' },
    });
  }

  const templates = [
    {
      id: 'f1000000-0000-4000-8000-000000000001',
      key: 'appointment-reminder',
      name: 'Appointment reminder',
      nameAr: 'تذكير بالموعد',
      channel: 'SMS',
      category: 'CLINICAL',
      subjectEn: 'Appointment reminder',
      subjectAr: 'تذكير بالموعد',
      bodyEn: 'Hello {{patientName}}, your appointment is on {{date}} at {{time}}.',
      bodyAr: 'مرحباً {{patientName}}، موعدك في {{date}} الساعة {{time}}.',
      variables: ['patientName', 'date', 'time'],
    },
    {
      id: 'f1000000-0000-4000-8000-000000000002',
      key: 'payment-reminder',
      name: 'Payment reminder',
      nameAr: 'تذكير بالدفع',
      channel: 'EMAIL',
      category: 'FINANCIAL',
      subjectEn: 'Payment due',
      subjectAr: 'دفعة مستحقة',
      bodyEn: 'Invoice {{invoiceNumber}} for {{amount}} is due on {{dueDate}}.',
      bodyAr: 'الفاتورة {{invoiceNumber}} بمبلغ {{amount}} مستحقة في {{dueDate}}.',
      variables: ['invoiceNumber', 'amount', 'dueDate'],
    },
    {
      id: 'f1000000-0000-4000-8000-000000000003',
      key: 'user-invitation',
      name: 'Staff invitation',
      nameAr: 'دعوة موظف',
      channel: 'IN_APP',
      category: 'SYSTEM',
      subjectEn: 'Welcome to the clinic',
      subjectAr: 'مرحباً بك في العيادة',
      bodyEn: 'You have been invited to join {{clinicName}}.',
      bodyAr: 'تمت دعوتك للانضمام إلى {{clinicName}}.',
      variables: ['clinicName'],
    },
  ];

  for (const tpl of templates) {
    await prisma.notificationTemplate.upsert({
      where: { tenantId_key_channel: { tenantId, key: tpl.key, channel: tpl.channel } },
      create: {
        ...tpl,
        tenantId,
        createdBy: ownerId,
        updatedBy: ownerId,
        versions: {
          create: {
            version: 1,
            subjectEn: tpl.subjectEn,
            subjectAr: tpl.subjectAr,
            bodyEn: tpl.bodyEn,
            bodyAr: tpl.bodyAr,
            createdBy: ownerId,
          },
        },
      },
      update: {
        name: tpl.name,
        nameAr: tpl.nameAr,
        subjectEn: tpl.subjectEn,
        bodyEn: tpl.bodyEn,
        isActive: true,
      },
    });
  }

  await prisma.notificationAutomationRule.upsert({
    where: { id: 'f2000000-0000-4000-8000-000000000001' },
    create: {
      id: 'f2000000-0000-4000-8000-000000000001',
      tenantId,
      name: 'Appointment reminder (24h)',
      nameAr: 'تذكير بالموعد (24 ساعة)',
      eventType: 'appointment.scheduled',
      channel: 'SMS',
      templateId: 'f1000000-0000-4000-8000-000000000001',
      isActive: true,
      schedule: '0 8 * * *',
      recipientRoles: ['patient'],
      createdBy: ownerId,
    },
    update: { isActive: true },
  });

  const extraRules = [
    {
      id: 'f2000000-0000-4000-8000-000000000002',
      name: 'Appointment cancelled',
      nameAr: 'إلغاء الموعد',
      eventType: 'appointment.cancelled',
      channel: 'SMS',
      templateId: 'f1000000-0000-4000-8000-000000000001',
      recipientRoles: ['patient'],
    },
    {
      id: 'f2000000-0000-4000-8000-000000000003',
      name: 'Payment received',
      nameAr: 'استلام الدفع',
      eventType: 'payment.received',
      channel: 'EMAIL',
      templateId: 'f1000000-0000-4000-8000-000000000002',
      recipientRoles: ['patient'],
    },
    {
      id: 'f2000000-0000-4000-8000-000000000004',
      name: 'Security alert',
      nameAr: 'تنبيه أمني',
      eventType: 'security.alert',
      channel: 'IN_APP',
      templateId: null,
      recipientRoles: ['OWNER', 'GENERAL_MANAGER'],
    },
    {
      id: 'f2000000-0000-4000-8000-000000000005',
      name: 'Staff invitation',
      nameAr: 'دعوة موظف',
      eventType: 'staff.invited',
      channel: 'IN_APP',
      templateId: 'f1000000-0000-4000-8000-000000000003',
      recipientRoles: ['user'],
    },
    {
      id: 'f2000000-0000-4000-8000-000000000006',
      name: 'Patient welcome',
      nameAr: 'ترحيب بالمريض',
      eventType: 'patient.registered',
      channel: 'IN_APP',
      templateId: null,
      recipientRoles: ['patient'],
    },
  ];

  for (const rule of extraRules) {
    await prisma.notificationAutomationRule.upsert({
      where: { id: rule.id },
      create: {
        ...rule,
        tenantId,
        isActive: true,
        schedule: null,
        createdBy: ownerId,
      },
      update: { isActive: true, name: rule.name },
    });
  }

  await prisma.notificationPreference.upsert({
    where: { tenantId_userId: { tenantId, userId: ownerId } },
    create: {
      tenantId,
      userId: ownerId,
      channelSettings: { inApp: true, email: true, sms: true, push: false, whatsapp: true },
      categorySettings: { clinical: true, financial: true, security: true },
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      timezone: 'Asia/Damascus',
      language: 'en-US',
    },
    update: {},
  });

  const samples = [
    {
      id: 'f3000000-0000-4000-8000-000000000001',
      title: 'Low stock alert',
      body: 'Nitrile Gloves (M) is below reorder threshold.',
      channel: 'IN_APP',
      category: 'INVENTORY',
      status: 'DELIVERED',
      priority: 'HIGH',
    },
    {
      id: 'f3000000-0000-4000-8000-000000000002',
      title: 'Appointment confirmed',
      body: 'Sarah Hassan appointment confirmed for tomorrow 10:00.',
      channel: 'IN_APP',
      category: 'CLINICAL',
      status: 'DELIVERED',
      priority: 'MEDIUM',
    },
    {
      id: 'f3000000-0000-4000-8000-000000000003',
      title: 'Payment received',
      body: 'Invoice #1042 payment received.',
      channel: 'IN_APP',
      category: 'FINANCIAL',
      status: 'READ',
      priority: 'LOW',
      readAt: new Date(),
    },
  ];

  for (const n of samples) {
    await prisma.notification.upsert({
      where: { id: n.id },
      create: {
        id: n.id,
        tenantId,
        recipientId: ownerId,
        channel: n.channel,
        category: n.category,
        title: n.title,
        body: n.body,
        status: n.status,
        priority: n.priority,
        readAt: n.readAt ?? null,
        sentAt: new Date(),
        deliveredAt: new Date(),
      },
      update: { title: n.title, body: n.body },
    });
  }

  console.log('  ✓ Notification center demo (templates, channels, automation, inbox samples)');
}
