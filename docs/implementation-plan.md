# Codifier v2.0 — Implementation Plan

## Context

Codifier v2.0 is a remotely-installable MCP server that provides shared institutional memory for AI-driven development across organizational roles. The revised architecture (February 2026) separates the data plane (5 stateless MCP tools on the server) from the control plane (model-agnostic Agent Skills on the client), replacing the original server-side PlaybookRunner with client-side Skill files that the user's LLM reads and follows conversationally. This eliminates the `sessions` table, removes `run_playbook` and `advance_step` tools, and adds a CLI installer (`npx codifier init`) that scaffolds Skills and MCP configuration into any project.

## Key Technical Decisions

- **Skills over PlaybookRunner**: The original server-side state machine (`PlaybookRunner`, `sessions` table, `run_playbook`/`advance_step` tools) is replaced by model-agnostic Agent Skills — markdown instruction files the LLM reads locally. The LLM is the state machine. This eliminates per-step MCP round-trips, removes server-side session state, and produces a fluid conversational UX rather than a choppy step-by-step protocol.
- **5 tools, not 7**: `run_playbook` and `advance_step` are removed. The MCP server surface is reduced to 5 discrete data operations: `fetch_context`, `update_memory`, `manage_projects`, `pack_repo`, `query_data`.
- **CLI as scaffolder, not runtime**: `npx codifier init` is a one-time file copier with environment detection. After installation, the CLI is not involved in runtime — the LLM client reads Skills and calls MCP tools directly.
- **Sessions table removed**: No server-side workflow state. Conversation context lives in the LLM's context window. Schema migration required to drop the table and add missing columns to `memories` and `repositories`.
- **Schema migration over recreation**: The existing Supabase schema (001_initial_schema.sql) is structurally different from the v2.0 target. A second migration adds missing columns (`source_role`, `tags`, `learning`/`research_finding` enum values), adds the `repositories` and `api_keys` tables, and drops the `sessions` and `insights` tables.
- **Prompt templates as markdown files**: Generator prompts that were TypeScript modules in `src/playbooks/generators/` move to `skills/*/templates/` as plain markdown files. The LLM reads them directly — no server involvement.
- **Fly.io suspend-on-idle**: The original plan kept the machine running permanently to preserve in-process session state. With sessions removed, the machine can suspend on idle. `min_machines_running = 0`, `auto_stop_machines = "suspend"`.

---

## Phase 1a: Infrastructure
> Remote MCP server with SSE transport, auth, and Fly.io deployment.

- [x] `src/http/server.ts` — Scaffold Express HTTP server with SSE transport endpoint
- [x] `src/http/auth-middleware.ts` — Implement API key auth middleware (Bearer token validation against `CODIFIER_API_KEYS` env var)
- [x] `src/index.ts` — Add stdio fallback transport for local MCP clients
- [x] `src/http/server.ts` — Create `GET /health` endpoint returning server status
- [x] `Dockerfile` — Write production build (multi-stage Alpine; `dist/` + prod `node_modules` only)
- [x] `fly.toml` — Update to suspend-on-idle config: `min_machines_running = 0`, `auto_stop_machines = "suspend"` (session state no longer requires a persistent machine)
- [x] Confirm remote SSE connection from a local MCP client

> **Risk 1 — Suspend-on-idle:** The original plan kept the machine permanently running because the `sessions` table only preserved playbook state, not transport connectivity. With the PlaybookRunner removed, there is no server-side session state at all. The machine can safely suspend between requests. The `fly.toml` should be updated to reflect this: `auto_stop_machines = "suspend"`, `min_machines_running = 0`.

---

## Phase 1b–1c: Knowledge Base
> Supabase schema, RLS policies, and core memory tools.

