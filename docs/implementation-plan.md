# Codifier v2.0 Implementation Plan

## Phase 1a: Infrastructure
> Remote MCP server with SSE transport, auth, and Fly.io deployment.

- [x] Scaffold Hono (or Express) HTTP server with SSE transport endpoint
- [x] Implement API key auth middleware (Bearer token validation against `API_AUTH_TOKEN` env var)
- [x] Add stdio fallback transport for local MCP clients
- [x] Create `GET /health` endpoint returning server status
- [x] Write `Dockerfile` for production build (multi-stage Alpine; `dist/` + prod `node_modules` only)
- [x] Write `fly.toml` — set `min_machines_running = 1`, `auto_stop_machines = false` for MVP demo period
- [x] Confirm remote SSE connection from a local MCP client

> **Risk 1 — Suspend-on-idle:** In-process MCP transport sessions do not survive machine suspension. The DB-backed `sessions` table preserves playbook state but not transport connectivity. For MVP demo, keep the machine running (`min_machines_running = 1`). Revert to suspend-on-idle after demo once session resumption via `run_playbook` with an existing session ID is implemented (v2.1).

---

## Phase 1b–1c: Knowledge Base
> Supabase schema, RLS policies, and core memory tools.

- [x] Create `projects` table (id, name, description, created_at)
- [x] Create `repositories` table (id, project_id, url, snapshot, created_at)
- [x] Create `memories` table (id, project_id, type, tags, content, embedding, created_at)
- [x] Create `sessions` table (id, project_id, playbook, state, created_at, updated_at)
- [x] Create `api_keys` table (id, project_id, key_hash, created_at)
- [x] Enable pgvector extension and add embedding column to `memories`
- [x] Add RLS policies scoping all tables by `project_id`
- [x] Implement `SupabaseDataStore` satisfying existing `IDataStore` interface
- [x] Wire `SupabaseDataStore` into the `createDataStore()` factory
- [x] Implement `fetch_context` tool with exact-match filters (project_id, memory_type, tags)
- [x] Implement `update_memory` tool (upsert by id or content hash)
- [x] Implement `manage_projects` tool supporting `create`, `list`, and `switch` operations

---

## Phase 1d: Repo Integration
> RepoMix programmatic API integration with versioned repository snapshots.

- [x] Add `repomix` to `dependencies` in `package.json` (`npm install repomix`)
- [x] Use the programmatic `pack()` API from `repomix` — no subprocess or CLI invocation
- [x] Read `GITHUB_TOKEN`, `GITLAB_TOKEN`, `BITBUCKET_TOKEN` from environment
- [x] Implement `pack_repo` tool using `repomix.pack()` against a target repo URL
- [x] Store versioned snapshot output in the `repositories` table
- [x] Return snapshot id and token count summary to caller
- [ ] Smoke-test in Docker: verify `repomix` is included via `npm ci` and `pack()` executes against a known public repo

> **Risk 2 resolved:** RepoMix exposes a full programmatic Node.js API (`import { pack } from 'repomix'`). Adding it to `dependencies` is sufficient — the existing multi-stage Dockerfile includes it automatically via `npm ci`. No subprocess, global install, or v2.1 deferral required.

---

## Phase 1e: Data Integration
> Athena MCP as a sidecar subprocess — Codifier spawns ColeMurray's server via stdio and acts as an MCP client to it.

- [ ] Add Python + pip install of `aws-athena-mcp` to the Dockerfile (alongside existing Node/Alpine build)
- [x] Implement `integrations/athena.ts` using `@modelcontextprotocol/sdk` `StdioClientTransport` to spawn `python -m athena_mcp.server` as a child process
- [x] Pass AWS credentials to child process via environment: `AWS_REGION` (`us-west-2`), `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `ATHENA_S3_OUTPUT_LOCATION`, `ATHENA_WORKGROUP`, `ATHENA_TIMEOUT_SECONDS`
- [x] Implement `query_data` tool with `list-tables` operation (calls Athena MCP `list_tables` via MCP client)
- [x] Implement `query_data` tool with `describe-tables` operation (calls `get_table_schema`)
- [x] Implement `query_data` tool with `execute-query` operation (calls `run_query`; enforces SELECT-only before forwarding)
- [x] Cap query results at 100KB before writing to `sessions.collected_data`; return truncation notice if limit is hit
- [ ] Smoke-test in Docker: verify `python -m athena_mcp.server` starts and responds to `list_tables` within the container

> **Risk 3 — Athena integration pattern:** The `aws-athena-mcp` server in the local Claude Desktop config runs as a client-side subprocess. For Fly.io, Codifier spawns it as a sidecar child process via `StdioClientTransport` within the same container — identical to how Cursor invokes it locally. AWS credentials are already available as Fly.io secrets and are passed through to the child process automatically. Zero changes to the Athena MCP server code required.

---

## Phase 1f: Playbook Engine
> Linear state machine for multi-step guided workflows.

- [x] Define `Playbook` and `Step` TypeScript types (YAML-backed)
- [x] Implement YAML playbook loader with schema validation
- [x] Implement `PlaybookRunner` linear state machine (create, advance, complete)
- [x] Support step action types: `store`, `skill-invoke`, `generate`, `data-query`
- [x] Implement `run_playbook` tool (creates session, returns first step prompt)
- [x] Implement `advance_step` tool (accepts input, persists result, returns next step or completion)
- [x] Implement `generate` action: assemble prompt + context, return `generate_request` to client, persist confirmed artifact

---

## Phase 1g: Developer Playbooks
> Playbooks and generator templates for project initialization and brownfield onboarding.

- [x] Author `initialize-project.yaml` playbook (name → describe → SOW → repos → pack → generate artifacts)
- [x] Author `brownfield-onboard.yaml` playbook (repos → pack → store snapshots → generate architectural summary)
- [x] Write `rules-from-context` generator template
- [x] Write `evals-from-rules` generator template
- [x] Write `requirements-from-context` generator template
- [x] Write `roadmap-from-requirements` generator template
- [ ] Validate each playbook end-to-end via `run_playbook` + `advance_step`

---

## Phase 1h: Researcher Playbook
> Playbook and generator templates for data research and synthesis.

- [x] Author `research-and-analyze.yaml` playbook (objective → context → discover schema → select tables → describe → generate queries → execute → synthesize)
- [x] Write `queries-from-objective` generator template
- [x] Write `research-synthesis` generator template
- [ ] Validate playbook end-to-end against a live Athena data source

---

## Phase 1i: Validation
> End-to-end demos proving correctness, persistence, and remote access.

- [ ] Run developer demo: initialize project, pack repo, generate rules + roadmap
- [ ] Run researcher demo: research objective, execute queries, synthesize findings
- [ ] Run cross-role demo: researcher stores findings, developer retrieves via `fetch_context`
- [ ] Prove persistence: second user session retrieves first user's stored memories
- [ ] Prove remote access: connect MCP client to `codifier-mcp.fly.dev` via SSE + API key
