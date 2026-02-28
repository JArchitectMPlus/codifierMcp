/**
 * CodifierMcp - MCP Server Entry Point
 *
 * Institutional memory system for AI-driven development.
 * Provides fetch_context and update_memory tools via MCP protocol.
 */

import { getConfig } from './config/env.js';
import { logger } from './utils/logger.js';
import { CodifierError } from './utils/errors.js';
import { createDataStore } from './datastore/factory.js';
import { createMcpServer, initializeMcpServer, connectStdioTransport } from './mcp/server.js';
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

    if (config.TRANSPORT_MODE === 'stdio') {
      // stdio: single long-lived server connected to the process streams
      const server = await initializeMcpServer({
        name: 'codifier-mcp',
        version: '0.1.0',
        dataStore,
      });

      await connectStdioTransport(server);
      logger.info('CodifierMcp server is ready (stdio transport)');

      process.on('SIGINT', async () => {
        logger.info('Received SIGINT, shutting down gracefully');
        try {
          await server.close();
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
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown', error);
          process.exit(1);
        }
      });
    } else if (config.TRANSPORT_MODE === 'http') {
      // http: stateless — initialize datastore once, create a fresh MCP Server per request
      await dataStore.initialize();
      const isHealthy = await dataStore.healthCheck();
      if (!isHealthy) {
        throw new CodifierError('Data store health check failed');
      }
      logger.info('Data store initialized and healthy');

      const mcpConfig = { name: 'codifier-mcp', version: '0.1.0', dataStore };

      await startHttpServer({
        port: config.HTTP_PORT,
        apiAuthToken: config.API_AUTH_TOKEN!,
        dataStore,
        createServer: () => createMcpServer(mcpConfig),
      });
      logger.info('CodifierMcp server is ready (HTTP stateless transport)');

      process.on('SIGINT', () => {
        logger.info('Received SIGINT, shutting down');
        process.exit(0);
      });

      process.on('SIGTERM', () => {
        logger.info('Received SIGTERM, shutting down');
        process.exit(0);
      });
    }

    logger.info('Tools available: fetch_context, update_memory, manage_projects, pack_repo, query_data');
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
