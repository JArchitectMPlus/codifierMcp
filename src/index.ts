/**
 * CodifierMcp - MCP Server Entry Point
 *
 * Institutional memory system for AI-driven development.
 * Provides fetch_context and update_memory tools via MCP protocol.
 */

import { getConfig } from './config/env.js';
import { logger } from './utils/logger.js';
import { AtlassianDataStore } from './datastore/atlassian-datastore.js';
import { initializeMcpServer } from './mcp/server.js';

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    logger.info('Starting CodifierMcp server');

    // Load and validate configuration
    const config = getConfig();
    logger.info('Configuration loaded', {
      baseUrl: config.CONFLUENCE_BASE_URL,
      username: config.CONFLUENCE_USERNAME,
      spaceKey: config.CONFLUENCE_SPACE_KEY,
      rulesPage: config.RULES_PAGE_TITLE,
      insightsParentPage: config.INSIGHTS_PARENT_PAGE_TITLE,
      logLevel: config.LOG_LEVEL,
    });

    // Create data store instance with Confluence authentication
    const dataStore = new AtlassianDataStore({
      baseUrl: config.CONFLUENCE_BASE_URL,
      username: config.CONFLUENCE_USERNAME,
      apiToken: config.CONFLUENCE_API_TOKEN,
      spaceKey: config.CONFLUENCE_SPACE_KEY,
      rulesPageTitle: config.RULES_PAGE_TITLE,
      insightsParentPageTitle: config.INSIGHTS_PARENT_PAGE_TITLE,
    });
    logger.debug('Data store instance created');

    // Initialize and start MCP server
    const server = await initializeMcpServer({
      name: 'codifier-mcp',
      version: '0.1.0',
      dataStore,
    });

    logger.info('CodifierMcp server is ready');
    logger.info('Tools available: fetch_context, update_memory');

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
