# CodifierMcp Project Memory

## Architecture (v2.0)
- Remote MCP server on Fly.io (`codifier-mcp.fly.dev`) with three transports:
  - StreamableHTTP (`/mcp`) — primary, protocol version 2025-03-26
  - SSE (`/sse` + `/messages`) — legacy backward-compat; 30s keepalive comment to prevent Fly proxy idle timeout
  - stdio — local dev via `TRANSPORT_MODE=stdio`
- 6 tools: `fetch_context`, `update_memory`, `delete_memory`, `manage_projects`, `pack_repo`, `query_data`
- Client-side Skills (markdown) replace server-side PlaybookRunner (permanently removed)
- Supabase + pgvector for persistence; `DATA_STORE=supabase` default

## Fly.io Deployment
- App: `codifier-mcp`, region: `iad`
- Always-on: `auto_stop_machines = false`, `min_machines_running = 1` (changed from suspend-on-idle in commit c8084a8)
- Static egress IPs allocated (for AWS IAM allowlist): IPv4 `209.71.81.180`, IPv6 `2a09:8280:e618:1:0:d3:7b3c:0`
  - These must be in the IAM policy for IAM user `arn:aws:iam::019758134633:user/JAkpunonu`
  - If Athena fails from Fly, run Codifier locally via stdio as a workaround

## Key Files
- Entry: `src/index.ts`
- MCP server: `src/mcp/server.ts` (6 tools — no run_playbook/advance_step)
- Tools: `src/mcp/tools/{fetch-context,update-memory,delete-memory,manage-projects,pack-repo,query-data}.ts`
- Datastore: `src/datastore/supabase-datastore.ts`
- HTTP: `src/http/server.ts` + `src/http/auth-middleware.ts`
- Athena sidecar: `src/integrations/athena.ts` (spawns `python3 -m athena_mcp.server` per call)
- Skills: `skills/{initialize-project,brownfield-onboard,research-analyze}/SKILL.md`
- Commands: `commands/{init,onboard,research}.md`
- CLI: `cli/bin/codifier.ts` + `cli/{detect,init,update,add,doctor}.ts`

## Schema (Supabase)
- `projects`, `memories`, `repositories`, `api_keys` — all active
- `sessions` and `insights` tables DROPPED (migration 002 applied Feb 2026)
- `memories.memory_type` enum: rule | document | api_contract | learning | research_finding
- `memories` has `source_role` (text) and `tags` (text[])
- Supabase project ref: `zosjpggnrmcgnesklylo` (East US, "JArchitect Project")

## Notable Implementation Details

### Stateless StreamableHTTP (2026-02-28 fix)
- `/mcp` POST creates a new `Server` + `StreamableHTTPServerTransport` per request (`sessionIdGenerator: undefined`)
- No in-memory session registry — eliminates "missing session ID" hangs after Fly.io restarts
- `startHttpServer` accepts `createServer: () => Server` factory; `index.ts` passes `() => createMcpServer(mcpConfig)`
- GET /mcp and DELETE /mcp return 405 (no sessions)
- SSE (`/sse`) still uses per-connection session tracking (connection-scoped, not restart-sensitive)
- Rules R013, R014, R015, R016 + Evals E014–E017 document this pattern

### Learning: PaaS In-Memory State Is a Silent Production Killer (2026-02-28)
**Root cause of the production outage**: The original `POST /mcp` handler stored `StreamableHTTPServerTransport` instances in a module-level `Record<string, Transport>` keyed by session ID. Fly.io restarts the machine on every deploy (and occasionally for health-check failures). Each restart zeroed the registry while MCP clients (Claude Desktop, mcp-remote) retained their old `Mcp-Session-Id`. The next request arrived with a stale session ID that no longer existed in the registry, the server returned `400 Bad Request`, and the client entered a 4+ minute hang waiting for a response that never came.

