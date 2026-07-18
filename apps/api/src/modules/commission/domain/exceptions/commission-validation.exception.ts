export class CommissionValidationException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommissionValidationException';
  }
}
