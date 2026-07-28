import { FastifyInstance } from 'fastify';
import { adminAuthGuard, demoModeGuard } from '../security/admin-auth';
import { syncOrchestrator } from '../sync/orchestrator';
import { syncRunRepository } from '../db/repositories/sync-run.repository';
import { externalRecordRepository } from '../db/repositories/external-record.repository';
import { SourceType } from '../sync/types';
import { getLogger } from '../observability/logger';

const logger = getLogger('sync-routes');

export async function registerSyncRoutes(app: FastifyInstance) {
  /**
   * POST /api/v1/sync - Trigger full sync of all sources
   */
  app.post('/api/v1/sync', { preHandler: adminAuthGuard }, async (request, reply) => {
    try {
      const idempotencyKey = request.headers['idempotency-key'] as string | undefined;

      logger.info({ idempotencyKey }, 'Sync requested');

      // For now, create connections for all sources (in production, would query DB)
      const connectionIds = new Map<SourceType, string>([
        ['HUBSPOT', 'hubspot-connection-1'],
        ['STRIPE', 'stripe-connection-1'],
        ['GOOGLE_CALENDAR', 'google-calendar-connection-1'],
      ]);

      const runId = await syncOrchestrator.triggerSync(connectionIds);

      return reply.code(202).send({
        status: 'accepted',
        runId,
        idempotencyKey,
        message: 'Sync run initiated',
      });
    } catch (error) {
      logger.error({ error }, 'Sync trigger failed');
      return reply.code(500).send({
        error: 'Sync failed',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /api/v1/sync-runs - List recent sync runs
   */
  app.get('/api/v1/sync-runs', { preHandler: adminAuthGuard }, async (request, reply) => {
    try {
      const limitParam = (request.query as any)?.limit || '20';
      const limit = Math.min(parseInt(limitParam as string) || 20, 100);
      const runs = await syncRunRepository.getRecentSyncRuns(limit);

      return reply.code(200).send({
        count: runs.length,
        runs: runs.map((run) => ({
          id: run.id,
          correlationId: run.correlationId,
          status: run.status,
          triggerType: run.triggerType,
          startedAt: run.startedAt,
          finishedAt: run.finishedAt,
          summary: run.summary,
        })),
      });
    } catch (error) {
      logger.error({ error }, 'Failed to list sync runs');
      return reply.code(500).send({
        error: 'Failed to list sync runs',
      });
    }
  });

  /**
   * GET /api/v1/sync-runs/:runId - Get sync run details
   */
  app.get('/api/v1/sync-runs/:runId', { preHandler: adminAuthGuard }, async (request, reply) => {
    try {
      const { runId } = request.params as { runId: string };
      const run = await syncRunRepository.getSyncRun(runId);

      if (!run) {
        return reply.code(404).send({
          error: 'Not found',
          message: `Sync run ${runId} not found`,
        });
      }

      const sourceSyncRuns = await syncRunRepository.getSyncRunSources(runId);

      return reply.code(200).send({
        id: run.id,
        correlationId: run.correlationId,
        status: run.status,
        triggerType: run.triggerType,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        requestedBy: run.requestedBy,
        summary: run.summary,
        sources: sourceSyncRuns?.map((s) => ({
          id: s.id,
          source: s.source,
          mode: s.mode,
          status: s.status,
          recordCount: s.recordCount,
          errorMessage: s.errorMessage,
          startedAt: s.startedAt,
          finishedAt: s.finishedAt,
        })),
      });
    } catch (error) {
      logger.error({ error }, 'Failed to get sync run');
      return reply.code(500).send({
        error: 'Failed to get sync run',
      });
    }
  });

  /**
   * GET /api/v1/records - Inspect normalized records
   */
  app.get('/api/v1/records', { preHandler: adminAuthGuard }, async (request, reply) => {
    try {
      const { source, type, externalId } = request.query as {
        source?: string;
        type?: string;
        externalId?: string;
      };

      if (externalId && source && type) {
        const record = await externalRecordRepository.getExternalRecord(
          'default-connection-id',
          type,
          externalId
        );

        if (!record) {
          return reply.code(404).send({
            error: 'Not found',
          });
        }

        return reply.code(200).send({
          record: {
            id: record.id,
            objectType: record.objectType,
            externalId: record.externalId,
            data: record.data,
            syncedAt: record.syncedAt,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
          },
        });
      }

      return reply.code(400).send({
        error: 'Bad request',
        message: 'Must specify source, type, and externalId',
      });
    } catch (error) {
      logger.error({ error }, 'Failed to inspect records');
      return reply.code(500).send({
        error: 'Failed to inspect records',
      });
    }
  });
}
