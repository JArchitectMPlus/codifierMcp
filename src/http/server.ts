/**
 * HTTP server implementation for MCP protocol
 * Supports both StreamableHTTP (stateless, modern) and SSE (legacy) transports
 */

import express from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { logger } from '../utils/logger.js';
import { createAuthMiddleware } from './auth-middleware.js';
import type { IDataStore } from '../datastore/interface.js';

export interface HttpServerConfig {
  port: number;
  apiAuthToken: string;
  dataStore?: IDataStore;
  /** Factory called once per POST /mcp request to produce a fresh Server instance */
  createServer: () => Server;
}

/**
 * Start the HTTP server with MCP protocol support
 *
 * @param config - HTTP server configuration including a createServer factory
 */
export async function startHttpServer(config: HttpServerConfig): Promise<void> {
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

  // SSE session registry (legacy transport only)
  const sseTransports: Record<string, SSEServerTransport> = {};

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
  // OAUTH DISCOVERY ENDPOINTS (unauthenticated — clients probe before connecting)
  // Required by MCP SDK 1.7+ which follows the 2025-03-26 spec
  //===========================================================================

  app.get('/.well-known/oauth-authorization-server', (_req, res) => {
    res.status(200).json({
      issuer: 'https://codifier-mcp.fly.dev',
      token_endpoint: 'https://codifier-mcp.fly.dev/token',
      response_types_supported: ['token'],
      grant_types_supported: ['urn:ietf:params:oauth:grant-type:token-exchange'],
    });
  });

  app.get('/.well-known/oauth-protected-resource', (_req, res) => {
    res.status(200).json({
      resource: 'https://codifier-mcp.fly.dev',
      bearer_methods_supported: ['header'],
    });
  });

  // Catch-all for other well-known subpaths (Express 5 requires named wildcard)
  app.get('/.well-known/*path', (_req, res) => {
    res.status(404).json({ error: 'not_found' });
  });

  //===========================================================================
  // STREAMABLE HTTP TRANSPORT — STATELESS (PROTOCOL VERSION 2025-03-26)
  //
  // Each POST creates a fresh Server + transport. No session registry.
  // This avoids the "missing session ID" error after Fly.io restarts, where
  // the in-memory registry was cleared but clients still held old session IDs.
  //===========================================================================

  app.post('/mcp', async (req, res) => {
    logger.debug('MCP request received', { method: 'POST' });

    try {
      const mcpServer = config.createServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless — no session tracking
      });

      // Clean up when the response stream closes
      res.on('close', () => {
        try {
          transport.close();
          mcpServer.close();
        } catch {
          // Swallow — server may not have fully initialized if connect() failed
        }
      });

      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      logger.error('Error handling MCP request', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  });

  // GET and DELETE are not applicable in stateless mode (no sessions to open/close)
  app.get('/mcp', (_req, res) => {
    res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method Not Allowed: use POST for stateless MCP requests' },
      id: null,
    });
  });

  app.delete('/mcp', (_req, res) => {
    res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method Not Allowed: no sessions in stateless mode' },
      id: null,
    });
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

      sseTransports[sessionId] = transport;
      logger.info('SSE session created', { sessionId });

      // Send a keepalive comment every 30s to prevent Fly.io proxy from
      // closing idle SSE connections (default idle timeout is ~60s)
      const keepalive = setInterval(() => {
        if (!res.writableEnded) {
          res.write(': keepalive\n\n');
        }
      }, 30_000);

      transport.onclose = () => {
        clearInterval(keepalive);
        logger.info('SSE session closed', { sessionId });
        delete sseTransports[sessionId];
      };

      const mcpServer = config.createServer();
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
          error: { code: -32603, message: 'Internal server error' },
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
          error: { code: -32000, message: 'Bad Request: Missing sessionId query parameter' },
          id: null,
        });
        return;
      }

      const transport = sseTransports[sessionId];

      if (!transport) {
        logger.warn('SSE message for unknown session', { sessionId });
        res.status(404).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Not Found: Session not found' },
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
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  });

  // Start listening
  return new Promise((resolve, reject) => {
    const server = app.listen(config.port, '0.0.0.0', () => {
      logger.info('HTTP server started', {
        port: config.port,
        endpoints: {
          modern: '/mcp (stateless POST)',
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