- [x] `supabase/migrations/001_initial_schema.sql` — Initial schema with `projects`, `memories`, `api_keys` tables and pgvector
- [x] `src/datastore/supabase-datastore.ts` — Implement `SupabaseDataStore` satisfying `IDataStore` interface
- [x] `src/datastore/factory.ts` — Wire `SupabaseDataStore` into `createDataStore()` factory
- [x] `src/mcp/tools/fetch-context.ts` — Implement `fetch_context` tool with exact-match filters (project_id, memory_type, tags)
- [x] `src/mcp/tools/update-memory.ts` — Implement `update_memory` tool (upsert by id or content hash)
- [x] `src/mcp/tools/manage-projects.ts` — Implement `manage_projects` tool supporting `create`, `list`, and `switch` operations
- [x] `supabase/migrations/002_v2_schema.sql` *(new)* — Migration applied 2026-02-24:
  - [x] Drop `sessions` table (no server-side session state)
  - [x] Drop `insights` table (merged into `memories` as `learning` and `research_finding` types)
  - [x] `learning` and `research_finding` values already present in `memory_type` enum
  - [x] `source_role` (text), `tags` (text[]) columns already present in `memories`
  - [x] `repositories` table exists with `version_label`, `file_tree`, `token_count`
  - [x] `api_keys` table present with `id`, `project_id`, `key_hash`
- [x] `src/datastore/supabase-datastore.ts` — Datastore methods use `source_role`, `tags`, all 5 memory types; session methods removed
- [x] `src/mcp/schemas.ts` — Zod schemas include `learning` and `research_finding` as valid `memory_type` values

---

## Phase 1d: Repo Integration
> RepoMix programmatic API integration with versioned repository snapshots.

- [x] `package.json` — Add `repomix` to `dependencies` (`npm install repomix`)
- [x] `src/integrations/repomix.ts` — Use the programmatic `pack()` API from `repomix` — no subprocess or CLI invocation
- [x] `src/config/env.ts` — Read `GITHUB_TOKEN`, `GITLAB_TOKEN`, `BITBUCKET_TOKEN` from environment
- [x] `src/mcp/tools/pack-repo.ts` — Implement `pack_repo` tool using `repomix.pack()` against a target repo URL
- [x] `src/integrations/repomix.ts` — Store versioned snapshot output in the `repositories` table
- [x] `src/mcp/tools/pack-repo.ts` — Return snapshot id and token count summary to caller
- [x] `src/mcp/tools/pack-repo.ts` — Stores `version_label` and `file_tree` (JSONB) columns
- [ ] Smoke-test in Docker: verify `repomix` is included via `npm ci` and `pack()` executes against a known public repo

> **Risk 2 resolved:** RepoMix exposes a full programmatic Node.js API (`import { pack } from 'repomix'`). Adding it to `dependencies` is sufficient — the existing multi-stage Dockerfile includes it automatically via `npm ci`. No subprocess, global install, or v2.1 deferral required.

---

## Phase 1e: Data Integration
> Athena MCP as a sidecar subprocess — Codifier spawns ColeMurray's server via stdio and acts as an MCP client to it.

- [x] `Dockerfile` — Python + pip install of `aws-athena-mcp` added to runner stage
- [x] `src/integrations/athena.ts` — Implement using `@modelcontextprotocol/sdk` `StdioClientTransport` to spawn `python -m athena_mcp.server` as a child process
- [x] `src/config/env.ts` — Pass AWS credentials to child process via environment: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `ATHENA_S3_OUTPUT_LOCATION`, `ATHENA_WORKGROUP`, `ATHENA_TIMEOUT_SECONDS`
- [x] `src/mcp/tools/query-data.ts` — Implement `query_data` tool with `list-tables` operation (calls Athena MCP `list_tables` via MCP client)
- [x] `src/mcp/tools/query-data.ts` — Implement `describe-tables` operation (calls `get_table_schema`)
- [x] `src/mcp/tools/query-data.ts` — Implement `execute-query` operation (calls `run_query`; enforces SELECT-only before forwarding)
- [x] `src/mcp/tools/query-data.ts` — Cap query results at 100KB; return truncation notice if limit is hit
- [ ] Smoke-test in Docker: verify `python -m athena_mcp.server` starts and responds to `list_tables` within the container

> **Risk 3 — Athena integration pattern:** The `aws-athena-mcp` server in the local Claude Desktop config runs as a client-side subprocess. For Fly.io, Codifier spawns it as a sidecar child process via `StdioClientTransport` within the same container — identical to how Cursor invokes it locally. AWS credentials are available as Fly.io secrets and passed through to the child process automatically. Zero changes to the Athena MCP server code required.

---

## Phase 1f: Remove Server-Side Playbook Infrastructure
> Delete the PlaybookRunner, YAML definitions, TypeScript generator modules, and the two workflow tools. These are replaced by client-side Skills in Phase 1g.

