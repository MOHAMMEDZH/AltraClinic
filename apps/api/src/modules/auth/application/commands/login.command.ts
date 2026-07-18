export interface LoginCommand {
  email: string;
  password: string;
  tenantId: string;
  ipAddress: string;
  userAgent: string;
  deviceName?: string | null;
  deviceTrustToken?: string | null;
}
