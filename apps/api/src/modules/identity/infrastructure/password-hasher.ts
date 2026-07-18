import bcrypt from 'bcryptjs';

/**
 * Cost factor 12 provides ~300ms hash time on modern hardware.
 * OWASP recommends >= 10; 12 is the 2025 practical baseline.
 * Increase to 13–14 when hardware budget allows.
 */
const BCRYPT_ROUNDS = 12;

/**
 * Pre-formatted bcrypt hash used for timing equalization on user-not-found paths.
 * This is a syntactically valid bcrypt hash that bcrypt will fully compute against
 * before returning false — preventing timing oracles that reveal whether an email
 * exists in the database.
 *
 * This hash was generated once offline at rounds=12.
 * The value being public does NOT weaken security — it is never stored or compared
 * against real passwords; its only purpose is to consume the same CPU time as a
 * real bcrypt compare.
 */
const TIMING_DUMMY_HASH = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtgD6Q53HVFmBmXD2/ZJlkqfXcHe';

export class PasswordHasher {
  static async hash(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
    return bcrypt.hash(password, salt);
  }

  static async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Perform a dummy bcrypt compare against a pre-computed hash to equalize timing
   * on code paths where the user does not exist.
   * Call this whenever you return early due to "user not found" to prevent
   * timing-based user enumeration.
   */
  static async timingDummyCompare(candidatePassword: string): Promise<void> {
    await bcrypt.compare(candidatePassword, TIMING_DUMMY_HASH);
  }
}
