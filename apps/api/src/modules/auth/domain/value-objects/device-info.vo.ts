/**
 * Captures the device fingerprint from a login request.
 * Used for session tracking and suspicious-login detection.
 */
export class DeviceInfoVO {
  readonly ipAddress: string;
  readonly userAgent: string;
  readonly deviceName: string | null;

  constructor(props: {
    ipAddress: string;
    userAgent: string;
    deviceName?: string | null;
  }) {
    this.ipAddress = (props.ipAddress ?? '').trim().slice(0, 45);
    this.userAgent = (props.userAgent ?? '').trim().slice(0, 512);
    this.deviceName = props.deviceName?.trim().slice(0, 255) ?? null;
  }

  /** Derive a human-readable label from the user-agent when deviceName is absent */
  get label(): string {
    if (this.deviceName) return this.deviceName;
    const ua = this.userAgent.toLowerCase();
    if (ua.includes('mobile')) return 'Mobile Browser';
    if (ua.includes('postman')) return 'Postman';
    if (ua.includes('curl')) return 'cURL Client';
    return 'Web Browser';
  }
}
