import { PrismaRefreshTokenRepository } from '../infrastructure/repositories/prisma-refresh-token.repository';
import { RefreshToken } from '../domain/entities/refresh-token.entity';
import { PrismaService } from '../../../infrastructure/prisma.service';

const mockPrisma = {
  refreshToken: {
    upsert: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
};

describe('PrismaRefreshTokenRepository', () => {
  let repo: PrismaRefreshTokenRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new PrismaRefreshTokenRepository(mockPrisma as unknown as PrismaService);
  });

  const future = new Date(Date.now() + 86400_000);

  const makeToken = () =>
    RefreshToken.create({
      userId: 'u1', tenantId: 't1', rawToken: 'rawtoken', sessionId: 'session-1',
      deviceName: 'Chrome', expiresAt: future, ipAddress: '1.1.1.1', userAgent: 'ua',
    });

  it('save() calls upsert with correct shape including tenantId', async () => {
    mockPrisma.refreshToken.upsert.mockResolvedValue({});
    const token = makeToken();
    await repo.save(token);
    expect(mockPrisma.refreshToken.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: token.id },
        create: expect.objectContaining({ tenantId: 't1', userId: 'u1' }),
      }),
    );
  });

  it('findByTokenHash() returns null when not found', async () => {
    mockPrisma.refreshToken.findFirst.mockResolvedValue(null);
    const result = await repo.findByTokenHash('doesnotexist');
    expect(result).toBeNull();
  });

  it('findBySessionId() maps row to domain entity', async () => {
    const row = {
      id: 'rt1', userId: 'u1', tenantId: 't1', tokenHash: 'h', sessionId: 'session-1',
      deviceName: 'Chrome', expiresAt: future, revokedAt: null,
      ipAddress: '1.1.1.1', userAgent: 'ua', createdAt: new Date(),
    };
    mockPrisma.refreshToken.findUnique.mockResolvedValue(row);
    const result = await repo.findBySessionId('session-1');
    expect(result).not.toBeNull();
    expect(result!.sessionId).toBe('session-1');
    expect(result!.tenantId).toBe('t1');
    expect(result!.isValid()).toBe(true);
  });

  it('findActiveByUserId() scopes to tenantId', async () => {
    mockPrisma.refreshToken.findMany.mockResolvedValue([]);
    await repo.findActiveByUserId('u1', 't1');
    expect(mockPrisma.refreshToken.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'u1', tenantId: 't1', revokedAt: null }),
      }),
    );
  });

  it('revokeAllByUserId() calls updateMany', async () => {
    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });
    await repo.revokeAllByUserId('u1');
    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1', revokedAt: null } }),
    );
  });
});
