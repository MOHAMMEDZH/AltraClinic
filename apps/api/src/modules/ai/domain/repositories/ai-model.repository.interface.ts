import { AiModel } from '../entities/ai-model.entity';

export interface AiModelFilter {
  tenantId: string;
  branchId?: string | null;
  modelType?: string | null;
  status?: string | null;
  limit?: number;
  offset?: number;
}

export interface AiModelRepository {
  save(model: AiModel): Promise<void>;
  findById(modelId: string, tenantId: string): Promise<AiModel | null>;
  list(filter: AiModelFilter): Promise<AiModel[]>;
}
