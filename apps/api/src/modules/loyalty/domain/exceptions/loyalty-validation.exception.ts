export class LoyaltyValidationException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LoyaltyValidationException';
  }
}
