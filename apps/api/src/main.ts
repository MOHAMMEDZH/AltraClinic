import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ApiRateLimitExceptionFilter } from './common/filters/api-rate-limit-exception.filter';
import { getAllowedHttpCorsOrigins } from './common/security/cors-origins';
import { securityHeadersMiddleware } from './common/security/security-headers.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }));
  app.useGlobalFilters(new ApiRateLimitExceptionFilter());
  app.use(securityHeadersMiddleware);

  const corsOrigins = getAllowedHttpCorsOrigins();

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-tenant-id',
      'x-platform-csrf',
      'X-Platform-CSRF',
      'Idempotency-Key',
      'If-Match',
    ],
  });

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
