import { randomUUID } from 'crypto';
import { AiModelStatusVO } from '../value-objects/ai-model-status.vo';
import { AiModelType } from '../value-objects/ai-model-type';
import { AiDomainError } from '../exceptions/ai-domain.exception';

export interface AiModelProps {
  modelId: string;
  tenantId: string;
  branchId?: string | null;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  modelType: AiModelType;
  version: string;
  status: AiModelStatusVO;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  validatedBy?: string | null;
  validatedAt?: Date | null;
  validationNotes?: string | null;
  deployedBy?: string | null;
  deployedAt?: Date | null;
  retiredBy?: string | null;
  retiredAt?: Date | null;
}

export class AiModel {
  private readonly props: AiModelProps;

  private constructor(props: AiModelProps) {
    this.props = props;
  }

  static create(params: {
    tenantId: string;
    branchId?: string | null;
    nameEn: string;
    nameAr: string;
    descriptionEn: string;
    descriptionAr: string;
    modelType: AiModelType;
    version: string;
    createdBy: string;
  }): AiModel {
    const now = new Date();

    if (!params.nameEn?.trim()) {
      throw new AiDomainError('English model name is required');
    }
    if (!params.nameAr?.trim()) {
      throw new AiDomainError('Arabic model name is required');
    }
    if (!params.descriptionEn?.trim()) {
      throw new AiDomainError('English model description is required');
    }
    if (!params.descriptionAr?.trim()) {
      throw new AiDomainError('Arabic model description is required');
    }
    if (!params.modelType?.trim()) {
      throw new AiDomainError('Model type is required');
    }
    if (!params.version?.trim()) {
      throw new AiDomainError('Model version is required');
    }
    if (!params.createdBy?.trim()) {
      throw new AiDomainError('CreatedBy is required');
    }

    return new AiModel({
      modelId: randomUUID(),
      tenantId: params.tenantId,
      branchId: params.branchId ?? null,
      nameEn: params.nameEn.trim(),
      nameAr: params.nameAr.trim(),
      descriptionEn: params.descriptionEn.trim(),
      descriptionAr: params.descriptionAr.trim(),
      modelType: params.modelType,
      version: params.version.trim(),
      status: new AiModelStatusVO('draft'),
      createdBy: params.createdBy.trim(),
      createdAt: now,
      updatedAt: now,
      validatedBy: null,
      validatedAt: null,
      validationNotes: null,
      deployedBy: null,
      deployedAt: null,
      retiredBy: null,
      retiredAt: null,
    });
  }

  /** Reconstitutes an AiModel from persistence. */
  static restore(props: AiModelProps): AiModel {
    return new AiModel(props);
  }

  get id(): string {
    return this.props.modelId;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get branchId(): string | null {
    return this.props.branchId ?? null;
  }

  get nameEn(): string {
    return this.props.nameEn;
  }

  get nameAr(): string {
    return this.props.nameAr;
  }

  get descriptionEn(): string {
    return this.props.descriptionEn;
  }

  get descriptionAr(): string {
    return this.props.descriptionAr;
  }

  get modelType(): string {
    return this.props.modelType;
  }

  get version(): string {
    return this.props.version;
  }

  get status(): AiModelStatusVO {
    return this.props.status;
  }

  get createdBy(): string {
    return this.props.createdBy;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get validatedBy(): string | null {
    return this.props.validatedBy ?? null;
  }

  get validatedAt(): Date | null {
    return this.props.validatedAt ?? null;
  }

  get validationNotes(): string | null {
    return this.props.validationNotes ?? null;
  }

  get deployedBy(): string | null {
    return this.props.deployedBy ?? null;
  }

  get deployedAt(): Date | null {
    return this.props.deployedAt ?? null;
  }

  get retiredBy(): string | null {
    return this.props.retiredBy ?? null;
  }

  get retiredAt(): Date | null {
    return this.props.retiredAt ?? null;
  }

  validate(validatedBy: string, notes?: string | null): void {
    if (!validatedBy?.trim()) {
      throw new AiDomainError('ValidatedBy is required to validate a model');
    }
    if (this.props.status.value === 'retired') {
      throw new AiDomainError('Retired models cannot be validated');
    }
    if (this.props.status.value === 'deployed') {
      throw new AiDomainError('Deployed models are already past validation');
    }
    if (this.props.status.value === 'validated') {
      throw new AiDomainError('Model is already validated');
    }
    if (validatedBy.trim() === this.props.createdBy) {
      throw new AiDomainError('A model cannot be validated by the same user who created it');
    }

    this.props.status = new AiModelStatusVO('validated');
    this.props.validatedBy = validatedBy.trim();
    this.props.validationNotes = notes?.trim() || null;
    this.props.validatedAt = new Date();
    this.props.updatedAt = new Date();
  }

  deploy(deployedBy: string): void {
    if (!deployedBy?.trim()) {
      throw new AiDomainError('DeployedBy is required to deploy a model');
    }
    if (this.props.status.value === 'deployed') {
      throw new AiDomainError('Model is already deployed');
    }
    if (this.props.status.value === 'retired') {
      throw new AiDomainError('Retired models cannot be deployed');
    }
    if (this.props.status.value !== 'validated') {
      throw new AiDomainError('Model must be validated before it can be deployed');
    }

    this.props.status = new AiModelStatusVO('deployed');
    this.props.deployedBy = deployedBy.trim();
    this.props.deployedAt = new Date();
    this.props.updatedAt = new Date();
  }

  retire(retiredBy: string): void {
    if (!retiredBy?.trim()) {
      throw new AiDomainError('RetiredBy is required to retire a model');
    }
    if (this.props.status.value === 'retired') {
      throw new AiDomainError('Model is already retired');
    }

    this.props.status = new AiModelStatusVO('retired');
    this.props.retiredBy = retiredBy.trim();
    this.props.retiredAt = new Date();
    this.props.updatedAt = new Date();
  }

  toPrimitives() {
    return {
      modelId: this.props.modelId,
      tenantId: this.props.tenantId,
      branchId: this.props.branchId,
      nameEn: this.props.nameEn,
      nameAr: this.props.nameAr,
      descriptionEn: this.props.descriptionEn,
      descriptionAr: this.props.descriptionAr,
      modelType: this.props.modelType,
      version: this.props.version,
      status: this.props.status.value,
      createdBy: this.props.createdBy,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
      validatedBy: this.props.validatedBy ?? null,
      validatedAt: this.props.validatedAt?.toISOString() ?? null,
      validationNotes: this.props.validationNotes ?? null,
      deployedBy: this.props.deployedBy ?? null,
      deployedAt: this.props.deployedAt?.toISOString() ?? null,
      retiredBy: this.props.retiredBy ?? null,
      retiredAt: this.props.retiredAt?.toISOString() ?? null,
    };
  }
}