- [x] `src/mcp/tools/run-playbook.ts` — Deleted; `run_playbook` tool removed from MCP server
- [x] `src/mcp/tools/advance-step.ts` — Deleted; `advance_step` tool removed from MCP server
- [x] `src/playbooks/PlaybookRunner.ts` — Deleted (state machine replaced by client-side Skills)
- [x] `src/playbooks/loader.ts` — Deleted (YAML loader no longer needed)
- [x] `src/playbooks/types.ts` — Deleted (Playbook/Step types no longer needed on the server)
- [x] `src/playbooks/definitions/developer/initialize-project.yaml` — Deleted
- [x] `src/playbooks/definitions/developer/brownfield-onboard.yaml` — Deleted
- [x] `src/playbooks/definitions/researcher/research-analyze.yaml` — Deleted
- [x] `src/playbooks/generators/rules-from-context.ts` — Deleted (prompt moved to `skills/initialize-project/templates/rules-prompt.md`)
- [x] `src/playbooks/generators/evals-from-rules.ts` — Deleted (prompt moved to `skills/initialize-project/templates/evals-prompt.md`)
- [x] `src/playbooks/generators/requirements-from-context.ts` — Deleted (prompt moved to `skills/initialize-project/templates/requirements-prompt.md`)
- [x] `src/playbooks/generators/roadmap-from-requirements.ts` — Deleted (prompt moved to `skills/initialize-project/templates/roadmap-prompt.md`)
- [x] `src/playbooks/generators/queries-from-objective.ts` — Deleted (prompt moved to `skills/research-analyze/templates/query-generation-prompt.md`)
- [x] `src/playbooks/generators/research-synthesis.ts` — Deleted (prompt moved to `skills/research-analyze/templates/synthesis-prompt.md`)
- [x] `src/playbooks/generators/index.ts` — Deleted
- [x] `src/mcp/server.ts` — PlaybookRunner import removed; server registers exactly 5 tools
- [x] `npm run build` — Build succeeds with no orphan imports

---

## Phase 1g: Skills Authoring
> Model-agnostic Agent Skills that replace YAML playbooks. Each Skill is a markdown instruction file the LLM reads and follows conversationally, calling MCP tools only for data operations.

- [x] `skills/shared/codifier-tools.md` — Reference document: all 5 MCP tools, parameters, and usage patterns; shared across all Skills
- [x] `skills/initialize-project/SKILL.md` — Full workflow instructions for the Initialize Project skill: collect project name/description/SOW, optionally pack repos, generate 4 artifacts (Rules.md, Evals.md, Requirements.md, Roadmap.md), persist to shared KB via `update_memory`
- [x] `skills/initialize-project/templates/rules-prompt.md` — Prompt template for generating Rules.md; migrated and expanded from `src/playbooks/generators/rules-from-context.ts`
- [x] `skills/initialize-project/templates/evals-prompt.md` — Prompt template for generating Evals.md; migrated from `src/playbooks/generators/evals-from-rules.ts`
- [x] `skills/initialize-project/templates/requirements-prompt.md` — Prompt template for generating Requirements.md; migrated from `src/playbooks/generators/requirements-from-context.ts`
- [x] `skills/initialize-project/templates/roadmap-prompt.md` — Prompt template for generating Roadmap.md; migrated from `src/playbooks/generators/roadmap-from-requirements.ts`
- [x] `skills/brownfield-onboard/SKILL.md` — Workflow instructions for brownfield onboarding: collect repo URLs, call `pack_repo` for each, store snapshots, generate architectural summary, persist learnings
- [x] `skills/research-analyze/SKILL.md` — Workflow instructions for the Research & Analyze skill: define objective, discover Athena schemas via `query_data`, review generated SQL, execute queries, synthesize findings, persist as `research_finding` memories
- [x] `skills/research-analyze/templates/query-generation-prompt.md` — Prompt template for generating SQL queries from a research objective; migrated from `src/playbooks/generators/queries-from-objective.ts`
- [x] `skills/research-analyze/templates/synthesis-prompt.md` — Prompt template for synthesizing query results into ResearchFindings.md; migrated from `src/playbooks/generators/research-synthesis.ts`

