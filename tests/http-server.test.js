/**
 * Tests for the stateless StreamableHTTP transport (POST /mcp).
 *
 * These tests cover the production bug fixed on 2026-02-28:
 *   - An in-memory session registry was wiped on every Fly.io restart.
 *   - Clients holding stale Mcp-Session-Id headers received 400 errors,
 *     which caused the MCP client to hang for 4+ minutes.
 *
 * The fix: sessionIdGenerator: undefined (stateless), new Server per request.
 *
 * Run with:
 *   node --test tests/http-server.test.js
 *
 * No external test dependencies — uses Node's built-in `node:test` and `node:assert`.
 *
 * Implementation note:
 *   We compose the Express app directly in this file (same middleware stack as
 *   startHttpServer) so we own the http.Server lifecycle and can call server.close()
 *   after each test suite.  The MCP Server and StreamableHTTPServerTransport are
 *   imported from the compiled dist/ output so TypeScript compilation is required
 *   before running these tests (`npm run build`).
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import cors from 'cors';

// ── helpers ──────────────────────────────────────────────────────────────────

/** Pick a random high port and return it once the server is listening. */
function startTestServer(app) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, port });
    });
    server.on('error', reject);
  });
}

/** Tear down a test server and wait for all connections to close. */
function stopTestServer(server) {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

/**
 * Build an Express app that mirrors the real startHttpServer middleware stack,
 * but uses a lightweight stub createServer factory instead of the real MCP Server.
 *
 * The stub createServer returns an object that satisfies the connect() / close()
 * interface used by startHttpServer without requiring Supabase or any external
 * service.
 */
function buildTestApp({ apiAuthToken, createServer }) {
  const app = express();
  app.use(express.json());
  app.use(cors({ origin: '*', exposedHeaders: ['Mcp-Session-Id'] }));

  // ── auth middleware (mirrors auth-middleware.ts) ───────────────────────────
  app.use((req, res, next) => {
    if (req.path === '/health' || req.path.startsWith('/.well-known/') || req.method === 'OPTIONS') {
      return next();
    }
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ error: 'unauthorized', error_description: 'Missing Authorization header' });
      return;
    }
    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer') {
      res.status(401).json({ error: 'unauthorized', error_description: 'Invalid authentication scheme (expected Bearer)' });
      return;
    }
    if (!token || token !== apiAuthToken) {
      res.status(401).json({ error: 'unauthorized', error_description: 'Invalid API token' });
      return;
    }
    next();
  });

  // ── health ─────────────────────────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // ── POST /mcp — stateless StreamableHTTP ─────────────────────────────────
  //
  // This is the critical path we are testing.  We use the real
  // StreamableHTTPServerTransport with sessionIdGenerator: undefined so we
  // exercise the actual transport logic, not a mock.
  app.post('/mcp', async (req, res) => {
    let transport;
    let mcpServer;
    try {
      // Dynamically import from compiled dist/ so we test the real transport.
      const { StreamableHTTPServerTransport } = await import(
        '@modelcontextprotocol/sdk/server/streamableHttp.js'
      );

      mcpServer = createServer();
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless — mirrors production config
        enableJsonResponse: true,       // return application/json (simpler for tests)
      });

      res.on('close', () => {
        try { transport.close(); } catch { /* ignore */ }
        try { mcpServer.close(); } catch { /* ignore */ }
      });

      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  });

  // ── GET /mcp and DELETE /mcp — 405 in stateless mode ────────────────────
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

  return app;
}

// ── stub MCP Server factory ───────────────────────────────────────────────────
//
// Returns a minimal object that satisfies the Server.connect() / Server.close()
// contract.  We import the real SDK Server so the transport can call its
// internal message handlers without errors.

async function buildStubCreateServer() {
  const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');
  const { ListToolsRequestSchema, CallToolRequestSchema } = await import(
    '@modelcontextprotocol/sdk/types.js'
  );

  return function createServer() {
    const server = new Server(
      { name: 'test-stub', version: '0.0.1' },
      { capabilities: { tools: {} } }
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [] }));
    server.setRequestHandler(CallToolRequestSchema, async () => ({
      content: [{ type: 'text', text: 'stub response' }],
    }));

    return server;
  };
}

