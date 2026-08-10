/**
 * Phase 46c — map Scheduling SoR shapes into patient-safe portal DTOs.
 * Never leak internal lock/SQL/policy fields.
 */

export interface PortalAppointmentDto {
  id: string;
  branchId: string | null;
  providerId: string;
  start: string;
  end: string;
  status: string;
  serviceType: string | null;
  cancellationReason?: string | null;
  updatedAt?: string;
}

export interface PortalAvailabilitySlotDto {
  start: string;
  end: string;
}

export interface PortalProviderDto {
  id: string;
  name: string;
}

type SchedulingListItem = {
  id: string;
  branchId: string | null;
  providerId: string;
  start: string;
  end: string;
  status: string;
  serviceType: string | null;
  cancellationReason?: string | null;
  updatedAt?: string;
};

export function toPortalAppointmentDto(item: SchedulingListItem): PortalAppointmentDto {
  return {
    id: item.id,
    branchId: item.branchId ?? null,
    providerId: item.providerId,
    start: item.start,
    end: item.end,
    status: String(item.status),
    serviceType: item.serviceType ?? null,
    ...(item.cancellationReason !== undefined
      ? { cancellationReason: item.cancellationReason }
      : {}),
    ...(item.updatedAt !== undefined ? { updatedAt: item.updatedAt } : {}),
  };
}

export function toPortalAppointmentList(items: SchedulingListItem[]): PortalAppointmentDto[] {
  return items.map(toPortalAppointmentDto);
}
