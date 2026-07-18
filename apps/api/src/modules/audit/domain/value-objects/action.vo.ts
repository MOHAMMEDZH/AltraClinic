export class ActionVO {
  constructor(public readonly value: string) {
    if (!value || !value.trim()) {
      throw new Error('Audit action is required');
    }
  }
}
