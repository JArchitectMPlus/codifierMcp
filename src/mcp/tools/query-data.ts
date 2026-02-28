/**
 * query_data MCP tool implementation
 */

import { z } from 'zod';
import { QueryDataParamsSchema, type QueryDataParams } from '../schemas.js';
import { logger } from '../../utils/logger.js';
import { McpToolError } from '../../utils/errors.js';
import type { IDataStore } from '../../datastore/interface.js';
import { AthenaClient } from '../../integrations/athena.js';
import { getConfig } from '../../config/env.js';

export const QueryDataTool = {
  name: 'query_data',
  description:
    'Query AWS Athena for schema discovery and data analysis. ' +
    'Use "list-tables" to see available tables, "describe-tables" for schema details, ' +
    'or "execute-query" to run a SELECT statement. Only SELECT queries are permitted.',
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['list-tables', 'describe-tables', 'execute-query'],
        description: 'Athena operation to perform',
      },
      project_id: {
        type: 'string',
        description: 'Project UUID for session scoping',
      },
      database: {
        type: 'string',
        description: 'Athena database/catalog name — overrides the ATHENA_DATABASE env var',
      },
      query: {
        type: 'string',
        description: 'SQL SELECT query — required for "execute-query"',
      },
      table_names: {
        type: 'array',
        items: { type: 'string' },
        description: 'Table names — required for "describe-tables"',
      },
    },
    required: ['operation', 'project_id'],
  },
} as const;

export async function handleQueryData(
  params: unknown,
  dataStore: IDataStore
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const athena = new AthenaClient();

  try {
    logger.debug('query_data called', params);

    const validated: QueryDataParams = QueryDataParamsSchema.parse(params);

    // Validate operation-specific required fields
    if (validated.operation === 'execute-query' && !validated.query) {
      throw new McpToolError(
        'Parameter "query" is required for the "execute-query" operation',
        'query_data'
      );
    }
    if (validated.operation === 'describe-tables' && (!validated.table_names || validated.table_names.length === 0)) {
      throw new McpToolError(
        'Parameter "table_names" is required for the "describe-tables" operation',
        'query_data'
      );
    }

    logger.info('Executing Athena operation', {
      operation: validated.operation,
      project_id: validated.project_id,
    });

    await athena.connect();

    const database = validated.database ?? getConfig().ATHENA_DATABASE;
    let operationResult: unknown;

    switch (validated.operation) {
      case 'list-tables':
        operationResult = await athena.listTables(database);
        break;

      case 'describe-tables':
        operationResult = await athena.describeTables(validated.table_names!, database);
        break;

      case 'execute-query':
        operationResult = await athena.executeQuery(validated.query!, database);
        break;
    }

    await athena.disconnect();

    logger.info('Athena operation completed', { operation: validated.operation });

    const resultText = typeof operationResult === 'string'
      ? operationResult
      : JSON.stringify(operationResult, null, 2);

    return {
      content: [
        {
          type: 'text',
          text:
            `# Athena Query Result\n\n` +
            `**Operation:** ${validated.operation}\n` +
            `**Project:** ${validated.project_id}\n\n` +
            `---\n\n` +
            resultText,
        },
      ],
    };
  } catch (error) {
    // Always attempt to disconnect on failure
    await athena.disconnect().catch((disconnectError) => {
      logger.warn('Failed to disconnect Athena client during error handling', {
        error: disconnectError instanceof Error ? disconnectError.message : 'Unknown error',
      });
    });

    logger.error('Failed to query data', { error });

    if (error instanceof z.ZodError) {
      throw new McpToolError(
        `Invalid parameters for query_data: ${error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        'query_data',
        error
      );
    }

    if (error instanceof McpToolError) throw error;

    throw new McpToolError(
      `Failed to query data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'query_data',
      error instanceof Error ? error : undefined
    );
  }
}
