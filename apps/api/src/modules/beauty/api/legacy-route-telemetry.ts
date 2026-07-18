import { Logger } from '@nestjs/common';

const logger = new Logger('BeautyLegacyRoutes');

/** Structured warning emitted when a deprecated /beauty/service route is invoked. */
export function logDeprecatedBeautyRoute(input: {
  method: string;
  path: string;
  replacement: string;
  tenantId?: string;
  userId?: string;
}): void {
  logger.warn(
    JSON.stringify({
      event: 'deprecated_api_usage',
      module: 'beauty',
      severity: 'warning',
      method: input.method,
      path: input.path,
      replacement: input.replacement,
      tenantId: input.tenantId ?? null,
      userId: input.userId ?? null,
      removalPhase: 'phase-3',
    }),
  );
}
