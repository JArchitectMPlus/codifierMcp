# CodifierMcp

**Institutional Memory for AI-Driven Development — Across Every Org Role**

CodifierMcp is a remote MCP (Model Context Protocol) server that gives AI assistants shared, persistent organizational knowledge. It captures learnings, decisions, and research findings from any team member — and surfaces them to any other member — creating a feedback loop that makes the organization smarter over time.

[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.5.3-blue)](https://www.typescriptlang.org/)
[![MCP SDK](https://img.shields.io/badge/MCP%20SDK-1.21.1-purple)](https://modelcontextprotocol.io/)

---

## Table of Contents

- [Overview](#overview)
  - [Key Capabilities](#key-capabilities)
  - [Architecture](#architecture)
  - [Use Cases](#use-cases)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
  - [Environment Variables](#environment-variables)
  - [MCP Client Configuration](#mcp-client-configuration)
- [MCP Tools](#mcp-tools)
- [Skills](#skills)
  - [Developer Skills](#developer-skills)
  - [Researcher Skills](#researcher-skills)
- [Remote Server (HTTP Mode)](#remote-server-http-mode)
- [Development](#development)
- [Architecture Details](#architecture-details)
- [Roadmap](#roadmap)

---

## Overview

CodifierMcp bridges the gap between AI assistants and your organization's institutional knowledge. Instead of starting from scratch in every session, AI assistants can:

1. **Fetch Context**: Retrieve relevant rules, guidelines, decisions, and research findings from the shared knowledge base
2. **Update Memory**: Save new insights, patterns, and learnings discovered during development or research
3. **Follow Skills**: Walk through guided, conversational workflows that produce structured artifacts (rules, roadmaps, research reports)
4. **Integrate with Data Sources**: Pull in repo code via RepoMix and query data warehouses via Athena

This creates a virtuous cycle where knowledge from a developer's session informs a researcher's analysis, and vice versa.

### Key Capabilities

1. **Org-scoped knowledge persistence** — Learnings from any person, any role, any project persist in a shared, searchable KB. A developer's discovery about a legacy API informs a researcher's analysis six months later.

2. **Authenticated connectors to proprietary data** — RepoMix for private code repositories; AWS Athena for data warehouses. Future: SharePoint, Confluence, Google Drive.

3. **Guided friction reduction via Skills** — Role-specific conversational workflows. Developers get project initialization with rules and roadmaps. Researchers get data discovery and synthesis. The LLM reads the Skill and guides the conversation — no choppy step-by-step protocol.

4. **Multi-surface access** — IDE via MCP (Cursor, Claude Code, Claude Desktop). CLI installer (`npx codifier init`). Future: Teams bot.

### Architecture

```
┌──────────────────────────────────────────────────────┐
│   MCP Clients                                        │
│   (Claude Desktop, Cursor, Claude Code)              │
│                                                      │
│   Skills (.codifier/skills/)    ← npx codifier init  │
│   Slash Commands (.claude/commands/ or .cursor/rules/)│
└──────┬──────────────────────────┬────────────────────┘
       │ stdio (local)            │ SSE/HTTP (remote)
       ↓                          ↓
┌─────────────────────────────────────────┐
│   CodifierMcp Server                    │
│   ├── Transport: stdio | SSE            │
│   ├── Auth: Bearer token middleware     │
│   └── MCP Tools (5)                     │
│       fetch_context / update_memory     │
│       manage_projects / pack_repo       │
│       query_data                        │
└──────┬──────────────────────────────────┘
       │
  ┌────┴────────────────────────────────┐
  │ Supabase (PostgreSQL + pgvector)    │
  │  projects / repositories / memories │
  │  api_keys                           │
  └─────────────────────────────────────┘
       │
  Direct Integrations:
  ├── RepoMix (npm programmatic API)
  └── AWS Athena MCP (sidecar subprocess)
```

**Skills are client-side.** Each Skill is a markdown instruction file the LLM reads locally. The LLM drives the conversation and calls MCP tools only for data operations. There is no server-side session state.

### Use Cases

- **Project Initialization**: Follow the Initialize Project Skill to generate Rules.md, Evals.md, Requirements.md, and Roadmap.md from a description, SOW, or existing codebase
- **Brownfield Onboarding**: Pack an existing repo with RepoMix and generate an architectural summary
- **Research & Analysis**: Define a research objective, discover Athena schema, execute queries, synthesize findings
- **Cross-Role Knowledge Flow**: A researcher's findings (stored as `research_finding`) are retrieved by a developer via `fetch_context` when initializing a related project
- **Onboarding AI Assistants**: New AI sessions automatically learn your team's conventions and decisions

---

## Prerequisites

### Remote Install (Recommended)

No local setup required. You need:

1. **API auth token** — obtain from your Codifier deployment admin
2. **MCP-compatible AI client** — Claude Desktop, Cursor, or Claude Code CLI

**Install Skills and MCP config in one command:**
```bash
npx codifier init
```

This scaffolds Skills into `.codifier/skills/`, writes slash commands to the correct client location, prompts for your server URL and API key, writes `.codifier/config.json` and the client-specific MCP config, and verifies connectivity.

### Local / Self-Hosted Prerequisites

1. **Node.js 18+** — `node --version`
2. **Supabase project** — free tier at [supabase.com](https://supabase.com/); requires Project URL and Service Role Key
3. **(Optional) AWS credentials** — for Research & Analyze Skill using Athena
4. **(Optional) GitHub/GitLab token** — for private repo access via RepoMix

---

## Installation

### Remote Install (Recommended)

```bash
# Scaffold Skills and MCP config into your project
npx codifier init
```

The CLI prompts for your Codifier server URL (default: `https://codifier-mcp.fly.dev`) and API key, then:
- Copies all Skills to `.codifier/skills/`
- Writes slash commands to `.claude/commands/` (Claude Code), `.cursor/rules/` (Cursor), or `.codifier/commands/` (generic)
- Writes `.mcp.json` (Claude Code) or equivalent client config
- Verifies MCP connectivity via `GET /health`

Alternatively, configure the MCP connection manually:

```bash
# Claude Code CLI
claude mcp add --transport http codifier https://codifier-mcp.fly.dev/mcp \
  --header "Authorization: Bearer <your-token>"
```

### Local / Self-Hosted Install

```bash
# 1. Clone
git clone https://github.com/yourusername/codifierMcp.git
cd codifierMcp

# 2. Install dependencies
npm install

# 3. Build
npm run build

# 4. Configure
cp .env.example .env
# Edit .env with your values
```

---

## Configuration

### Environment Variables

```bash
# Data Store (supabase is default; confluence is legacy)
DATA_STORE=supabase

# Supabase (required when DATA_STORE=supabase)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Transport mode
TRANSPORT_MODE=http          # or stdio for local MCP clients

# HTTP auth (required when TRANSPORT_MODE=http)
HTTP_PORT=3000
API_AUTH_TOKEN=your-secure-random-token   # openssl rand -base64 32

# Logging
LOG_LEVEL=info               # debug | info | warn | error

# RepoMix — private repo access (optional)
GITHUB_TOKEN=ghp_xxxx
GITLAB_TOKEN=glpat-xxxx
BITBUCKET_TOKEN=xxxx

# AWS Athena — Research & Analyze Skill (optional)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=xxxx
AWS_SECRET_ACCESS_KEY=xxxx
ATHENA_S3_OUTPUT_LOCATION=s3://your-bucket/athena-results/
ATHENA_DATABASE=default
ATHENA_WORKGROUP=primary
```

| Variable | Required | Description |
|----------|----------|-------------|
| `DATA_STORE` | No | `supabase` (default) or `confluence` |
| `SUPABASE_URL` | When `supabase` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | When `supabase` | Service role key (not anon key) |
| `TRANSPORT_MODE` | No | `stdio` (default) or `http` |
| `HTTP_PORT` | No | Port for HTTP server (default: 3000) |
| `API_AUTH_TOKEN` | When `http` | Bearer token for authentication |
| `GITHUB_TOKEN` | For private repos | GitHub PAT with repo read access |
| `AWS_*` / `ATHENA_*` | For Research & Analyze | AWS credentials and Athena config |
| `ATHENA_DATABASE` | No | Athena database/catalog name (default: `"default"`); overridable per `query_data` call |

### MCP Client Configuration

#### Claude Code (CLI)

```bash
# Remote (recommended — or use npx codifier init)
claude mcp add --transport http codifier https://codifier-mcp.fly.dev/mcp \
  --header "Authorization: Bearer <your-token>"

# Local
claude mcp add --transport http codifier http://localhost:3000/mcp \
  --header "Authorization: Bearer <your-token>"
```

#### Claude Desktop

Claude Desktop requires the `mcp-remote` proxy to connect to SSE servers:

```json
{
  "mcpServers": {
    "codifier": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://codifier-mcp.fly.dev/mcp",
        "--header",
        "Authorization:Bearer <your-token>"
      ]
    }
  }
}
```

#### Cursor / Other MCP Clients

Configure as a StreamableHTTP server at `https://codifier-mcp.fly.dev/mcp` with `Authorization: Bearer <token>` header.

---

## MCP Tools

Codifier exposes 5 tools via the MCP protocol:

| Tool | Description |
|------|-------------|
| `fetch_context` | Retrieve memories from the KB filtered by `project_id`, `memory_type` (rule, document, api_contract, learning, research_finding), and/or `tags` |
| `update_memory` | Create or update a memory within the active project scope |
| `manage_projects` | Create, list, or switch the active project; all subsequent calls are scoped to it |
| `pack_repo` | Condense a local or remote repository via RepoMix and store it as a versioned snapshot in the `repositories` table |
| `query_data` | Execute operations against Athena: `list-tables` (schema discovery), `describe-tables` (column metadata), `execute-query` (SELECT only). Accepts optional `database` parameter to override the `ATHENA_DATABASE` env var per call. |

### Memory Types

| Type | Description |
|------|-------------|
| `rule` | Project conventions, security patterns, coding standards |
| `document` | Technical specs, ADRs, runbooks, best practices |
| `api_contract` | Endpoint specifications, schemas, auth requirements |
| `learning` | Insights captured during AI-assisted development |
| `research_finding` | Data analysis results from Research & Analyze sessions |

---

## Skills

Skills are client-side, model-agnostic Agent workflows — markdown instruction files that the LLM reads locally. The LLM drives the conversation and calls MCP tools only for data operations. There is no server-side session state or protocol round-trips between steps.

After running `npx codifier init`, Skills live in `.codifier/skills/` in your project. Slash commands in `.claude/commands/` (or the equivalent for your client) activate each Skill.

`skills/shared/codifier-tools.md` is a reference document covering all 5 MCP tools, their parameters, and usage patterns. Every Skill references it.

### Developer Skills

#### Initialize Project (`/init`)

For greenfield and brownfield projects. Produces four artifacts persisted to the shared KB.

**Workflow:** collect project name and description → optionally accept SOW → optionally provide repo URLs → pack repos via `pack_repo` → generate Rules.md → generate Evals.md → generate Requirements.md → generate Roadmap.md → persist all artifacts via `update_memory`

**Context-aware generation:**

| Scenario | Context used | Generator behavior |
|----------|-------------|-------------------|
| Greenfield + SOW | description + SOW | Rules from SOW constraints and standards |
| Greenfield, no SOW | description only | Minimal scaffolding rules |
| Brownfield + SOW | description + SOW + repo snapshot | Target-state rules; SOW takes precedence over existing patterns |
| Brownfield, no SOW | description + repo snapshot | Rules extracted from existing codebase patterns |

#### Brownfield Onboard (`/onboard`)

Pack an existing repo and generate an architectural summary with minimal ceremony.

**Workflow:** collect repo URLs → call `pack_repo` for each → store versioned snapshots → generate architectural summary → persist learnings via `update_memory`

### Researcher Skills

#### Research & Analyze (`/research`)

Connect to Athena, explore data, execute queries, synthesize findings.

**Workflow:** define research objective → provide context → discover Athena schema via `query_data list-tables` → select relevant tables → describe schemas via `query_data describe-tables` → generate SQL queries (user reviews before execution) → execute approved queries via `query_data execute-query` → synthesize findings → generate ResearchFindings.md → persist as `research_finding` memories via `update_memory`

---

## Remote Server (HTTP Mode)

### Quick Start

```bash
# Generate auth token
export API_AUTH_TOKEN=$(openssl rand -base64 32)

# Start in HTTP mode
TRANSPORT_MODE=http \
HTTP_PORT=3000 \
API_AUTH_TOKEN=$API_AUTH_TOKEN \
SUPABASE_URL=https://your-project.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=your-key \
node dist/index.js
```

### Endpoints

| Endpoint | Methods | Auth | Description |
|----------|---------|------|-------------|
| `/health` | GET | No | Health check — returns `{"status":"ok"}` |
| `/.well-known/oauth-authorization-server` | GET | No | OAuth authorization server metadata (MCP SDK 1.7+ discovery) |
| `/.well-known/oauth-protected-resource` | GET | No | OAuth protected resource metadata |
| `/mcp` | POST, GET, DELETE | Yes | StreamableHTTP transport (MCP protocol 2025-03-26) |
| `/sse` | GET | Yes | SSE transport for legacy clients |
| `/messages` | POST | Yes | SSE message endpoint |

### Authentication

All endpoints except `/health`, `/.well-known/*`, and `OPTIONS` preflight requests require:
```
Authorization: Bearer <API_AUTH_TOKEN>
```

Requests without a valid token receive a `401` response with an OAuth-standard error body:
```json
{ "error": "unauthorized", "error_description": "..." }
```

---

## Development

### Project Structure

```
codifierMcp/
├── src/
│   ├── index.ts                    # Entry point (transport branching)
│   ├── config/
│   │   └── env.ts                  # Zod-validated configuration
│   ├── http/
│   │   ├── server.ts               # Express server (StreamableHTTP + SSE)
│   │   └── auth-middleware.ts      # Bearer token authentication
│   ├── datastore/
│   │   ├── interface.ts            # IDataStore abstraction
│   │   ├── factory.ts              # createDataStore() factory
│   │   ├── supabase-datastore.ts   # Supabase implementation (default)
│   │   └── atlassian-datastore.ts  # Confluence implementation (legacy)
│   ├── mcp/
│   │   ├── server.ts               # Registers exactly 5 tools
│   │   ├── schemas.ts              # Zod schemas for tool parameters
│   │   └── tools/                  # 5 tool implementations
│   │       ├── fetch-context.ts
│   │       ├── update-memory.ts
│   │       ├── manage-projects.ts
│   │       ├── pack-repo.ts
│   │       └── query-data.ts
│   ├── integrations/
│   │   ├── repomix.ts              # RepoMix programmatic API wrapper
│   │   └── athena.ts               # Athena MCP sidecar client
│   ├── services/
│   │   ├── context-service.ts      # Rule retrieval with relevance scoring
│   │   └── memory-service.ts       # Memory enrichment and storage
│   └── utils/
│       ├── logger.ts               # Logging (stderr only)
│       └── errors.ts               # Custom error classes
├── skills/
│   ├── shared/
│   │   └── codifier-tools.md       # All 5 MCP tools reference
│   ├── initialize-project/
│   │   ├── SKILL.md
│   │   └── templates/
│   ├── brownfield-onboard/
│   │   └── SKILL.md
│   └── research-analyze/
│       ├── SKILL.md
│       └── templates/
├── commands/
│   ├── init.md                     # /init slash command
│   ├── onboard.md                  # /onboard slash command
│   └── research.md                 # /research slash command
├── cli/
│   ├── bin/codifier.ts             # CLI entry point
│   ├── detect.ts                   # LLM client detection
│   ├── init.ts                     # npx codifier init
│   ├── update.ts                   # npx codifier update
│   ├── add.ts                      # npx codifier add <skill>
│   └── doctor.ts                   # npx codifier doctor
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql
│       └── 002_v2_schema.sql       # Drops sessions/insights; v2.0 schema
├── docs/
│   ├── rules.yaml                  # Project development rules
│   └── evals.yaml                  # Rule evaluations
├── Dockerfile
├── fly.toml
└── package.json
```

### Commands

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript → dist/
npm run dev          # Build + run (stdio mode)
npm run watch        # Watch mode (rebuild on changes)
```

### Adding New Features

1. Review `docs/rules.yaml` before writing code
2. Follow the `IDataStore` interface for any storage changes
3. Use custom error classes from `utils/errors.ts`
4. Log to stderr only (never stdout) — MCP uses stdout for protocol
5. Validate all inputs with Zod schemas in `src/mcp/schemas.ts`
6. Use strict TypeScript; explicit types required

---

## Architecture Details

### Data Schema

Migration `002_v2_schema.sql` (applied 2026-02-24) dropped the `sessions` and `insights` tables. The active schema has 4 tables:

| Table | Key Fields | Purpose |
|-------|-----------|---------|
| `projects` | id, name, org, metadata | Top-level container; all entities scoped to a project |
| `repositories` | id, project_id, url, snapshot, file_tree, version_label | Versioned repo snapshots from RepoMix |
| `memories` | id, project_id, memory_type, title, content, tags, confidence, embedding, source_role | All knowledge entities (rules, docs, learnings, findings) |
| `api_keys` | id, project_id, key_hash | API key → project mapping for RLS |

### Retrieval Strategy

**MVP**: Exact-match filtering on `project_id`, `memory_type`, and `tags`. Embeddings are stored on write but vector similarity search is deferred to v2.1.

**v2.1**: Hybrid retrieval — exact-match filters + vector ranking via pgvector.

### Why Skills Instead of a Server-Side PlaybookRunner

The original v2.0 design used a server-side `PlaybookRunner` state machine with a `sessions` table, `run_playbook`, and `advance_step` tools. This was replaced in February 2026 for three reasons:

1. **Eliminating round-trips**: Each playbook step required an MCP call. Skills let the LLM manage workflow state in its context window — zero extra tool calls for step transitions.
2. **Model agnosticism**: Skill markdown files work with any LLM client. The YAML playbook format tied generation to Codifier's server-side prompt assembly.
3. **Simplified server**: 5 stateless tools are easier to reason about, test, and scale. The Fly.io deployment runs always-on (`min_machines_running = 1`, `auto_stop_machines = false`) — no cold-start delay for clients.

---

## Roadmap

### v2.1

| Feature | Description |
|---------|-------------|
| **Semantic search** | Activate vector similarity on `memories.embedding`; hybrid retrieval |
| **SkillManager / Umbrella MCP** | Proxy pattern for Confluence, SharePoint, GitHub, Jira connectors |
| **Researcher data sources** | SharePoint + Google Drive as selectable sources in Research & Analyze |
| **Architect Skills** | Technology evaluation, system modeling, ADRs |
| **Strategist Skills** | Roadmap planning, competitive analysis |
| **Teams bot** | Read-only KB queries + Skill steps as Adaptive Cards |
| **SSO / Entra ID** | Replace API key auth with org SSO |
| **Memory relationships** | Graph edges between memories for relationship queries |

---

## Additional Resources

- **MCP Documentation**: [modelcontextprotocol.io](https://modelcontextprotocol.io/)
- **Supabase**: [supabase.com/docs](https://supabase.com/docs)
- **RepoMix**: [github.com/yamadashy/repomix](https://github.com/yamadashy/repomix)
- **AWS Athena MCP**: [github.com/ColeMurray/aws-athena-mcp](https://github.com/ColeMurray/aws-athena-mcp)
- **TypeScript Handbook**: [typescriptlang.org/docs](https://www.typescriptlang.org/docs/)

---

**Built with Claude Code**
