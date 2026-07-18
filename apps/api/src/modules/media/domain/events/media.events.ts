import { BaseDomainEvent } from '../../../../domain/events/base-domain-event';

export class MediaUploadedEvent extends BaseDomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly branchId: string | null,
    public readonly mediaId: string,
    public readonly category: string,
    public readonly ownerType: string,
    public readonly ownerId: string,
    public readonly patientId: string | null,
    public readonly uploadedBy: string,
  ) {
    super();
  }
}

export class MediaProcessedEvent extends BaseDomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly mediaId: string,
    public readonly variantCount: number,
    public readonly totalBytes: number,
  ) {
    super();
  }
}

export class MediaQuarantinedEvent extends BaseDomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly mediaId: string,
    public readonly reason: string,
  ) {
    super();
  }
}

export class MediaDeletedEvent extends BaseDomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly mediaId: string,
    public readonly deletedBy: string,
  ) {
    super();
  }
}
