/**
 * MCP Server implementation for CodifierMcp
 *
 * Provides institutional memory capabilities via MCP protocol.
 * Uses stdio transport for communication with MCP clients.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../utils/logger.js';
import { CodifierError } from '../utils/errors.js';
import type { IDataStore } from '../datastore/interface.js';
import { FetchContextTool, handleFetchContext } from './tools/fetch-context.js';
import { UpdateMemoryTool, handleUpdateMemory } from './tools/update-memory.js';

/**
 * MCP Server configuration
 */
export interface McpServerConfig {
  name: string;
  version: string;
  dataStore: IDataStore;
}

/**
 * Create and configure the MCP server
 *
 * @param config - Server configuration including name, version, and data store
 * @returns Configured MCP server instance
 */
export function createMcpServer(config: McpServerConfig): Server {
  logger.info('Creating MCP server', {
    name: config.name,
    version: config.version,
  });

  const server = new Server(
    {
      name: config.name,
      version: config.version,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register ListTools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    logger.debug('ListTools request received');

    return {
      tools: [FetchContextTool, UpdateMemoryTool],
    };
  });

  // Register CallTool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    logger.debug('CallTool request received', {
      toolName: request.params.name,
    });

    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'fetch_context':
          return await handleFetchContext(args, config.dataStore);

        case 'update_memory':
          return await handleUpdateMemory(args, config.dataStore);

        default:
          throw new CodifierError(`Unknown tool: ${name}`);
      }
    } catch (error) {
      logger.error('Tool execution failed', {
        toolName: name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Return error as tool response (MCP protocol expects this format)
      return {
        content: [
          {
            type: 'text',
            text: `Error executing ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  });

  logger.info('MCP server created successfully');
  return server;
}

/**
 * Start the MCP server with stdio transport
 *
 * @param server - MCP server instance
 * @throws {CodifierError} If server fails to start
 */
export async function startMcpServer(server: Server): Promise<void> {
  try {
    logger.info('Starting MCP server with stdio transport');

    const transport = new StdioServerTransport();
    await server.connect(transport);

    logger.info('MCP server started successfully');
    logger.info('Listening for MCP protocol messages on stdio');
  } catch (error) {
    logger.error('Failed to start MCP server', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw new CodifierError(
      `Failed to start MCP server: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Initialize and start the MCP server
 *
 * @param config - Server configuration
 * @returns Running server instance
 */
export async function initializeMcpServer(config: McpServerConfig): Promise<Server> {
  logger.info('Initializing MCP server');

  // Initialize data store
  logger.debug('Initializing data store');
  await config.dataStore.initialize();

  // Health check
  const isHealthy = await config.dataStore.healthCheck();
  if (!isHealthy) {
    throw new CodifierError('Data store health check failed');
  }
  logger.info('Data store initialized and healthy');

  // Create and start server
  const server = createMcpServer(config);
  await startMcpServer(server);

  return server;
}
