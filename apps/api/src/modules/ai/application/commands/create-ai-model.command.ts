import { AiModelType } from '../../domain/value-objects/ai-model-type';

export class CreateAiModelCommand {
  constructor(
    public readonly nameEn: string,
    public readonly nameAr: string,
    public readonly descriptionEn: string,
    public readonly descriptionAr: string,
    public readonly modelType: AiModelType,
    public readonly version: string,
    public readonly branchId: string | null,
    public readonly createdBy: string,
  ) {}
}
