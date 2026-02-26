# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CodifierMcp v2.0** is a remotely-installable MCP server for institutional memory in AI-driven development. It captures learnings, decisions, and research findings from any team member and surfaces them to any other member via a shared, searchable knowledge base. Deployed at `codifier-mcp.fly.dev` with dual transport support (stdio for local, SSE/StreamableHTTP for remote).

Codifier's three core capabilities:
1. **Org-scoped knowledge persistence** — memories from any person, any role, any project in a shared KB
2. **Authenticated connectors to proprietary data** — RepoMix for code repos, AWS Athena for data warehouses
3. **Multi-surface access** — IDE via MCP; CLI installer (`npx codifier init`); future Teams bot

## Build and Development Commands

```bash
npm run build     # Compile TypeScript → dist/
npm install       # Install dependencies
```

The compiled output is placed in `dist/` with `dist/index.js` as the main entry point. The CLI compiles to `dist/cli/bin/codifier.js` and is exposed as the `codifier` bin entry.

## Architecture

### Three-Layer Architecture (v2.0)

**Layer 1: Remote MCP Server (5 stateless tools)**
- SSE/StreamableHTTP transport via Express; stdio fallback for local clients
- Bearer token auth middleware (swap to Entra ID in v2.1)
- Hosted on Fly.io; always-on in primary region (`min_machines_running = 1`, `auto_stop_machines = false`) — no server-side session state, no cold-start delay

**Layer 2: Shared Knowledge Base (Supabase + pgvector)**
- All entities scoped to a project via `project_id`
- Exact-match retrieval for MVP; vector similarity search deferred to v2.1
- Embeddings stored on write

**Layer 3: Agent Skills (client-side)**
- Markdown instruction files the LLM reads locally — the LLM is the state machine
- Three Skills: `initialize-project`, `brownfield-onboard`, `research-analyze`
- Scaffolded into any project via `npx codifier init`; slash commands activate each Skill
- Skills call the 5 MCP tools for data operations; no server round-trips for workflow state

**Direct Integrations:**
- **RepoMix**: programmatic `pack()` API — npm dependency, no subprocess
- **AWS Athena**: sidecar subprocess via `StdioClientTransport` inside the container

## MCP Tool Surface (5 Tools)

| Tool | Description |
|---|---|
| `fetch_context` | Retrieve memories filtered by `project_id`, `memory_type`, and/or `tags` |
| `update_memory` | Create or update a memory (rule, doc, contract, learning, research_finding) |
| `manage_projects` | Create, list, or switch active project |
| `pack_repo` | Condense a repo via RepoMix; store as versioned snapshot in `repositories` |
| `query_data` | Schema discovery and query execution against Athena (`list-tables`, `describe-tables`, `execute-query`) |

`run_playbook` and `advance_step` were removed in v2.0. The server registers exactly 5 tools.

## Data Storage Strategy

**Default**: Supabase (PostgreSQL + pgvector)

### Schema (4 Active Tables)

| Table | Key Fields | Purpose |
|---|---|---|
| `projects` | id, name, org, metadata | Top-level container; all entities scoped to a project |
| `repositories` | id, project_id, url, snapshot (text), file_tree (JSONB), version_label | Versioned repo snapshots via RepoMix |
| `memories` | id, project_id, memory_type (enum), title, content, tags, confidence, usage_count, embedding (vector), source_role | Rules, docs, contracts, learnings, research findings |
| `api_keys` | id, project_id, key_hash | Maps API keys to allowed projects for RLS |

`sessions` and `insights` tables were dropped in migration `002_v2_schema.sql` (applied 2026-02-24). Do not reference them.

**RLS**: All tables have Row Level Security policies scoping queries by `project_id`.

**Legacy (Optional)**: Confluence Cloud via `AtlassianDataStore` (`DATA_STORE=confluence`).

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
│   ├── server.ts               # Registers exactly 5 tools
│   ├── schemas.ts              # Zod schemas for tool parameters
│   └── tools/
│       ├── fetch-context.ts
│       ├── update-memory.ts
│       ├── manage-projects.ts
│       ├── pack-repo.ts
│       └── query-data.ts
├── integrations/
│   ├── repomix.ts              # RepoMix programmatic API wrapper
│   └── athena.ts               # Athena MCP sidecar client
├── services/
│   ├── context-service.ts      # Rule retrieval with relevance scoring
│   └── memory-service.ts       # Memory enrichment and storage
└── utils/
    ├── logger.ts               # Logging utility (stderr only — MCP uses stdout)
    └── errors.ts               # Custom error classes

skills/
├── shared/
│   └── codifier-tools.md       # Reference: all 5 MCP tools, params, usage
├── initialize-project/
│   ├── SKILL.md                # Developer workflow: collect info, pack repo, generate 4 artifacts
│   └── templates/              # rules-prompt.md, evals-prompt.md, requirements-prompt.md, roadmap-prompt.md
├── brownfield-onboard/
│   └── SKILL.md                # Pack existing repos, generate architectural summary
└── research-analyze/
    ├── SKILL.md                # Athena schema discovery, SQL generation, synthesis
    └── templates/              # query-generation-prompt.md, synthesis-prompt.md

commands/
├── init.md                     # Slash command → initialize-project Skill
├── onboard.md                  # Slash command → brownfield-onboard Skill
└── research.md                 # Slash command → research-analyze Skill

cli/
├── bin/codifier.ts             # CLI entry point (init, update, add, doctor)
├── detect.ts                   # LLM client detection (.claude/, .cursor/, .windsurf/)
├── init.ts                     # Scaffold Skills + MCP config into a project
├── update.ts                   # Pull latest Skills from npm package
├── add.ts                      # Install a single Skill by name
└── doctor.ts                   # Verify MCP connectivity + Skill file integrity

supabase/migrations/
├── 001_initial_schema.sql      # Initial schema
└── 002_v2_schema.sql           # Drops sessions/insights; confirms v2.0 columns
```

## Technology Stack

- **TypeScript** — strict mode, ESM (`type: "module"`), target ES2022
- **Zod** — runtime validation for config and tool parameters
- **MCP SDK** (`@modelcontextprotocol/sdk`) — protocol + `StdioClientTransport` for Athena sidecar
- **Express** — HTTP transport (StreamableHTTP + SSE)
- **Supabase** (`@supabase/supabase-js`) — PostgreSQL + pgvector
- **RepoMix** (`repomix` npm package) — programmatic `pack()` API
- **Commander** — CLI argument parsing
- **Fly.io** — deployment

## Development Rules and Best Practices

**IMPORTANT**: All development work must follow the rules defined in `docs/rules.yaml`.

**Before writing code**: Review relevant rules in `docs/rules.yaml`

**After writing code**: Validate against the rules; add evaluations to `docs/evals.yaml` if introducing new patterns

Key constraints:
- Log to **stderr only** — MCP protocol uses stdout
- Never add `run_playbook`, `advance_step`, or session-related code — those are permanently removed
- All tool implementations live in `src/mcp/tools/`; `src/mcp/server.ts` must register exactly 5 tools
- Validate all inputs with Zod schemas in `src/mcp/schemas.ts`
- Use custom error classes from `utils/errors.ts`