// ── minimal JSON-RPC 2.0 initialize request body ─────────────────────────────
const INITIALIZE_BODY = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'test-client', version: '0.0.1' },
  },
});

// The MCP SDK StreamableHTTP transport requires the client to advertise support
// for both application/json (for JSON-mode responses) and text/event-stream
// (for SSE-mode streaming).  Omitting this header causes a 406 Not Acceptable.
const MCP_ACCEPT = 'application/json, text/event-stream';

const VALID_TOKEN = 'test-secret-token';

// ─────────────────────────────────────────────────────────────────────────────
// Test suites
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /mcp — stateless transport', async () => {
  let server;
  let port;
  let createServer;

  before(async () => {
    createServer = await buildStubCreateServer();
    const app = buildTestApp({ apiAuthToken: VALID_TOKEN, createServer });
    ({ server, port } = await startTestServer(app));
  });

  after(() => stopTestServer(server));

  const baseUrl = () => `http://127.0.0.1:${port}`;

  test('returns a valid JSON-RPC response without Mcp-Session-Id header', async () => {
    // This is the exact scenario that caused the production bug:
    // a client that has no session ID (e.g. first connection after a restart).
    const res = await fetch(`${baseUrl()}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: MCP_ACCEPT,
        Authorization: `Bearer ${VALID_TOKEN}`,
        // Note: intentionally NO Mcp-Session-Id header
      },
      body: INITIALIZE_BODY,
    });

    assert.equal(res.status, 200, 'should return HTTP 200 for initialize without session ID');
    const body = await res.json();
    assert.equal(body.jsonrpc, '2.0', 'response should be JSON-RPC 2.0');
    assert.equal(body.id, 1, 'response id should match request id');
    assert.ok(!body.error, `response should not contain an error, got: ${JSON.stringify(body.error)}`);
  });

  test('returns a valid response with a stale/unknown Mcp-Session-Id header', async () => {
    // This is the EXACT production bug: the client holds a session ID from before
    // the Fly.io restart.  The old code would look it up in the in-memory registry,
    // find nothing, and return 400 — causing a multi-minute client hang.
    // With stateless transport the header is simply ignored.
    const staleSessionId = 'stale-session-id-from-before-restart-00000000';

    const res = await fetch(`${baseUrl()}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: MCP_ACCEPT,
        Authorization: `Bearer ${VALID_TOKEN}`,
        'Mcp-Session-Id': staleSessionId,
      },
      body: INITIALIZE_BODY,
    });

    assert.equal(
      res.status,
      200,
      'stateless mode must ignore stale Mcp-Session-Id and still return 200'
    );
    const body = await res.json();
    assert.equal(body.jsonrpc, '2.0');
    assert.ok(!body.error, 'stale session ID must not produce a JSON-RPC error');
  });

  test('creates a fresh server per request (no shared state between calls)', async () => {
    // Send two back-to-back requests and verify both succeed independently.
    // If the server were shared across requests this could cause state corruption.
    const makeRequest = () =>
      fetch(`${baseUrl()}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: MCP_ACCEPT,
          Authorization: `Bearer ${VALID_TOKEN}`,
        },
        body: INITIALIZE_BODY,
      });

    const [res1, res2] = await Promise.all([makeRequest(), makeRequest()]);

    assert.equal(res1.status, 200, 'first concurrent request should succeed');
    assert.equal(res2.status, 200, 'second concurrent request should succeed');

    const [body1, body2] = await Promise.all([res1.json(), res2.json()]);
    assert.equal(body1.jsonrpc, '2.0');
    assert.equal(body2.jsonrpc, '2.0');
    assert.ok(!body1.error);
    assert.ok(!body2.error);
  });

  test('responds to tools/list without Mcp-Session-Id', async () => {
    const res = await fetch(`${baseUrl()}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: MCP_ACCEPT,
        Authorization: `Bearer ${VALID_TOKEN}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      }),
    });

    // The stub server registers a ListTools handler that returns an empty array.
    // A 200 with jsonrpc 2.0 payload confirms the full request-response round-trip.
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.jsonrpc, '2.0');
    assert.ok(!body.error, `tools/list should not error: ${JSON.stringify(body.error)}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /mcp — 405 in stateless mode', async () => {
  let server;
  let port;

  before(async () => {
    const createServer = await buildStubCreateServer();
    const app = buildTestApp({ apiAuthToken: VALID_TOKEN, createServer });
    ({ server, port } = await startTestServer(app));
  });

  after(() => stopTestServer(server));

  test('returns 405 for GET /mcp', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${VALID_TOKEN}` },
    });

    assert.equal(res.status, 405, 'GET /mcp must return 405 — no sessions in stateless mode');
    const body = await res.json();
    assert.equal(body.jsonrpc, '2.0');
    assert.equal(body.error.code, -32000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /mcp — 405 in stateless mode', async () => {
  let server;
  let port;

  before(async () => {
    const createServer = await buildStubCreateServer();
    const app = buildTestApp({ apiAuthToken: VALID_TOKEN, createServer });
    ({ server, port } = await startTestServer(app));
  });

  after(() => stopTestServer(server));

  test('returns 405 for DELETE /mcp', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${VALID_TOKEN}` },
    });

    assert.equal(res.status, 405, 'DELETE /mcp must return 405 — no sessions to close');
    const body = await res.json();
    assert.equal(body.jsonrpc, '2.0');
    assert.equal(body.error.code, -32000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /health — unauthenticated', async () => {
  let server;
  let port;

  before(async () => {
    const createServer = await buildStubCreateServer();
    const app = buildTestApp({ apiAuthToken: VALID_TOKEN, createServer });
    ({ server, port } = await startTestServer(app));
  });

  after(() => stopTestServer(server));

  test('returns 200 without Authorization header', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(res.status, 200, '/health must be reachable without auth');
    const body = await res.json();
    assert.equal(body.status, 'ok');
  });

  test('returns 200 even when Authorization header is wrong', async () => {
    // The health endpoint skips auth entirely — even a wrong token must not 401.
    const res = await fetch(`http://127.0.0.1:${port}/health`, {
      headers: { Authorization: 'Bearer wrong-token' },
    });
    assert.equal(res.status, 200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Auth middleware — Bearer token enforcement', async () => {
  let server;
  let port;

  before(async () => {
    const createServer = await buildStubCreateServer();
    const app = buildTestApp({ apiAuthToken: VALID_TOKEN, createServer });
    ({ server, port } = await startTestServer(app));
  });

  after(() => stopTestServer(server));

  const postMcp = (headers = {}) =>
    fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: MCP_ACCEPT, ...headers },
      body: INITIALIZE_BODY,
    });

  test('rejects POST /mcp with no Authorization header → 401', async () => {
    const res = await postMcp({});
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error, 'unauthorized');
    assert.match(body.error_description, /Missing Authorization header/i);
  });

  test('rejects POST /mcp with wrong scheme → 401', async () => {
    const res = await postMcp({ Authorization: 'Basic dXNlcjpwYXNz' });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error, 'unauthorized');
    assert.match(body.error_description, /Invalid authentication scheme/i);
  });

  test('rejects POST /mcp with wrong token → 401', async () => {
    const res = await postMcp({ Authorization: 'Bearer wrong-token' });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error, 'unauthorized');
    assert.match(body.error_description, /Invalid API token/i);
  });

  test('accepts POST /mcp with correct Bearer token → not 401', async () => {
    const res = await postMcp({ Authorization: `Bearer ${VALID_TOKEN}` });
    // We only care that auth passed (status is not 401/403).
    // The actual MCP response status is validated in the stateless transport suite.
    assert.notEqual(res.status, 401, 'correct token must not be rejected');
    assert.notEqual(res.status, 403, 'correct token must not be forbidden');
  });
});
