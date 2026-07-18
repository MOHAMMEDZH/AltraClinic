export class AiModelDto {
  modelId!: string;
  tenantId!: string;
  branchId!: string | null;
  nameEn!: string;
  nameAr!: string;
  descriptionEn!: string;
  descriptionAr!: string;
  modelType!: string;
  version!: string;
  status!: string;
  createdBy!: string;
  createdAt!: string;
  updatedAt!: string;
  validatedBy!: string | null;
  validatedAt!: string | null;
  validationNotes!: string | null;
  deployedBy!: string | null;
  deployedAt!: string | null;
  retiredBy!: string | null;
  retiredAt!: string | null;
}
