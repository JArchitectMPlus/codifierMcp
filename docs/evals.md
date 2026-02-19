# Codifier v2.0 Evals

## Phase 1 — Infrastructure

- [ ] Server health: GET /health returns 200 with running server
- [ ] Auth valid: request with correct API key returns 200
- [ ] Auth invalid: request with wrong or missing API key returns 401
- [ ] SSE transport: MCP client connects and lists tools via SSE endpoint
- [ ] Stdio transport: MCP client connects and lists tools via local stdio

## Phase 2 — Knowledge Base

- [ ] manage_projects create: tool returns a non-null project id
- [ ] fetch_context empty: new project returns empty results list
- [ ] update_memory roundtrip: stored memory is returned by fetch_context on same project
- [ ] fetch_context memory_type filter: only memories matching the given type are returned
- [ ] fetch_context tags filter: only memories matching the given tag are returned
- [ ] RLS isolation: fetch_context with mismatched project_id returns no results

## Phase 3 — Repo Integration

- [ ] pack_repo success: valid public GitHub URL stores snapshot and returns repository id
- [ ] pack_repo skip: 'skip' input returns skip confirmation without storing anything
- [ ] pack_repo bad URL: unsupported URL format returns a descriptive error message

## Phase 4 — Data Integration

- [ ] query_data list-tables: returns at least one Athena database or table name
- [ ] query_data describe-tables: returns column schema for the selected table
- [ ] query_data execute-query valid: valid SQL returns a non-empty results payload
- [ ] query_data execute-query invalid: malformed SQL returns an error, not a crash

## Phase 5 — Playbook Engine

- [ ] run_playbook: valid playbook id returns the first step prompt
- [ ] advance_step store: store action persists input and returns next step
- [ ] advance_step generate: generate action returns generate_request with prompt and context fields
- [ ] advance_step artifact: confirmed artifact is persisted as memory and next step is returned
- [ ] skip_if_empty: skill-invoke step is skipped when its referenced session value is null

## Phase 6 — Developer Playbooks

- [ ] Initialize Project end-to-end: playbook completes and produces generate_requests for Rules.md, Evals.md, Requirements.md, and Roadmap.md
- [ ] Brownfield Onboard with repo: completes with a repo URL and produces an architectural summary generate_request
- [ ] Greenfield path: playbook completes without error when no repo URL and no SOW are provided

## Phase 7 — Researcher Playbook

- [ ] Research & Analyze end-to-end: playbook completes and produces ResearchFindings.md generate_request
- [ ] Athena schema discovery: schema discovery step returns available tables before query generation step executes

## Phase 8 — Cross-Role & Persistence

- [ ] Cross-role memory read: memory with type research_finding stored by researcher is returned by fetch_context for developer on same project
- [ ] Multi-user access: memory created by user A is retrievable by user B sharing the same project
- [ ] Remote client Cursor: Codifier MCP tools are listed and callable from Cursor
- [ ] Remote client Claude Code: Codifier MCP tools are listed and callable from Claude Code
