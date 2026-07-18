export class AddressVO {
  constructor(
    public readonly line1: string,
    public readonly city: string,
    public readonly state: string | null = null,
    public readonly postalCode: string | null = null,
    public readonly country: string | null = 'US'
  ) {
    if (!line1 || !city) throw new Error('Invalid address');
  }

  get summary() {
    return `${this.line1}, ${this.city}${this.state ? ', ' + this.state : ''}`;
  }
}
