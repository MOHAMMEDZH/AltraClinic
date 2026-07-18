import { AiDomainError } from '../exceptions/ai-domain.exception';

export const AI_MODEL_STATUSES = ['draft', 'validated', 'deployed', 'retired'] as const;

export type AiModelStatus = (typeof AI_MODEL_STATUSES)[number];

export class AiModelStatusVO {
  constructor(public readonly value: AiModelStatus) {
    if (!(AI_MODEL_STATUSES as readonly string[]).includes(value)) {
      throw new AiDomainError(`AI model status '${value}' is invalid`);
    }
  }
}
