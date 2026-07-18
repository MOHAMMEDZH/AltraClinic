import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiRateLimitExceededException } from '../../modules/subscription/domain/exceptions/api-rate-limit-exceeded.exception';
import { RateLimitExceededException } from '../../modules/auth/domain/exceptions/auth.exceptions';

@Catch(ApiRateLimitExceededException, RateLimitExceededException)
export class ApiRateLimitExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const body = exception.getResponse();

    const retryAfter =
      exception instanceof ApiRateLimitExceededException
        ? exception.retryAfterSeconds
        : (exception as RateLimitExceededException).retryAfterSeconds;

    if (exception instanceof ApiRateLimitExceededException) {
      response.setHeader('X-RateLimit-Limit', String(exception.limit));
      response.setHeader('X-RateLimit-Remaining', String(exception.remaining));
      response.setHeader('X-RateLimit-Reset', String(exception.resetAt));
    }

    response.setHeader('Retry-After', String(retryAfter));
    response.status(status).json(body);
  }
}
