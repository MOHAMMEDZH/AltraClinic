import { ValueObject } from '../../../../common/value-object.base';

const validStatuses = new Set(['draft', 'queued', 'sent', 'delivered', 'failed', 'read']);

export class NotificationStatus extends ValueObject<{ status: string; failureReason: string | null; retryCount: number }> {
  public readonly status: string;
  public readonly failureReason: string | null;
  public readonly retryCount: number;

  private constructor(status: string, failureReason: string | null, retryCount: number) {
    super({ status, failureReason, retryCount });
    this.status = status;
    this.failureReason = failureReason;
    this.retryCount = retryCount;
  }

  public static queued(): NotificationStatus {
    return new NotificationStatus('queued', null, 0);
  }

  public static sent(): NotificationStatus {
    return new NotificationStatus('sent', null, 0);
  }

  public static delivered(): NotificationStatus {
    return new NotificationStatus('delivered', null, 0);
  }

  public static failed(reason: string, retryCount = 0): NotificationStatus {
    return new NotificationStatus('failed', reason || 'Unknown failure', retryCount);
  }

  public static read(previous: NotificationStatus): NotificationStatus {
    return new NotificationStatus('read', previous.failureReason, previous.retryCount);
  }

  public static from(status: string, failureReason: string | null = null, retryCount = 0): NotificationStatus {
    const normalized = String(status ?? '').trim();
    if (!normalized || !validStatuses.has(normalized)) {
      throw new Error(`Invalid notification status: ${status}`);
    }
    return new NotificationStatus(normalized, failureReason, retryCount);
  }

  public canRetry(): boolean {
    return this.status === 'failed' && this.retryCount < 3;
  }

  public toJSON() {
    return {
      status: this.status,
      failureReason: this.failureReason,
      retryCount: this.retryCount,
    };
  }
}
