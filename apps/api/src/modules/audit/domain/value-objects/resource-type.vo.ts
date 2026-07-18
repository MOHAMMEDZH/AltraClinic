export class ResourceTypeVO {
  constructor(public readonly value: string) {
    if (!value || !value.trim()) {
      throw new Error('Audit resource type is required');
    }
  }
}
