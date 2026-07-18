export class PatientNameVO {
  constructor(public readonly firstName: string, public readonly lastName: string) {
    if (!firstName || !lastName) throw new Error('Invalid name');
  }

  get fullName() {
    return `${this.firstName.trim()} ${this.lastName.trim()}`;
  }
}
