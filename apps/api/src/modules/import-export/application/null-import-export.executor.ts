import { Injectable, Logger } from '@nestjs/common';
import type { ImportExportJob } from '../domain/job/import-export-job.types';
import { IMPORT_EXPORT_LOG_KIND } from '../import-export.constants';

export interface NullExecutorResult {
  success: boolean;
  executor: 'NullImportExportExecutor';
  warnings: string[];
  error?: string;
  durationMs: number;
}

/**
 * Phase 42c — Null Executor.
 * Accepts job, sleeps minimally, returns success.
 * Never parses files, never calls adapters, never touches domain SoR.
 */
@Injectable()
export class NullImportExportExecutor {
  private readonly logger = new Logger(NullImportExportExecutor.name);
  private executions = 0;

  getExecutionCount(): number {
    return this.executions;
  }

  async execute(job: ImportExportJob): Promise<NullExecutorResult> {
    const started = Date.now();
    this.executions += 1;

    this.logger.log(
      JSON.stringify({
        kind: IMPORT_EXPORT_LOG_KIND,
        component: 'null_executor',
        event: 'accepted',
        jobId: job.id,
        tenantId: job.tenantId,
        typeId: job.typeId,
        direction: job.direction,
        correlationId: job.correlationId,
        attemptCount: job.attemptCount,
      }),
    );

    await sleep(5);

    if (job.metadata?.forceFailOnce === true && job.attemptCount <= 1) {
      const durationMs = Date.now() - started;
      this.logger.warn(
        JSON.stringify({
          kind: IMPORT_EXPORT_LOG_KIND,
          component: 'null_executor',
          event: 'forced_failure',
          jobId: job.id,
          correlationId: job.correlationId,
          durationMs,
        }),
      );
      return {
        success: false,
        executor: 'NullImportExportExecutor',
        warnings: [],
        error: 'forced_null_executor_failure',
        durationMs,
      };
    }

    const durationMs = Date.now() - started;
    this.logger.log(
      JSON.stringify({
        kind: IMPORT_EXPORT_LOG_KIND,
        component: 'null_executor',
        event: 'completed',
        jobId: job.id,
        correlationId: job.correlationId,
        durationMs,
        businessWork: false,
        adaptersInvoked: false,
      }),
    );

    return {
      success: true,
      executor: 'NullImportExportExecutor',
      warnings: [],
      durationMs,
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
