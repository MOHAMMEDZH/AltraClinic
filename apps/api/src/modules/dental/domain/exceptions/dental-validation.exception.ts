export class DentalValidationException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DentalValidationException';
  }
}
