import { TokenPairVO } from './token-pair.vo';

export type LoginResult =
  | { kind: 'tokens'; tokens: TokenPairVO }
  | { kind: 'mfa_required'; mfaChallengeToken: string; mfaExpiresIn: number };
