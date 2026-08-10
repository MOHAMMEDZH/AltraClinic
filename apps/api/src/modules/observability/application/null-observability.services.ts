import { Injectable } from '@nestjs/common';
import type {
  AlertEvaluatorService,
  CorrelationService,
  HealthAggregatorService,
  LoggingPipelineService,
  MetricsPipelineService,
  RedactionService,
  TracingService,
} from './ports/services';
import type {
  AlertStateStorePort,
  LogStorePort,
  MetricsStorePort,
  TraceStorePort,
} from './ports/storage.port';
import type {
  LogsExportPort,
  MetricsExportPort,
  TracesExportPort,
} from './ports/export.port';
import type { PlatformHealthReport } from '../domain/health.types';

@Injectable()
export class NullMetricsPipelineService implements MetricsPipelineService {
  readonly contractVersion = '45a' as const;
  isActive(): boolean {
    return false;
  }
}

@Injectable()
export class NullLoggingPipelineService implements LoggingPipelineService {
  readonly contractVersion = '45a' as const;
  isActive(): boolean {
    return false;
  }
}

@Injectable()
export class NullCorrelationService implements CorrelationService {
  readonly contractVersion = '45a' as const;
  isActive(): boolean {
    return false;
  }
}

@Injectable()
export class NullTracingService implements TracingService {
  readonly contractVersion = '45a' as const;
  isActive(): boolean {
    return false;
  }
}

@Injectable()
export class NullHealthAggregatorService implements HealthAggregatorService {
  readonly contractVersion = '45a' as const;
  async live(): Promise<PlatformHealthReport> {
    return emptyHealth();
  }
  async ready(): Promise<PlatformHealthReport> {
    return emptyHealth();
  }
  async overall(): Promise<PlatformHealthReport> {
    return emptyHealth();
  }
}

@Injectable()
export class NullAlertEvaluatorService implements AlertEvaluatorService {
  readonly contractVersion = '45a' as const;
}

@Injectable()
export class NullRedactionService implements RedactionService {
  readonly contractVersion = '45a' as const;
}

@Injectable()
export class NullMetricsStore implements MetricsStorePort {
  readonly contractVersion = '45a' as const;
  readonly providerKind = 'null' as const;
}

@Injectable()
export class NullLogStore implements LogStorePort {
  readonly contractVersion = '45a' as const;
  readonly providerKind = 'null' as const;
}

@Injectable()
export class NullTraceStore implements TraceStorePort {
  readonly contractVersion = '45a' as const;
  readonly providerKind = 'null' as const;
}

@Injectable()
export class NullAlertStateStore implements AlertStateStorePort {
  readonly contractVersion = '45a' as const;
  readonly providerKind = 'null' as const;
}

@Injectable()
export class NullMetricsExport implements MetricsExportPort {
  readonly contractVersion = '45a' as const;
  readonly providerKind = 'null' as const;
  readonly reservedPath = '/metrics' as const;
  renderText(): string {
    return '# null metrics export\n';
  }
}

@Injectable()
export class NullLogsExport implements LogsExportPort {
  readonly contractVersion = '45a' as const;
  readonly providerKind = 'null' as const;
  renderNdjson(): string {
    return '';
  }
}

@Injectable()
export class NullTracesExport implements TracesExportPort {
  readonly contractVersion = '45a' as const;
  readonly providerKind = 'null' as const;
  renderJson(): string {
    return '[]';
  }
}

function emptyHealth(): PlatformHealthReport {
  const checkedAt = new Date().toISOString();
  return {
    status: 'dormant',
    live: true,
    ready: true,
    dormant: true,
    featureFlag: {
      name: 'SYSTEM_MONITORING_OBSERVABILITY_ENABLED',
      enabled: false,
    },
    contributors: [],
    summary: { healthy: 0, degraded: 0, dormant: 0, unhealthy: 0 },
    phase: '45d',
    checkedAt,
  };
}
