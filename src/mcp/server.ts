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
import { ContextService } from '../services/context-service.js';
import { MemoryService } from '../services/memory-service.js';
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

  // Initialize service layers
  const contextService = new ContextService(config.dataStore);
  const memoryService = new MemoryService(config.dataStore);

  logger.debug('Service layers instantiated', {
    services: ['ContextService', 'MemoryService'],
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
          return await handleFetchContext(args, contextService);

        case 'update_memory':
          return await handleUpdateMemory(args, memoryService);

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
 * Connect the MCP server to stdio transport
 *
 * @param server - MCP server instance
 * @throws {CodifierError} If transport connection fails
 */
export async function connectStdioTransport(server: Server): Promise<void> {
  try {
    logger.info('Connecting MCP server to stdio transport');

    const transport = new StdioServerTransport();
    await server.connect(transport);

    logger.info('MCP server connected to stdio transport successfully');
    logger.info('Listening for MCP protocol messages on stdio');
  } catch (error) {
    logger.error('Failed to connect stdio transport', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw new CodifierError(
      `Failed to connect stdio transport: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Initialize the MCP server and data store (transport-agnostic)
 *
 * @param config - Server configuration
 * @returns Configured server instance (not yet connected to transport)
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

  // Create server (without connecting to transport)
  const server = createMcpServer(config);

  return server;
}
