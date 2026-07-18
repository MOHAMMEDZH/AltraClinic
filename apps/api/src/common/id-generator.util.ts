import { randomUUID } from 'crypto';

export function generateEntityId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}