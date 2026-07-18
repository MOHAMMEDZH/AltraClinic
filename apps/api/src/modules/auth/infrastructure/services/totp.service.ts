import { Injectable } from '@nestjs/common';
import { generateSecret, generateURI, verifySync } from 'otplib';

const ISSUER = process.env['MFA_ISSUER'] ?? 'Demo Clinic';

@Injectable()
export class TotpService {
  generateSecret(): string {
    return generateSecret();
  }

  buildOtpauthUrl(email: string, secret: string): string {
    return generateURI({
      issuer: ISSUER,
      label: email,
      secret,
    });
  }

  verify(secret: string, token: string): boolean {
    const normalized = token.replace(/\s/g, '');
    if (!/^\d{6}$/.test(normalized)) return false;
    return verifySync({ secret, token: normalized }).valid;
  }
}
