import { LoginAttempt } from '../entities/login-attempt.entity';

export interface LoginAttemptRepository {
  save(attempt: LoginAttempt): Promise<void>;
  countRecentFailures(email: string, windowMinutes: number): Promise<number>;
  countRecentFailuresByIp(ipAddress: string, windowMinutes: number): Promise<number>;
  listByEmail(email: string, tenantId: string, limit?: number): Promise<LoginAttempt[]>;
}
