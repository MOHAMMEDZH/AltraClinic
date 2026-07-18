export class InventoryValidationException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InventoryValidationException';
  }
}
