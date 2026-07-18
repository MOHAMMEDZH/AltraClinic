import { Entity } from '../../common/entity.base';

export abstract class AggregateRoot<T extends Record<string, unknown> = Record<string, unknown>> extends Entity<T> {}
