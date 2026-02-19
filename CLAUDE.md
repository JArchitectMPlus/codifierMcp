# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CodifierMcp v2.0** is a remotely-installable MCP (Model Context Protocol) server for MemoryBuilder — an institutional memory system for AI-driven development across organizational roles. The system captures and synthesizes knowledge from software development projects and research workflows, creating a self-reinforcing feedback loop that improves AI-driven work through accumulated institutional knowledge. Deployed at `codifier-mcp.fly.dev` with dual transport support (stdio for local use, SSE for remote access).

Codifier's four core capabilities:
1. **Org-scoped knowledge persistence** — memories from any person, any role, any project stored in a shared, searchable KB
2. **Authenticated connectors to proprietary data** — RepoMix for code repos, AWS Athena for data warehouses
3. **Guided friction reduction via Playbooks** — role-specific multi-step workflows (Developer, Researcher)
4. **Multi-surface access** — IDE via MCP, future Teams bot and CLI

## Build and Development Commands

```bash
# Build the TypeScript project
npm run build

# Install dependencies
npm install
```

The compiled output is placed in the `dist/` directory with `dist/index.js` as the main entry point.

## Architecture

### Four-Core Architecture (v2.0)

**Core 1: Remote MCP Server**
- SSE transport via Express (StreamableHTTP + SSE fallback)
- Bearer token auth middleware (swap to Entra ID in v2.1)
- stdio fallback for local dev/testing
- Hosted on Fly.io (`min_machines_running = 1` during MVP demo)

**Core 2: Shared Knowledge Base (Supabase + pgvector)**
- All memory entities scoped to a project via `project_id`
- Exact-match retrieval for MVP (vector similarity search deferred to v2.1)
- Embeddings stored on write, activated for semantic search in v2.1

**Core 3: Playbook Engine**
- Linear state machine (`PlaybookRunner`) — no branching for MVP
- Declarative YAML playbook definitions, role-specific
- Step action types: `store`, `skill-invoke`, `generate`, `data-query`
- `generate` steps assemble context and return prompt to client's LLM (Codifier stays LLM-agnostic)

**Core 4: Direct Integrations**
- **RepoMix**: programmatic `pack()` API — no subprocess, installed as npm dependency
- **AWS Athena**: spawned as sidecar subprocess via `StdioClientTransport` inside same container

### Memory Components

The system manages these types of institutional knowledge (stored in `memories` table):

- **rule**: Project conventions, security patterns, coding standards
- **document**: Technical specs, ADRs, runbooks, best practices
- **api_contract**: Endpoint specs, schemas, authentication requirements
- **learning**: Insights captured during AI-assisted development sessions
- **research_finding**: Data analysis results, synthesis from Researcher playbooks

### Processing Pipeline

Input → Playbook step (`store` / `skill-invoke` / `data-query`) → `generate` step (client LLM produces artifact) → user confirms → `memories` table updated → future `fetch_context` calls benefit from accumulated knowledge.

## Data Storage Strategy

**Default**: Supabase (PostgreSQL + pgvector)

### Schema (5 Tables)

| Table | Key Fields | Purpose |
|---|---|---|
| `projects` | id, name, org, metadata | Top-level container; all entities scoped to a project |
| `repositories` | id, project_id, url, snapshot (text), file_tree (JSONB), version_label | Versioned repo snapshots via RepoMix |
| `memories` | id, project_id, memory_type (enum), title, content, tags, confidence, usage_count, embedding (vector), source_role | Rules, docs, contracts, learnings, research findings |
| `sessions` | id, project_id, playbook_id, current_step, collected_data (JSONB), status (enum: active/completed/abandoned) | Playbook execution state |
| `api_keys` | id, project_id, key_hash | Maps API keys to allowed projects for RLS |

**RLS**: All tables have Row Level Security policies scoping queries by `project_id`. `api_keys` maps each key to its allowed project(s).

**Legacy (Optional)**: Confluence Cloud via Atlassian MCP (`DATA_STORE=confluence`). Still supported via the `AtlassianDataStore` implementation.

## MCP Architecture