**The fix** — and the general principle:
1. **Never store cross-request state in process memory on a PaaS.** Fly.io, Heroku, Railway, and similar platforms restart machines as a normal operational event. Any `Map`, `Record`, or module-level variable is silently cleared.
2. **Request-response MCP tools do not need a session.** Create a fresh `Server` + `StreamableHTTPServerTransport({ sessionIdGenerator: undefined })` per POST, connect, handle, and let `res.on('close')` clean up. Zero registry, zero restart sensitivity.
3. **Durable state belongs in Supabase.** If you genuinely need state that survives a restart, write it to the external store — not to `/tmp`, not to a module variable, not to the process heap.
4. **Design the `Mcp-Session-Id` header as optional, not required.** Stateless mode ignores it entirely; stale IDs do not cause errors.

**How to detect the pattern before it bites**: grep for module-level `Map` or `Record` declarations in HTTP handler files. If the variable accumulates entries across requests and is never written to an external store, it will be lost on restart.

### OAuth Discovery Endpoints (stub — NOT full OAuth)
- `GET /.well-known/oauth-authorization-server` and `GET /.well-known/oauth-protected-resource` are live
- These are minimal static stubs required by MCP SDK 1.7+ clients that probe before connecting
- Full OAuth 2.1 (Authorization Code + PKCE) is planned but NOT yet implemented
- Auth remains Bearer token via `API_AUTH_TOKEN` env var; plan documented in `OAuth2Implementation.md`

### Per-Call Athena Database Parameter
- `query_data` tool accepts optional `database` param that overrides `ATHENA_DATABASE` env var
- Implemented in commit `c8084a8`; allows querying different catalogs per call

### Athena Sidecar Pattern
- `AthenaClient` spawns `python3 -m athena_mcp.server` via `StdioClientTransport` per call
- Connection is torn down immediately after each operation (no persistent subprocess)
- Only SELECT and WITH/CTE queries permitted; response truncated at 100 KB
- Tools used internally: `list_tables`, `describe_table` (singular), `run_query`, `get_status`, `get_result`

## Implementation Status (Feb 2026)
- Phase 1a ✅ Infrastructure (StreamableHTTP + SSE, auth, Fly.io, health endpoint)
- Phase 1b-1c ✅ Schema migration 002 applied; datastore + schemas updated
- Phase 1d ✅ pack_repo stores version_label + file_tree
- Phase 1e ✅ Dockerfile has Python + aws-athena-mcp
- Phase 1f ✅ Playbook files deleted; server.ts registers exactly 6 tools (delete_memory added 2026-03-04)
- Phase 1g ✅ Skills created (10 markdown files across 3 skill dirs + shared)
- Phase 1h ✅ Commands created (commands/init.md, onboard.md, research.md)
- Phase 1i ✅ CLI installer created (cli/ dir, bin entry, commander dep, tsconfig updated)
- OAuth discovery stubs ✅ (commit c8084a8 — stubs only, full OAuth planned)
- Always-on Fly.io config ✅ (commit c8084a8)
- SSE keepalive ✅ (commit 4fc7ea0)
- Per-call Athena database param ✅ (commit c8084a8)

## Planned (Not Yet Implemented)
- Full OAuth 2.1 Authorization Code + PKCE — spec in `OAuth2ImplementationSummary.md` / `OAuth2Implementation.md`
- Session memory capture system — local `.codifier/MEMORY.md` + `/remember`, `/push-memory`, `/recall` commands — spec in `mem-implementation-plan.md` (all phases unchecked)

## Build & Local Dev
- `npm run build` → `tsc` (clean, no errors)
- Output: `dist/`
- CLI bin entry in package.json → `dist/cli/bin/codifier.js`
- Local stdio config (for Athena workaround): `TRANSPORT_MODE=stdio DATA_STORE=supabase node dist/index.js`
- `.mcp.json` in this repo uses `mcp-remote` → `https://codifier-mcp.fly.dev/mcp` (StreamableHTTP)