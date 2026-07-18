/**
 * The response surface for a successful authentication.
 * Raw tokens are returned here — they must never be logged.
 */
export class TokenPairVO {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly accessExpiresIn: number;  // seconds
  readonly sessionId: string;

  constructor(props: {
    accessToken: string;
    refreshToken: string;
    accessExpiresIn: number;
    sessionId: string;
  }) {
    this.accessToken = props.accessToken;
    this.refreshToken = props.refreshToken;
    this.accessExpiresIn = props.accessExpiresIn;
    this.sessionId = props.sessionId;
  }
}