```
MCP Client (Claude Desktop, Cursor, etc.)
    ↓ stdio (local) OR SSE/StreamableHTTP (remote with Bearer auth)
CodifierMcp Server (this project)
    ↓ factory pattern: createDataStore(config)
    ├── SupabaseDataStore (default)
    │   ↓ @supabase/supabase-js
    │   └── Supabase (PostgreSQL + pgvector)
    │
    └── AtlassianDataStore (optional)
        ↓ REST API
        └── Confluence Cloud (legacy)

    Direct Integrations (hardcoded for MVP):
    ├── RepoMix (npm dependency, programmatic pack() API)
    └── AWS Athena MCP (sidecar subprocess via StdioClientTransport)
```

## MCP Tool Surface (7 Tools)

| Tool | Description |
|---|---|
| `fetch_context` | Retrieve memories filtered by `project_id`, `memory_type`, and/or `tags` |
| `update_memory` | Create or update a memory (rule, doc, contract, learning, research_finding) |
| `manage_projects` | Create, list, or switch active project |
| `run_playbook` | Start a Playbook by ID; creates session, returns first step |
| `advance_step` | Submit input for the current playbook step; returns next step or completion |
| `pack_repo` | Condense a repo via RepoMix; store as versioned snapshot in `repositories` |
| `query_data` | Schema discovery and query execution against Athena (`list-tables`, `describe-tables`, `execute-query`) |

## Technology Stack

- **TypeScript** with strict mode enabled
- **ESM (ECMAScript Modules)** with `type: "module"` in package.json
- **Target**: ES2022 with ESNext module system
- **Zod** for runtime validation of configuration and data schemas
- **MCP SDK** (`@modelcontextprotocol/sdk`) for protocol implementation
- **Express** for HTTP transport with CORS support (SSE + StreamableHTTP)
- **Supabase** (`@supabase/supabase-js`) for database and vector storage (default)
- **RepoMix** (`repomix` npm package) for programmatic repo condensation
- **AWS Athena MCP** (sidecar subprocess) for data warehouse querying
- **Fly.io** for deployment

## File Structure (v2.0)

```
src/
├── index.ts                    # Entry point (transport branching)
├── config/
│   └── env.ts                  # Zod-validated configuration
├── http/
│   ├── server.ts               # Express server (StreamableHTTP + SSE)
│   └── auth-middleware.ts      # Bearer token authentication
├── datastore/
│   ├── interface.ts            # IDataStore abstraction
│   ├── factory.ts              # createDataStore() factory
│   ├── supabase-datastore.ts   # Supabase implementation (default)
│   ├── supabase-client.ts      # Supabase client wrapper
│   ├── supabase-types.ts       # Supabase type definitions
│   ├── atlassian-datastore.ts  # Confluence implementation (legacy)
│   └── confluence-client.ts    # Confluence REST API client
├── mcp/
│   ├── server.ts               # Transport-agnostic MCP server
│   ├── schemas.ts              # Zod schemas for tool parameters
│   └── tools/
│       ├── fetch-context.ts
│       ├── update-memory.ts
│       ├── manage-projects.ts
│       ├── run-playbook.ts
│       ├── advance-step.ts
│       ├── pack-repo.ts
│       └── query-data.ts
├── playbooks/
│   ├── PlaybookRunner.ts       # Linear state machine
│   ├── loader.ts               # YAML playbook loader + validation
│   ├── generators/             # Prompt templates for generate steps
│   │   ├── rules-from-context.ts
│   │   ├── evals-from-rules.ts
│   │   ├── requirements-from-context.ts
│   │   ├── roadmap-from-requirements.ts
│   │   ├── queries-from-objective.ts
│   │   └── research-synthesis.ts
│   └── definitions/            # YAML playbook files
│       ├── developer/
│       │   ├── initialize-project.yaml
│       │   └── brownfield-onboard.yaml
│       └── researcher/
│           └── research-analyze.yaml
├── integrations/
│   ├── repomix.ts              # RepoMix programmatic API wrapper
│   └── athena.ts               # Athena MCP sidecar client
├── services/
│   ├── context-service.ts      # Rule retrieval with relevance scoring
│   └── memory-service.ts       # Insight enrichment and storage
└── utils/
    ├── logger.ts               # Logging utility (stderr for MCP)
    └── errors.ts               # Custom error classes
```

## Development Rules and Best Practices

**IMPORTANT**: All development work must follow the rules defined in `docs/rules.yaml`.

**Before writing code**:
Review relevant rules in `docs/rules.yaml`

**After writing code**:
Validate your code against the rules
Add evaluations to `docs/evals.yaml` if introducing new patterns
