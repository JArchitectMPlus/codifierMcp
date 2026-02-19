/**
 * AWS Athena MCP sidecar client
 *
 * Spawns aws-athena-mcp as a subprocess via StdioClientTransport and
 * delegates query operations to it. Connection is created per-call and torn
 * down immediately after to avoid keeping the Python process alive
 * between requests.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { logger } from '../utils/logger.js';
import { CodifierError } from '../utils/errors.js';

export type QueryOperation = 'list-tables' | 'describe-tables' | 'execute-query';

export interface QueryDataParams {
  operation: QueryOperation;
  query?: string;
  table_names?: string[];
}

/** Maximum response payload size from Athena (100 KB) */
const MAX_RESPONSE_BYTES = 100 * 1024;

export class AthenaClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;

  async connect(): Promise<void> {
    logger.info('Connecting to Athena MCP sidecar');

    this.transport = new StdioClientTransport({
      command: 'python3',
      args: ['-m', 'athena_mcp.server'],
      env: {
        ...process.env,
        AWS_REGION: process.env.AWS_REGION ?? '',
        AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ?? '',
        AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ?? '',
        ATHENA_S3_OUTPUT_LOCATION: process.env.ATHENA_S3_OUTPUT_LOCATION ?? '',
        ATHENA_WORKGROUP: process.env.ATHENA_WORKGROUP ?? 'primary',
        ATHENA_TIMEOUT_SECONDS: process.env.ATHENA_TIMEOUT_SECONDS ?? '60',
      },
    });

    this.client = new Client(
      { name: 'codifier-athena-client', version: '1.0.0' },
      { capabilities: {} }
    );

    await this.client.connect(this.transport);
    logger.info('Athena MCP sidecar connected');
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
      } catch (error) {
        logger.warn('Error closing Athena client', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
      this.client = null;
      this.transport = null;
    }
  }

  async listTables(): Promise<unknown> {
    this.assertConnected();
    logger.info('Listing Athena tables');

    const result = await this.client!.callTool({ name: 'list_tables', arguments: {} });
    return this.extractAndTruncate(result);
  }

  async describeTables(tableNames: string[]): Promise<unknown> {
    this.assertConnected();
    logger.info('Describing Athena tables', { tableNames });

    const result = await this.client!.callTool({
      name: 'describe_tables',
      arguments: { table_names: tableNames },
    });
    return this.extractAndTruncate(result);
  }

  async executeQuery(query: string): Promise<unknown> {
    this.assertConnected();

    // Enforce SELECT-only queries
    if (!query.trimStart().toLowerCase().startsWith('select')) {
      throw new CodifierError(
        'Only SELECT queries are permitted. Received: ' + query.slice(0, 100)
      );
    }

    logger.info('Executing Athena query', { query: query.slice(0, 200) });

    const result = await this.client!.callTool({
      name: 'execute_query',
      arguments: { query },
    });
    return this.extractAndTruncate(result);
  }

  private assertConnected(): void {
    if (!this.client) {
      throw new CodifierError('AthenaClient is not connected. Call connect() first.');
    }
  }

  private extractAndTruncate(result: unknown): unknown {
    // MCP tool responses wrap content in { content: [{ type, text }] }
    if (
      result &&
      typeof result === 'object' &&
      'content' in result &&
      Array.isArray((result as Record<string, unknown>).content)
    ) {
      const content = (result as Record<string, unknown[]>).content;
      const textItem = content.find(
        (item): item is { type: string; text: string } =>
          typeof item === 'object' &&
          item !== null &&
          (item as Record<string, unknown>).type === 'text'
      );

      if (textItem) {
        const text = textItem.text;
        if (Buffer.byteLength(text, 'utf-8') > MAX_RESPONSE_BYTES) {
          logger.warn('Athena response truncated', {
            originalBytes: Buffer.byteLength(text, 'utf-8'),
            limitBytes: MAX_RESPONSE_BYTES,
          });
          return text.slice(0, MAX_RESPONSE_BYTES) + '\n... [truncated]';
        }
        return text;
      }
    }

    const serialized = JSON.stringify(result);
    if (Buffer.byteLength(serialized, 'utf-8') > MAX_RESPONSE_BYTES) {
      logger.warn('Athena response truncated (JSON)');
      return serialized.slice(0, MAX_RESPONSE_BYTES) + '... [truncated]';
    }
    return result;
  }
}
