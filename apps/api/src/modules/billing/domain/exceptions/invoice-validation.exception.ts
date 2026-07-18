export class InvoiceValidationException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvoiceValidationException';
  }
}
