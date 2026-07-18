export class AuditEntryValidationException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuditEntryValidationException';
  }
}