> **Skill anatomy:** Each SKILL.md contains: Purpose, Prerequisites (MCP connection, repo URLs, etc.), Workflow steps in natural language, Context assembly instructions for each artifact generator scenario (greenfield + SOW, greenfield no SOW, brownfield + SOW, brownfield no SOW), Error handling guidance, and a pointer to `shared/codifier-tools.md`.

---

## Phase 1h: Slash Commands
> Thin activation wrappers that map to Skills. For Claude Code, these live in `.claude/commands/`. The CLI installer (Phase 1i) copies these to the appropriate client-specific location.

- [x] `commands/init.md` — Slash command that reads and follows `skills/initialize-project/SKILL.md`
- [x] `commands/onboard.md` — Slash command that reads and follows `skills/brownfield-onboard/SKILL.md`
- [x] `commands/research.md` — Slash command that reads and follows `skills/research-analyze/SKILL.md`

> **Command format:** Each command file contains a single instruction directing the LLM to read the corresponding SKILL.md and follow it. Example for `commands/init.md`: "Read and follow the instructions in .codifier/skills/initialize-project/SKILL.md. Use the Codifier MCP tools as directed by the skill."

---

## Phase 1i: CLI Installer
> `npx codifier init` — a one-time file scaffolder with environment detection and MCP configuration. Not a runtime. After installation, the CLI is not involved in Skill execution.

- [x] `package.json` — `bin` entry points to `dist/cli/bin/codifier.js`; `commander` added to dependencies
- [x] `cli/bin/codifier.ts` — CLI entry point; parses commands (`init`, `update`, `add`, `doctor`) and dispatches to handlers
- [x] `cli/detect.ts` — Environment detection: checks for `.claude/`, `.cursor/`, `.windsurf/` to identify LLM client; returns client type and client-specific paths
- [x] `cli/init.ts` — Full scaffold command:
  1. Run environment detection
  2. Create `.codifier/skills/` directory; copy all Skills and shared reference from `skills/` package directory
  3. Copy slash commands to client-specific location (`.claude/commands/` for Claude Code, `.cursor/rules/` for Cursor, `.codifier/commands/` for generic)
  4. Prompt for Codifier MCP server URL and API key; write `.codifier/config.json` and client-specific MCP config (`.mcp.json` for Claude Code)
  5. Verify MCP connectivity via `GET /health`
  6. Print summary of installed Skills and connection status
- [x] `cli/update.ts` — Pull latest Skills from npm package and overwrite `.codifier/skills/`; preserve `.codifier/config.json`
- [x] `cli/add.ts` — Install an individual Skill by name (e.g., `npx codifier add research-analyze`); copies single Skill directory into `.codifier/skills/`
- [x] `cli/doctor.ts` — Verify MCP connectivity (GET /health), check that all installed Skill files are present and non-empty, report missing or corrupted files
- [x] `tsconfig.json` — `cli/` added to `include` array
- [x] `npm run build` — CLI compiles alongside server; `dist/cli/bin/codifier.js` produced

---

## Phase 1j: Validation
> End-to-end demos proving correctness, persistence, remote access, and the Skill-driven UX.

- [ ] Run `npx codifier init` — verify Skills scaffold in under 30 seconds with zero errors, MCP connectivity confirmed
- [ ] Run developer demo via `/init` slash command: conversational flow collects project info, calls `pack_repo` and `update_memory`, generates all 4 artifacts (Rules.md, Evals.md, Requirements.md, Roadmap.md) inline
- [ ] Run brownfield demo via `/onboard` slash command: repos packed, architectural summary generated, learnings persisted
- [ ] Run researcher demo via `/research` slash command: Athena schemas discovered, SQL generated and confirmed, queries executed, ResearchFindings.md synthesized
- [ ] Run cross-role demo: researcher's `research_finding` memories retrieved by developer via `fetch_context` during Initialize Project flow, informing generated Requirements.md
- [ ] Prove persistence: second user on a different machine calls `fetch_context` and retrieves memories created by the first user
- [ ] Prove remote access: connect MCP client to `codifier-mcp.fly.dev` via SSE + API key
- [ ] Verify tool count: MCP server registers exactly 5 tools (`fetch_context`, `update_memory`, `manage_projects`, `pack_repo`, `query_data`) — `run_playbook` and `advance_step` must not appear
- [ ] Verify UX metric: developer Initialize Project flow completes with 5 or fewer MCP tool calls

