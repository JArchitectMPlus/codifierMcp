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

  async listTables(database: string): Promise<unknown> {
    this.assertConnected();
    logger.info('Listing Athena tables', { database });

    const result = await this.client!.callTool({ name: 'list_tables', arguments: { database } });
    return this.extractAndTruncate(result);
  }

  async describeTables(tableNames: string[], database: string): Promise<unknown> {
    this.assertConnected();
    logger.info('Describing Athena tables', { tableNames, database });

    // Server exposes describe_table (singular) — call once per table and merge
    const results: unknown[] = [];
    for (const tableName of tableNames) {
      const result = await this.client!.callTool({
        name: 'describe_table',
        arguments: { table_name: tableName, database },
      });
      results.push(this.extractAndTruncate(result));
    }
    return results.length === 1 ? results[0] : results;
  }

  async executeQuery(query: string, database: string): Promise<unknown> {
    this.assertConnected();

    // Enforce SELECT-only queries
    if (!query.trimStart().toLowerCase().startsWith('select')) {
      throw new CodifierError(
        'Only SELECT queries are permitted. Received: ' + query.slice(0, 100)
      );
    }

    logger.info('Executing Athena query', { query: query.slice(0, 200), database });

    // Server uses run_query → poll get_status → get_result
    const runResult = await this.client!.callTool({
      name: 'run_query',
      arguments: { query, database },
    });

    const runText = this.extractAndTruncate(runResult);

    // Extract query execution ID from response
    let queryId: string | undefined;
    if (typeof runText === 'string') {
      const match = runText.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
      if (match) queryId = match[1];
    } else if (runText && typeof runText === 'object') {
      queryId = (runText as Record<string, unknown>).query_execution_id as string;
    }

    if (!queryId) {
      // run_query returned results directly (no async execution ID)
      return runText;
    }

    // Poll get_status until SUCCEEDED or terminal state
    const maxAttempts = 30;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const statusResult = await this.client!.callTool({
        name: 'get_status',
        arguments: { query_execution_id: queryId },
      });
      const statusText = String(this.extractAndTruncate(statusResult) ?? '');
      logger.debug('Athena query status', { queryId, statusText });

      if (statusText.includes('SUCCEEDED')) break;
      if (statusText.includes('FAILED') || statusText.includes('CANCELLED')) {
        throw new CodifierError(`Athena query failed: ${statusText}`);
      }
    }

    const resultResponse = await this.client!.callTool({
      name: 'get_result',
      arguments: { query_execution_id: queryId },
    });
    return this.extractAndTruncate(resultResponse);
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
