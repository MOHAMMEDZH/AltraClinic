import { randomUUID } from 'crypto';
import { MediaCategoryVO } from '../value-objects/media-category.vo';
import { MediaVariantVO } from '../value-objects/media-variant.vo';
import { MediaMetadataVO } from '../value-objects/media-metadata.vo';

export type MediaAssetStatusType =
  | 'pending_scan'
  | 'processing'
  | 'ready'
  | 'quarantined'
  | 'deleted';

export type VirusScanStatusType = 'pending' | 'clean' | 'infected' | 'skipped' | 'error';

export type BeautyComparisonRoleType = 'before' | 'after';

export interface MediaAssetProps {
  id: string;
  tenantId: string;
  branchId: string | null;
  category: MediaCategoryVO;
  ownerType: string;
  ownerId: string;
  patientId: string | null;
  requiresPhotoConsent: boolean;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  status: MediaAssetStatusType;
  virusScanStatus: VirusScanStatusType;
  storageKey: string;
  variants: MediaVariantVO[];
  metadata: MediaMetadataVO;
  comparisonGroupId: string | null;
  comparisonRole: BeautyComparisonRoleType | null;
  uploadedBy: string;
  quarantineReason: string | null;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

const STATUS_TO_PRISMA: Record<MediaAssetStatusType, string> = {
  pending_scan: 'PENDING_SCAN',
  processing: 'PROCESSING',
  ready: 'READY',
  quarantined: 'QUARANTINED',
  deleted: 'DELETED',
};

const VIRUS_TO_PRISMA: Record<VirusScanStatusType, string> = {
  pending: 'PENDING',
  clean: 'CLEAN',
  infected: 'INFECTED',
  skipped: 'SKIPPED',
  error: 'ERROR',
};

export class MediaAsset {
  readonly id: string;
  readonly tenantId: string;
  readonly branchId: string | null;
  readonly category: MediaCategoryVO;
  readonly ownerType: string;
  readonly ownerId: string;
  readonly patientId: string | null;
  readonly requiresPhotoConsent: boolean;
  readonly originalFilename: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  status: MediaAssetStatusType;
  virusScanStatus: VirusScanStatusType;
  storageKey: string;
  variants: MediaVariantVO[];
  metadata: MediaMetadataVO;
  readonly comparisonGroupId: string | null;
  readonly comparisonRole: BeautyComparisonRoleType | null;
  readonly uploadedBy: string;
  quarantineReason: string | null;
  processedAt: Date | null;
  readonly createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;

  private constructor(props: MediaAssetProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.branchId = props.branchId;
    this.category = props.category;
    this.ownerType = props.ownerType;
    this.ownerId = props.ownerId;
    this.patientId = props.patientId;
    this.requiresPhotoConsent = props.requiresPhotoConsent;
    this.originalFilename = props.originalFilename;
    this.mimeType = props.mimeType;
    this.sizeBytes = props.sizeBytes;
    this.status = props.status;
    this.virusScanStatus = props.virusScanStatus;
    this.storageKey = props.storageKey;
    this.variants = props.variants;
    this.metadata = props.metadata;
    this.comparisonGroupId = props.comparisonGroupId;
    this.comparisonRole = props.comparisonRole;
    this.uploadedBy = props.uploadedBy;
    this.quarantineReason = props.quarantineReason;
    this.processedAt = props.processedAt;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.deletedAt = props.deletedAt;
  }

  static create(input: {
    tenantId: string;
    branchId: string | null;
    category: MediaCategoryVO;
    ownerType: string;
    ownerId: string;
    patientId: string | null;
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
    storageKey: string;
    uploadedBy: string;
    comparisonGroupId?: string | null;
    comparisonRole?: BeautyComparisonRoleType | null;
    metadata?: MediaMetadataVO;
  }): MediaAsset {
    const now = new Date();
    return new MediaAsset({
      id: randomUUID(),
      tenantId: input.tenantId,
      branchId: input.branchId,
      category: input.category,
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      patientId: input.patientId,
      requiresPhotoConsent: input.category.requiresPhotoConsent(),
      originalFilename: input.originalFilename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      status: 'pending_scan',
      virusScanStatus: 'pending',
      storageKey: input.storageKey,
      variants: [],
      metadata: input.metadata ?? new MediaMetadataVO(),
      comparisonGroupId: input.comparisonGroupId ?? null,
      comparisonRole: input.comparisonRole ?? null,
      uploadedBy: input.uploadedBy,
      quarantineReason: null,
      processedAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  static restore(props: MediaAssetProps): MediaAsset {
    return new MediaAsset(props);
  }

  markProcessing(): void {
    this.status = 'processing';
    this.updatedAt = new Date();
  }

  markReady(variants: MediaVariantVO[], metadata: MediaMetadataVO): void {
    this.variants = variants;
    this.metadata = metadata;
    this.status = 'ready';
    this.processedAt = new Date();
    this.updatedAt = new Date();
  }

  quarantine(reason: string, virusScanStatus: VirusScanStatusType = 'infected'): void {
    this.status = 'quarantined';
    this.virusScanStatus = virusScanStatus;
    this.quarantineReason = reason;
    this.updatedAt = new Date();
  }

  markVirusScan(status: VirusScanStatusType): void {
    this.virusScanStatus = status;
    this.updatedAt = new Date();
  }

  softDelete(): void {
    this.status = 'deleted';
    this.deletedAt = new Date();
    this.updatedAt = new Date();
  }

  isDownloadable(): boolean {
    return this.status === 'ready' && this.deletedAt === null;
  }

  totalStorageBytes(): number {
    const variantBytes = this.variants.reduce((sum, v) => sum + v.sizeBytes, 0);
    return this.sizeBytes + variantBytes;
  }

  getVariant(type: MediaVariantVO['type']): MediaVariantVO | null {
    return this.variants.find((v) => v.type === type) ?? null;
  }

  static statusToPrisma(status: MediaAssetStatusType): string {
    return STATUS_TO_PRISMA[status];
  }

  static statusFromPrisma(value: string): MediaAssetStatusType {
    const entry = Object.entries(STATUS_TO_PRISMA).find(([, v]) => v === value);
    if (!entry) throw new Error(`Unknown media status: ${value}`);
    return entry[0] as MediaAssetStatusType;
  }

  static virusToPrisma(status: VirusScanStatusType): string {
    return VIRUS_TO_PRISMA[status];
  }

  static virusFromPrisma(value: string): VirusScanStatusType {
    const entry = Object.entries(VIRUS_TO_PRISMA).find(([, v]) => v === value);
    if (!entry) throw new Error(`Unknown virus scan status: ${value}`);
    return entry[0] as VirusScanStatusType;
  }
}
