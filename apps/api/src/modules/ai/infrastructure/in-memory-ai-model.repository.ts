import { Injectable } from '@nestjs/common';
import { AiModel } from '../domain/entities/ai-model.entity';
import { AiModelRepository, AiModelFilter } from '../domain/repositories/ai-model.repository.interface';

@Injectable()
export class InMemoryAiModelRepository implements AiModelRepository {
  private readonly items: AiModel[] = [];

  async save(model: AiModel): Promise<void> {
    const index = this.items.findIndex((item) => item.id === model.id && item.tenantId === model.tenantId);
    if (index >= 0) {
      this.items[index] = model;
      return;
    }

    this.items.push(model);
  }

  async findById(modelId: string, tenantId: string): Promise<AiModel | null> {
    return this.items.find((item) => item.id === modelId && item.tenantId === tenantId) ?? null;
  }

  async list(filter: AiModelFilter): Promise<AiModel[]> {
    const limit = filter.limit && filter.limit > 0 ? filter.limit : 50;
    const offset = filter.offset && filter.offset >= 0 ? filter.offset : 0;

    return this.items
      .filter((item) => item.tenantId === filter.tenantId)
      .filter((item) => (filter.branchId ? item.branchId === filter.branchId : true))
      .filter((item) => (filter.modelType ? item.modelType === filter.modelType : true))
      .filter((item) => (filter.status ? item.status.value === filter.status : true))
      .slice(offset, offset + limit);
  }
}
