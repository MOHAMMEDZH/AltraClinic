import { ValueObject } from '../../common/value-object.base';

export abstract class BaseValueObject<T extends Record<string, unknown> = Record<string, unknown>> extends ValueObject<T> {}
