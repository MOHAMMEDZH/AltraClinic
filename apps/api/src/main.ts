import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ApiRateLimitExceptionFilter } from './common/filters/api-rate-limit-exception.filter';
import { getAllowedSuperAdminOrigins } from './modules/auth/api/platform-auth-cookies';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new ApiRateLimitExceptionFilter());

  const baseCorsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const corsOrigins = [...new Set([...baseCorsOrigins, ...getAllowedSuperAdminOrigins()])];

  if (corsOrigins.includes('*')) {
    throw new Error('CORS_ORIGINS must not include wildcard (*) when credentials are enabled.');
  }

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-tenant-id',
      'x-platform-csrf',
      'X-Platform-CSRF',
    ],
  });

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
