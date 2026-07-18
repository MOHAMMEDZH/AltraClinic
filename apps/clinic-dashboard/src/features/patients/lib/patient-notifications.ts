import { apiRequest } from '@/lib/api-client';

export interface SendPatientNotificationInput {
  patientId: string;
  channel: 'whatsapp' | 'email' | 'sms' | 'in-app';
  title: string;
  body: string;
  branchId?: string | null;
}

export async function sendPatientNotification(
  token: string,
  tenantId: string,
  input: SendPatientNotificationInput,
): Promise<{ id: string }> {
  return apiRequest<{ id: string }>('/notifications', {
    method: 'POST',
    token,
    tenantId,
    body: {
      recipientId: input.patientId,
      channel: input.channel,
      title: input.title,
      body: input.body,
      priority: 'medium',
      branchId: input.branchId ?? undefined,
    },
  });
}
