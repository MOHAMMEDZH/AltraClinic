import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * HTTP 429 with standard rate-limit response body.
 * Retry-After header is applied by ApiRateLimitExceptionFilter.
 */
export class ApiRateLimitExceededException extends HttpException {
  readonly retryAfterSeconds: number;
  readonly limit: number;
  readonly remaining: number;
  readonly resetAt: number;

  constructor(params: {
    retryAfterSeconds: number;
    limit: number;
    remaining: number;
    resetAt: number;
    scope: string;
    reason?: string;
  }) {
    super(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        code: 'API_RATE_LIMIT_EXCEEDED',
        message: params.reason ?? 'API rate limit exceeded. Please retry later.',
        scope: params.scope,
        limit: params.limit,
        remaining: params.remaining,
        resetAt: params.resetAt,
        retryAfterSeconds: params.retryAfterSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
    this.retryAfterSeconds = params.retryAfterSeconds;
    this.limit = params.limit;
    this.remaining = params.remaining;
    this.resetAt = params.resetAt;
  }
}
