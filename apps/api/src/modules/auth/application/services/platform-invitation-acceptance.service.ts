import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { PasswordHasher } from '../../../identity/infrastructure/password-hasher';
import { PasswordPolicyVO } from '../../domain/value-objects/password-policy.vo';
import { JwtTokenService } from '../../infrastructure/services/jwt-token.service';

/**
 * Atomic invitation acceptance — conditional consume of pending invitation rows.
 */
@Injectable()
export class PlatformInvitationAcceptanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtTokenService: JwtTokenService,
  ) {}

  async accept(token: string, password: string): Promise<{
    kind: 'mfa_enrollment_required';
    preauthToken: string;
    expiresIn: number;
    platformUserId: string;
  }> {
    const policy = new PasswordPolicyVO({
      minLength: 8,
      requireUppercase: false,
      requireLowercase: false,
      requireDigit: false,
      requireSpecial: false,
    });
    if (!token || !password || !policy.isValid(password)) {
      throw new ForbiddenException('Invalid invitation.');
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const passwordHash = await PasswordHasher.hash(password);

    let platformUserId: string;
    try {
      platformUserId = await this.prisma.$transaction(
        async (tx) => {
          const invitation = await tx.platformUserInvitation.findUnique({ where: { tokenHash } });
          if (!invitation || invitation.status !== 'pending' || invitation.expiresAt <= new Date()) {
            throw new ForbiddenException('Invalid invitation.');
          }

          const consumed = await tx.platformUserInvitation.updateMany({
            where: { id: invitation.id, status: 'pending' },
            data: { status: 'accepted', acceptedAt: new Date() },
          });
          if (consumed.count !== 1) {
            throw new ForbiddenException('Invalid invitation.');
          }

          await tx.platformUser.update({
            where: { id: invitation.platformUserId },
            data: {
              passwordHash,
              passwordChangedAt: new Date(),
              status: 'active',
              isActive: true,
              mfaEnabled: false,
              mfaSecretEncrypted: null,
              mfaPendingSecretEncrypted: null,
              mfaPendingExpiresAt: null,
              mfaConfirmedAt: null,
            },
          });

          return invitation.platformUserId;
        },
        { timeout: 30_000 },
      );
    } catch (err: unknown) {
      // Concurrent losers / write conflicts must fail closed as Forbidden — never leak Prisma.
      // Duck-type Prisma errors (instanceof can fail across duplicate @prisma/client copies).
      if (err instanceof ForbiddenException) throw err;
      const e = err as { code?: unknown; name?: string; message?: string };
      const prismaName =
        typeof e?.name === 'string' &&
        (e.name === 'PrismaClientKnownRequestError' ||
          e.name === 'PrismaClientUnknownRequestError' ||
          e.name === 'PrismaClientRustPanicError' ||
          e.name === 'PrismaClientInitializationError' ||
          e.name === 'PrismaClientValidationError');
      const prismaCode = typeof e?.code === 'string' && /^P\d{4}$/.test(e.code);
      const prismaMsg =
        typeof e?.message === 'string' &&
        /unique constraint|write conflict|deadlock|could not serialize|transaction/i.test(e.message);
      if (prismaName || prismaCode || prismaMsg) {
        throw new ForbiddenException('Invalid invitation.');
      }
      throw err;
    }

    const preauth = this.jwtTokenService.issuePlatformPreauthToken({
      platformUserId,
      purpose: 'mfa_enrollment',
      transactionId: randomBytes(16).toString('hex'),
      expiresInSeconds: 900,
    });

    return {
      kind: 'mfa_enrollment_required',
      preauthToken: preauth.token,
      expiresIn: preauth.expiresIn,
      platformUserId,
    };
  }
}
