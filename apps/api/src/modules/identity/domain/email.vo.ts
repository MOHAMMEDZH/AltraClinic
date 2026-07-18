export class EmailVO {
  public readonly value: string;

  constructor(email: string) {
    const normalized = (email || '').trim().toLowerCase();
    if (!EmailVO.isValid(normalized)) {
      throw new Error('Invalid email format');
    }
    this.value = normalized;
  }

  public static isValid(email: string): boolean {
    // Simple RFC-like check (not exhaustive)
    return /^\S+@\S+\.\S+$/.test(email);
  }
}
