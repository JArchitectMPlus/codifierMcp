/**
 * HTTP server implementation for MCP protocol
 * Supports both StreamableHTTP (modern) and SSE (legacy) transports
 */

import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../utils/logger.js';
import { createAuthMiddleware } from './auth-middleware.js';
import type { IDataStore } from '../datastore/interface.js';

export interface HttpServerConfig {
  port: number;
  apiAuthToken: string;
  dataStore?: IDataStore;
}

/**
 * Transport registry for managing MCP transport instances by session ID
 */
interface TransportRegistry {
  [sessionId: string]: StreamableHTTPServerTransport | SSEServerTransport;
}

/**
 * Start the HTTP server with MCP protocol support
 *
 * @param mcpServer - The MCP Server instance to expose over HTTP
 * @param config - HTTP server configuration
 */
export async function startHttpServer(
  mcpServer: Server,
  config: HttpServerConfig
): Promise<void> {
  const app = express();

  // Middleware setup
  app.use(express.json());

  // CORS configuration - expose MCP-specific headers
  app.use(
    cors({
      origin: '*',
      exposedHeaders: ['Mcp-Session-Id'],
    })
  );

  // Authentication middleware (skips /health endpoint)
  app.use(createAuthMiddleware({ apiAuthToken: config.apiAuthToken }));

  // Transport registry to track sessions
  const transports: TransportRegistry = {};

  // Health check endpoint (unauthenticated)
  app.get('/health', async (_req, res) => {
    logger.debug('Health check request received');
    if (config.dataStore) {
      try {
        const healthy = await config.dataStore.healthCheck();
        if (!healthy) {
          res.status(503).json({ status: 'unhealthy' });
          return;
        }
      } catch {
        res.status(503).json({ status: 'unhealthy' });
        return;
      }
    }
    res.status(200).json({ status: 'ok' });
  });

  //===========================================================================
  // STREAMABLE HTTP TRANSPORT (PROTOCOL VERSION 2025-03-26)
  // Modern transport supporting GET/POST/DELETE on single endpoint
  //===========================================================================

  app.all('/mcp', async (req, res) => {
    logger.debug('MCP request received', {
      method: req.method,
      sessionId: req.headers['mcp-session-id'],
    });

    try {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      let transport: StreamableHTTPServerTransport;

      // Check for existing session
      if (sessionId && transports[sessionId]) {
        const existingTransport = transports[sessionId];

        if (existingTransport instanceof StreamableHTTPServerTransport) {
          transport = existingTransport;
        } else {
          // Session exists but uses different transport (SSE)
          logger.warn('Session uses incompatible transport', { sessionId });
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Bad Request: Session uses a different transport protocol',
            },
            id: null,
          });
          return;
        }
      } else if (
        !sessionId &&
        req.method === 'POST' &&
        isInitializeRequest(req.body)
      ) {
        // Create new session for initialization request
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: async (newSessionId: string) => {
            logger.info('New MCP session initialized', { sessionId: newSessionId });
            transports[newSessionId] = transport;
          },
          onsessionclosed: async (closedSessionId: string) => {
            logger.info('MCP session closed', { sessionId: closedSessionId });
            delete transports[closedSessionId];
          },
        });

        await mcpServer.connect(transport);
        logger.debug('Connected new transport to MCP server');
      } else {
        // Invalid request - no session ID for non-initialization request
        logger.warn('Invalid request: missing session ID', {
          method: req.method,
          hasSessionId: !!sessionId,
          isInitialize: req.method === 'POST' && isInitializeRequest(req.body),
        });
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: Missing session ID',
          },
          id: null,
        });
        return;
      }

      // Handle the request with the transport
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      logger.error('Error handling MCP request', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
          },
          id: null,
        });
      }
    }
  });

  //===========================================================================
  // SSE TRANSPORT (LEGACY - PROTOCOL VERSION 2024-11-05)
  // Backward compatibility for older clients
  //===========================================================================

  app.get('/sse', async (req, res) => {
    logger.info('SSE connection request received (legacy transport)');

    try {
      const transport = new SSEServerTransport('/messages', res);
      const sessionId = transport.sessionId;

      transports[sessionId] = transport;
      logger.info('SSE session created', { sessionId });

      transport.onclose = () => {
        logger.info('SSE session closed', { sessionId });
        delete transports[sessionId];
      };

      await mcpServer.connect(transport);
      await transport.start();
    } catch (error) {
      logger.error('Error establishing SSE connection', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
          },
          id: null,
        });
      }
    }
  });

  app.post('/messages', async (req, res) => {
    logger.debug('SSE message received (legacy transport)');

    try {
      const sessionId = req.query.sessionId as string;

      if (!sessionId) {
        logger.warn('SSE message without session ID');
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: Missing sessionId query parameter',
          },
          id: null,
        });
        return;
      }

      const transport = transports[sessionId];

      if (!transport) {
        logger.warn('SSE message for unknown session', { sessionId });
        res.status(404).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Not Found: Session not found',
          },
          id: null,
        });
        return;
      }

      if (!(transport instanceof SSEServerTransport)) {
        logger.warn('SSE message for incompatible transport', { sessionId });
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: Session uses a different transport protocol',
          },
          id: null,
        });
        return;
      }

      await transport.handlePostMessage(req, res, req.body);
    } catch (error) {
      logger.error('Error handling SSE message', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
          },
          id: null,
        });
      }
    }
  });

  // Start listening
  return new Promise((resolve, reject) => {
    const server = app.listen(config.port, () => {
      logger.info('HTTP server started', {
        port: config.port,
        endpoints: {
          modern: '/mcp',
          legacy_sse: '/sse',
          legacy_messages: '/messages',
          health: '/health',
        },
      });
      resolve();
    });

    server.on('error', (error) => {
      logger.error('HTTP server error', {
        error: error.message,
        stack: error.stack,
      });
      reject(error);
    });
  });
}
