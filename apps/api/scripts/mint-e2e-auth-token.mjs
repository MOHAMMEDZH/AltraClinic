/**
 * Mint one-time auth tokens for Playwright E2E (password reset / email verification).
 * Usage: node scripts/mint-e2e-auth-token.mjs <reset|verify> <email> <tenantId>
 */
import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes, randomUUID } from 'node:crypto';

const [kind, email, tenantId] = process.argv.slice(2);

if (!kind || !email || !tenantId) {
  console.error('Usage: node scripts/mint-e2e-auth-token.mjs <reset|verify> <email> <tenantId>');
  process.exit(1);
}

const prisma = new PrismaClient();

function hashRaw(raw) {
  return createHash('sha256').update(raw).digest('hex');
}

function mintRaw() {
  return randomBytes(32).toString('hex');
}

try {
  const user = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId, email: email.toLowerCase() } },
  });

  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  if (kind === 'reset') {
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
    const raw = mintRaw();
    await prisma.passwordResetToken.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        tenantId: user.tenantId,
        tokenHash: hashRaw(raw),
        expiresAt: new Date(Date.now() + 30 * 60_000),
        ipAddress: '127.0.0.1',
      },
    });
    process.stdout.write(raw);
  } else if (kind === 'verify') {
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: false, emailVerifiedAt: null },
    });
    await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });
    const raw = mintRaw();
    await prisma.emailVerificationToken.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        tenantId: user.tenantId,
        tokenHash: hashRaw(raw),
        expiresAt: new Date(Date.now() + 24 * 3_600_000),
      },
    });
    process.stdout.write(raw);
  } else {
    console.error(`Unknown kind: ${kind}`);
    process.exit(1);
  }
} finally {
  await prisma.$disconnect();
}