---

## Files Summary

| Action | File |
|--------|------|
| Modify | `fly.toml` |
| Modify | `src/mcp/server.ts` |
| Modify | `src/mcp/schemas.ts` |
| Modify | `src/datastore/supabase-datastore.ts` |
| Modify | `src/mcp/tools/pack-repo.ts` |
| Modify | `tsconfig.json` |
| Modify | `package.json` |
| Create | `supabase/migrations/002_v2_schema.sql` |
| Create | `skills/shared/codifier-tools.md` |
| Create | `skills/initialize-project/SKILL.md` |
| Create | `skills/initialize-project/templates/rules-prompt.md` |
| Create | `skills/initialize-project/templates/evals-prompt.md` |
| Create | `skills/initialize-project/templates/requirements-prompt.md` |
| Create | `skills/initialize-project/templates/roadmap-prompt.md` |
| Create | `skills/brownfield-onboard/SKILL.md` |
| Create | `skills/research-analyze/SKILL.md` |
| Create | `skills/research-analyze/templates/query-generation-prompt.md` |
| Create | `skills/research-analyze/templates/synthesis-prompt.md` |
| Create | `commands/init.md` |
| Create | `commands/onboard.md` |
| Create | `commands/research.md` |
| Create | `cli/bin/codifier.ts` |
| Create | `cli/detect.ts` |
| Create | `cli/init.ts` |
| Create | `cli/update.ts` |
| Create | `cli/add.ts` |
| Create | `cli/doctor.ts` |
| Delete | `src/mcp/tools/run-playbook.ts` |
| Delete | `src/mcp/tools/advance-step.ts` |
| Delete | `src/playbooks/PlaybookRunner.ts` |
| Delete | `src/playbooks/loader.ts` |
| Delete | `src/playbooks/types.ts` |
| Delete | `src/playbooks/definitions/developer/initialize-project.yaml` |
| Delete | `src/playbooks/definitions/developer/brownfield-onboard.yaml` |
| Delete | `src/playbooks/definitions/researcher/research-analyze.yaml` |
| Delete | `src/playbooks/generators/rules-from-context.ts` |
| Delete | `src/playbooks/generators/evals-from-rules.ts` |
| Delete | `src/playbooks/generators/requirements-from-context.ts` |
| Delete | `src/playbooks/generators/roadmap-from-requirements.ts` |
| Delete | `src/playbooks/generators/queries-from-objective.ts` |
| Delete | `src/playbooks/generators/research-synthesis.ts` |
| Delete | `src/playbooks/generators/index.ts` |

---

## Verification Checklist

- [x] All modified files compile (`npm run build`)
- [x] MCP server registers exactly 5 tools — no `run_playbook` or `advance_step` in tool listing
- [x] Migration 002 applied to Supabase: `sessions` and `insights` tables dropped, `memories` has `source_role` and `tags` columns, `repositories` table exists with `version_label` and `file_tree` columns
- [ ] `npx codifier init` completes without errors on macOS (Claude Code environment)
- [ ] `.codifier/skills/` contains all 3 Skill directories with SKILL.md files after `init`
- [ ] `.claude/commands/` contains `init.md`, `onboard.md`, `research.md` after `init` on Claude Code
- [ ] `/init` slash command triggers the Initialize Project Skill conversationally without invoking `run_playbook`
- [x] `fetch_context` returns memories with `source_role` and `tags` populated
- [x] `pack_repo` stores `version_label` and `file_tree` in the `repositories` table
- [ ] Docker smoke test: `repomix` included via `npm ci`, `pack()` executes against a known public repo
- [ ] Docker smoke test: `python -m athena_mcp.server` starts and responds to `list_tables` within the container
- [ ] Developer demo: 4 artifacts generated and persisted to shared KB in a single conversational session
- [ ] Researcher demo: Athena schema discovered, queries executed, findings synthesized and persisted
- [ ] Cross-role demo: `fetch_context` on a project returns researcher's `research_finding` memories to a developer session
- [ ] Persistence demo: memory created by user A is retrievable by user B on a separate machine via the remote SSE endpoint
