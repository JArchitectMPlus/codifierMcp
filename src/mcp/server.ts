/**
 * MCP Server implementation for CodifierMcp (v2.0)
 *
 * Transport-agnostic server that registers all 5 MCP tools and
 * delegates to the IDataStore abstraction for persistence.
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
import { ManageProjectsTool, handleManageProjects } from './tools/manage-projects.js';
import { PackRepoTool, handlePackRepo } from './tools/pack-repo.js';
import { QueryDataTool, handleQueryData } from './tools/query-data.js';

export interface McpServerConfig {
  name: string;
  version: string;
  dataStore: IDataStore;
}

export function createMcpServer(config: McpServerConfig): Server {
  logger.info('Creating MCP server', {
    name: config.name,
    version: config.version,
  });

  const server = new Server(
    { name: config.name, version: config.version },
    { capabilities: { tools: {} } }
  );

  const allTools = [
    FetchContextTool,
    UpdateMemoryTool,
    ManageProjectsTool,
    PackRepoTool,
    QueryDataTool,
  ];

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    logger.debug('ListTools request received');
    return { tools: allTools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    logger.debug('CallTool request received', { toolName: name });

    try {
      switch (name) {
        case 'fetch_context':
          return await handleFetchContext(args, config.dataStore);

        case 'update_memory':
          return await handleUpdateMemory(args, config.dataStore);

        case 'manage_projects':
          return await handleManageProjects(args, config.dataStore);

        case 'pack_repo':
          return await handlePackRepo(args, config.dataStore);

        case 'query_data':
          return await handleQueryData(args, config.dataStore);

        default:
          throw new CodifierError(`Unknown tool: ${name}`);
      }
    } catch (error) {
      logger.error('Tool execution failed', {
        toolName: name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

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

export async function connectStdioTransport(server: Server): Promise<void> {
  try {
    logger.info('Connecting MCP server to stdio transport');
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info('MCP server connected to stdio transport successfully');
  } catch (error) {
    logger.error('Failed to connect stdio transport', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw new CodifierError(
      `Failed to connect stdio transport: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export async function initializeMcpServer(config: McpServerConfig): Promise<Server> {
  logger.info('Initializing MCP server');

  await config.dataStore.initialize();

  const isHealthy = await config.dataStore.healthCheck();
  if (!isHealthy) {
    throw new CodifierError('Data store health check failed');
  }

  logger.info('Data store initialized and healthy');

  return createMcpServer(config);
}
