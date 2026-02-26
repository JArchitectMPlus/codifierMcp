/**
 * CodifierMcp - MCP Server Entry Point
 *
 * Institutional memory system for AI-driven development.
 * Provides fetch_context and update_memory tools via MCP protocol.
 */

import { getConfig } from './config/env.js';
import { logger } from './utils/logger.js';
import { createDataStore } from './datastore/factory.js';
import { initializeMcpServer, connectStdioTransport } from './mcp/server.js';
import { startHttpServer } from './http/server.js';

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    logger.info('Starting CodifierMcp server');

    // Load and validate configuration
    const config = getConfig();
    logger.info('Configuration loaded', {
      dataStore: config.DATA_STORE,
      transportMode: config.TRANSPORT_MODE,
      httpPort: config.TRANSPORT_MODE === 'http' ? config.HTTP_PORT : undefined,
      logLevel: config.LOG_LEVEL,
    });

    // Create data store instance via factory
    const dataStore = createDataStore(config);
    logger.debug('Data store instance created', { backend: config.DATA_STORE });

    // Initialize MCP server (transport-agnostic)
    const server = await initializeMcpServer({
      name: 'codifier-mcp',
      version: '0.1.0',
      dataStore,
    });

    // Connect appropriate transport based on configuration
    if (config.TRANSPORT_MODE === 'stdio') {
      logger.info('Starting server in stdio mode');
      await connectStdioTransport(server);
      logger.info('CodifierMcp server is ready (stdio transport)');
    } else if (config.TRANSPORT_MODE === 'http') {
      logger.info('Starting server in HTTP mode');
      await startHttpServer(server, {
        port: config.HTTP_PORT,
        apiAuthToken: config.API_AUTH_TOKEN!,
        dataStore,
      });
      logger.info('CodifierMcp server is ready (HTTP transport)');
    }

    logger.info('Tools available: fetch_context, update_memory, manage_projects, pack_repo, query_data');

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully');
      try {
        await server.close();
        logger.info('Server closed successfully');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', error);
        process.exit(1);
      }
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully');
      try {
        await server.close();
        logger.info('Server closed successfully');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', error);
        process.exit(1);
      }
    });
  } catch (error) {
    logger.error('Fatal error during startup', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

// Start the server
main();
