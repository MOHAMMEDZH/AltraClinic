import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import type {
  ApiCredential,
  ApiCredentialOwnerType,
  ApiCredentialStatus,
  ServiceAccount,
  ServiceAccountStatus,
} from '../../domain/integrations.entities';
import type {
  ApiCredentialRepository,
  ServiceAccountRepository,
} from '../../application/ports/repositories';

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String);
}

function toCredential(row: {
  id: string;
  tenantId: string;
  branchId: string | null;
  name: string;
  prefix: string;
  keyHash: string;
  hashAlgorithm: string;
  status: string;
  scopes: Prisma.JsonValue;
  ownerType: string;
  ownerId: string;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdBy: string;
  rotatedFromId: string | null;
  rotationGraceEndsAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): ApiCredential {
  return {
    id: row.id,
    tenantId: row.tenantId,
    branchId: row.branchId,
    name: row.name,
    prefix: row.prefix,
    keyHash: row.keyHash,
    hashAlgorithm: 'sha256_pepper_v1',
    status: row.status as ApiCredentialStatus,
    scopes: asStringArray(row.scopes),
    ownerType: row.ownerType as ApiCredentialOwnerType,
    ownerId: row.ownerId,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    createdBy: row.createdBy,
    rotatedFromId: row.rotatedFromId,
    rotationGraceEndsAt: row.rotationGraceEndsAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
  };
}

function toServiceAccount(row: {
  id: string;
  tenantId: string;
  displayName: string;
  status: string;
  roleBindings: Prisma.JsonValue;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  disabledAt: Date | null;
}): ServiceAccount {
  return {
    id: row.id,
    tenantId: row.tenantId,
    displayName: row.displayName,
    status: row.status as ServiceAccountStatus,
    roleBindings: asStringArray(row.roleBindings),
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    disabledAt: row.disabledAt?.toISOString() ?? null,
  };
}

@Injectable()
export class PrismaApiCredentialRepository implements ApiCredentialRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(
    tenantId: string,
    id: string,
  ): Promise<ApiCredential | null> {
    const row = await this.prisma.integrationApiCredential.findFirst({
      where: { id, tenantId },
    });
    return row ? toCredential(row) : null;
  }

  async findByPrefix(
    tenantId: string,
    prefix: string,
  ): Promise<ApiCredential | null> {
    const row = await this.prisma.integrationApiCredential.findFirst({
      where: { tenantId, prefix },
    });
    return row ? toCredential(row) : null;
  }

  async findByKeyHash(
    tenantId: string,
    keyHash: string,
  ): Promise<ApiCredential | null> {
    const row = await this.prisma.integrationApiCredential.findFirst({
      where: { tenantId, keyHash },
    });
    return row ? toCredential(row) : null;
  }

  async findByKeyHashGlobal(
    keyHash: string,
  ): Promise<ApiCredential | null> {
    const row = await this.prisma.integrationApiCredential.findFirst({
      where: { keyHash },
    });
    return row ? toCredential(row) : null;
  }

  async listByTenant(tenantId: string): Promise<readonly ApiCredential[]> {
    const rows = await this.prisma.integrationApiCredential.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toCredential);
  }

  async save(credential: ApiCredential): Promise<ApiCredential> {
    const data = {
      id: credential.id,
      tenantId: credential.tenantId,
      branchId: credential.branchId,
      name: credential.name,
      prefix: credential.prefix,
      keyHash: credential.keyHash,
      hashAlgorithm: credential.hashAlgorithm,
      status: credential.status,
      scopes: credential.scopes as unknown as Prisma.InputJsonValue,
      ownerType: credential.ownerType,
      ownerId: credential.ownerId,
      serviceAccountId:
        credential.ownerType === 'service_account'
          ? credential.ownerId
          : null,
      expiresAt: credential.expiresAt
        ? new Date(credential.expiresAt)
        : null,
      lastUsedAt: credential.lastUsedAt
        ? new Date(credential.lastUsedAt)
        : null,
      createdBy: credential.createdBy,
      rotatedFromId: credential.rotatedFromId,
      rotationGraceEndsAt: credential.rotationGraceEndsAt
        ? new Date(credential.rotationGraceEndsAt)
        : null,
      revokedAt: credential.revokedAt
        ? new Date(credential.revokedAt)
        : null,
      createdAt: new Date(credential.createdAt),
      updatedAt: new Date(credential.updatedAt),
    };
    const row = await this.prisma.integrationApiCredential.upsert({
      where: { id: credential.id },
      create: data,
      update: {
        name: data.name,
        status: data.status,
        scopes: data.scopes,
        expiresAt: data.expiresAt,
        lastUsedAt: data.lastUsedAt,
        rotatedFromId: data.rotatedFromId,
        rotationGraceEndsAt: data.rotationGraceEndsAt,
        revokedAt: data.revokedAt,
        updatedAt: data.updatedAt,
        keyHash: data.keyHash,
        prefix: data.prefix,
      },
    });
    return toCredential(row);
  }

  async saveMany(credentials: readonly ApiCredential[]): Promise<void> {
    for (const c of credentials) {
      await this.save(c);
    }
  }
}

@Injectable()
export class PrismaServiceAccountRepository
  implements ServiceAccountRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async findById(
    tenantId: string,
    id: string,
  ): Promise<ServiceAccount | null> {
    const row = await this.prisma.integrationServiceAccount.findFirst({
      where: { id, tenantId },
    });
    return row ? toServiceAccount(row) : null;
  }

  async listByTenant(tenantId: string): Promise<readonly ServiceAccount[]> {
    const rows = await this.prisma.integrationServiceAccount.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toServiceAccount);
  }

  async save(account: ServiceAccount): Promise<ServiceAccount> {
    const data = {
      id: account.id,
      tenantId: account.tenantId,
      displayName: account.displayName,
      status: account.status,
      roleBindings: account.roleBindings as unknown as Prisma.InputJsonValue,
      createdBy: account.createdBy,
      createdAt: new Date(account.createdAt),
      updatedAt: new Date(account.updatedAt),
      disabledAt: account.disabledAt
        ? new Date(account.disabledAt)
        : null,
    };
    const row = await this.prisma.integrationServiceAccount.upsert({
      where: { id: account.id },
      create: data,
      update: {
        displayName: data.displayName,
        status: data.status,
        roleBindings: data.roleBindings,
        disabledAt: data.disabledAt,
        updatedAt: data.updatedAt,
      },
    });
    return toServiceAccount(row);
  }
}
