import { Controller, Inject, Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PlatformUsersController } from '../api/platform-users.controller';
import { PLATFORM_USER_REPOSITORY } from '../platform-auth.tokens';
import { PlatformUserRepository } from '../domain/repositories/platform-user.repository.interface';
import { PLATFORM_REFRESH_TOKEN_REPOSITORY } from '../platform-auth.tokens';
import { PLATFORM_RBAC_CONFIG } from '../platform-rbac/config/platform-rbac-config';
import { PLATFORM_INVITATION_DELIVERY } from '../infrastructure/services/platform-invitation-delivery.port';
import { PlatformUserRoleRepository, PlatformInvitationRepository, PlatformMfaResetRepository } from '../infrastructure/repositories/prisma-platform-rbac.repositories';
import { PlatformAuthorizationService } from '../platform-rbac/platform-authorization.service';
import { PlatformSodService } from '../platform-rbac/platform-sod.service';
import { PlatformAssuranceService } from '../application/services/platform-assurance.service';
import { PlatformSessionRevocationService } from '../application/services/platform-session-revocation.service';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { PlatformUserAdminMutationsService } from '../application/services/platform-user-admin-mutations.service';

/**
 * Focused Nest DI regression: PlatformUsersController must resolve via
 * PLATFORM_USER_REPOSITORY token (AuthModule useClass mapping), not the concrete class token.
 */
describe('PlatformUsersController Nest DI (token injection)', () => {
  const stubRepo: PlatformUserRepository = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    save: jest.fn(),
    updateLoginState: jest.fn(),
    updateMfaState: jest.fn(),
    list: jest.fn(),
    updateLifecycle: jest.fn(),
    updateAuthzRevision: jest.fn(),
    countByRoleKey: jest.fn(),
    countActiveUsers: jest.fn(),
  };

  const commonProviders = [
    { provide: PLATFORM_USER_REPOSITORY, useValue: stubRepo },
    { provide: PlatformUserRoleRepository, useValue: {} },
    { provide: PlatformInvitationRepository, useValue: {} },
    { provide: PlatformMfaResetRepository, useValue: {} },
    { provide: PlatformAuthorizationService, useValue: {} },
    { provide: PlatformSodService, useValue: {} },
    { provide: PlatformAssuranceService, useValue: {} },
    { provide: PlatformSessionRevocationService, useValue: {} },
    { provide: PLATFORM_REFRESH_TOKEN_REPOSITORY, useValue: {} },
    { provide: PrismaService, useValue: {} },
    { provide: PLATFORM_RBAC_CONFIG, useValue: {} },
    { provide: PLATFORM_INVITATION_DELIVERY, useValue: {} },
    { provide: PlatformUserAdminMutationsService, useValue: {} },
  ];

  it('resolves PlatformUsersController when only PLATFORM_USER_REPOSITORY is registered', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PlatformUsersController],
      providers: commonProviders,
    }).compile();

    const controller = moduleRef.get(PlatformUsersController);
    expect(controller).toBeInstanceOf(PlatformUsersController);
  });

  it('fails when a consumer injects the concrete class token without a class provider (pre-fix shape)', async () => {
    @Injectable()
    class ConcreteRepoStub {}

    @Controller('legacy-class-inject')
    class LegacyClassInjectedController {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      constructor(private readonly users: ConcreteRepoStub) {}
    }

    await expect(
      Test.createTestingModule({
        controllers: [LegacyClassInjectedController],
        providers: [
          // Same AuthModule pattern: token-only registration, no class provider.
          { provide: PLATFORM_USER_REPOSITORY, useClass: ConcreteRepoStub },
        ],
      }).compile(),
    ).rejects.toThrow(/Nest can't resolve dependencies|ConcreteRepoStub/);
  });

  it('exposes the repository only under PLATFORM_USER_REPOSITORY (no class-provider dual registration)', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PlatformUsersController],
      providers: commonProviders,
    }).compile();

    expect(moduleRef.get<PlatformUserRepository>(PLATFORM_USER_REPOSITORY)).toBe(stubRepo);
  });
});
