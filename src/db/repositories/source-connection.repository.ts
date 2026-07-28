import { prisma } from '../connection';

export interface SourceConnectionInput {
  id: string;
  source: string;
  accountExternalId: string;
}

export class SourceConnectionRepository {
  async ensureConnections(connections: SourceConnectionInput[]): Promise<void> {
    await prisma.$transaction(
      connections.map((connection) =>
        prisma.sourceConnection.upsert({
          where: { id: connection.id },
          update: {
            source: connection.source,
            accountExternalId: connection.accountExternalId,
            status: 'ACTIVE',
          },
          create: {
            ...connection,
            status: 'ACTIVE',
          },
        })
      )
    );
  }
}

export const sourceConnectionRepository = new SourceConnectionRepository();
