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
- [Playbooks](#playbooks)
  - [Developer Playbooks](#developer-playbooks)
  - [Researcher Playbooks](#researcher-playbooks)
- [Remote Server (HTTP Mode)](#remote-server-http-mode)
- [Development](#development)
- [Architecture Details](#architecture-details)
- [Roadmap](#roadmap)

---

## Overview

CodifierMcp bridges the gap between AI assistants and your organization's institutional knowledge. Instead of starting from scratch in every session, AI assistants can:

1. **Fetch Context**: Retrieve relevant rules, guidelines, decisions, and research findings from the shared knowledge base
2. **Update Memory**: Save new insights, patterns, and learnings discovered during development or research
3. **Run Playbooks**: Walk through guided, multi-step workflows that produce structured artifacts (rules, roadmaps, research reports)
4. **Integrate with Data Sources**: Pull in repo code via RepoMix and query data warehouses via Athena

This creates a virtuous cycle where knowledge from a developer's session informs a researcher's analysis, and vice versa.

### Key Capabilities

1. **Org-scoped knowledge persistence** — Learnings from any person, any role, any project persist in a shared, searchable KB. A developer's discovery about a legacy API informs a researcher's analysis six months later.

2. **Authenticated connectors to proprietary data** — RepoMix for private code repositories; AWS Athena for data warehouses. Future: SharePoint, Confluence, Google Drive.

3. **Guided friction reduction via Playbooks** — Role-specific, multi-step guided sequences. Developers get project initialization with rules and roadmaps. Researchers get data discovery and synthesis. The difference between a gym membership and a personal trainer.

4. **Multi-surface access** — IDE via MCP (Cursor, Claude Code, Claude Desktop). Future: Teams bot, CLI.

### Architecture

```
┌─────────────────────────────────────────┐
│   MCP Clients                           │
│   (Claude Desktop, Cursor, Claude Code) │
└──────┬───────────────────┬──────────────┘
       │ stdio (local)     │ SSE/HTTP (remote)
       ↓                   ↓
┌─────────────────────────────────────────┐
│   CodifierMcp Server                    │
│   ├── Transport: stdio | SSE            │
│   ├── Auth: Bearer token middleware     │
│   ├── MCP Tools (7)                     │
│   ├── PlaybookRunner (state machine)    │
│   └── Factory: createDataStore(config)  │
└──────┬──────────────────────────────────┘
       │
  ┌────┴────────────────────────────────┐
  │ Supabase (PostgreSQL + pgvector)    │
  │  projects / repositories / memories │
  │  sessions / api_keys                │
  └─────────────────────────────────────┘
       │
  Direct Integrations:
  ├── RepoMix (npm programmatic API)
  └── AWS Athena MCP (sidecar subprocess)
```

### Use Cases

- **Project Initialization**: Walk through a guided playbook to generate Rules.md, Evals.md, Requirements.md, and Roadmap.md from a description, SOW, or existing codebase
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

**One-liner install:**
```bash
claude mcp add --transport http codifier https://codifier-mcp.fly.dev/mcp \
  --header "Authorization: Bearer <your-token>"
```

### Local / Self-Hosted Prerequisites

1. **Node.js 18+** — `node --version`
2. **Supabase project** — free tier at [supabase.com](https://supabase.com/); requires Project URL and Service Role Key
3. **(Optional) AWS credentials** — for Researcher playbooks using Athena
4. **(Optional) GitHub/GitLab token** — for private repo access via RepoMix

---

## Installation

### Remote Install

```bash
# Claude Code CLI
claude mcp add --transport http codifier https://codifier-mcp.fly.dev/mcp \
  --header "Authorization: Bearer <your-token>"
```

Skip to [MCP Client Configuration](#mcp-client-configuration).

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

# AWS Athena — Researcher playbooks (optional)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=xxxx
AWS_SECRET_ACCESS_KEY=xxxx
ATHENA_S3_OUTPUT_LOCATION=s3://your-bucket/athena-results/
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
| `AWS_*` / `ATHENA_*` | For Researcher playbooks | AWS credentials and Athena config |

### MCP Client Configuration

#### Claude Code (CLI)

```bash
# Remote (recommended)
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

Codifier exposes 7 tools via the MCP protocol:

| Tool | Description |
|------|-------------|
| `fetch_context` | Retrieve memories from the KB filtered by `project_id`, `memory_type` (rule, document, api_contract, learning, research_finding), and/or `tags` |
| `update_memory` | Create or update a memory within the active project scope |
| `manage_projects` | Create, list, or switch the active project; all subsequent calls are scoped to it |
| `run_playbook` | Start a Playbook by ID (e.g., `initialize-project`, `research-analyze`); creates a session and returns the first step |
| `advance_step` | Submit input for the current playbook step; for `generate` steps, submit the confirmed artifact content; returns next step or completion |
| `pack_repo` | Condense a local or remote repository via RepoMix and store it as a versioned snapshot in the `repositories` table |
| `query_data` | Execute operations against Athena: `list-tables` (schema discovery), `describe-tables` (column metadata), `execute-query` (SELECT only) |

### Memory Types

| Type | Description |
|------|-------------|
| `rule` | Project conventions, security patterns, coding standards |
| `document` | Technical specs, ADRs, runbooks, best practices |
| `api_contract` | Endpoint specifications, schemas, auth requirements |
| `learning` | Insights captured during AI-assisted development |
| `research_finding` | Data analysis results from Researcher playbooks |

---

## Playbooks

Playbooks are declarative YAML-defined, multi-step guided workflows organized by user role. They walk AI assistants through structured sequences, collecting input, invoking tools, and generating artifacts via the client's LLM.

**Step action types:**

| Action | Behavior |
|--------|----------|
| `store` | Prompt the user for input; store the value in session data |
| `skill-invoke` | Call an external tool (RepoMix) with params from session data; auto-skips if input is empty |
| `generate` | Assemble prompt + accumulated context; return to client's LLM for generation; user confirms artifact; persisted to `memories` |
| `data-query` | Execute a query against Athena; store results in session |

**Generate step flow:**
1. PlaybookRunner assembles: generator template + session context
2. Returns `generate_request` to client with prompt + context
3. Client's LLM generates the artifact
4. User reviews and confirms
5. Client calls `advance_step` with final content
6. Codifier persists artifact to `memories` and returns next step

Codifier never calls an LLM directly — the client's existing model handles generation.

### Developer Playbooks

#### Initialize Project (`initialize-project`)

For greenfield and brownfield projects. Produces four artifacts.

**Steps:** name → describe → provide SOW (optional) → provide repo URLs (optional) → pack via RepoMix → generate Rules.md → generate Evals.md → generate Requirements.md → generate Roadmap.md

**Context-aware generation:**

| Scenario | Context | Generator behavior |
|----------|---------|-------------------|
| Greenfield + SOW | description + SOW | Rules from SOW constraints and standards |
| Greenfield, no SOW | description only | Minimal scaffolding rules |
| Brownfield + SOW | description + SOW + repo snapshot | Target-state rules from SOW; SOW takes precedence over existing patterns |
| Brownfield, no SOW | description + repo snapshot | Rules extracted from existing codebase patterns |

#### Brownfield Onboard (`brownfield-onboard`)

Pack an existing repo and generate an architectural summary.

**Steps:** provide repo URLs → pack via RepoMix → store versioned snapshots → generate architectural summary

### Researcher Playbooks

#### Research & Analyze (`research-analyze`)

Connect to Athena, explore data, execute queries, synthesize findings.

**Steps:** define objective → provide context → discover Athena schema → select relevant tables → describe table schemas → generate SQL queries (user reviews) → execute approved queries → synthesize findings → generate ResearchFindings.md

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
| `/mcp` | POST, GET, DELETE | Yes | StreamableHTTP transport (MCP protocol 2025-03-26) |
| `/sse` | GET | Yes | SSE transport for legacy clients |
| `/messages` | POST | Yes | SSE message endpoint |

### Authentication

All endpoints except `/health` require:
```
Authorization: Bearer <API_AUTH_TOKEN>
```

Requests without a valid token receive a `401` response.

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
│   │   ├── server.ts               # Transport-agnostic MCP server
│   │   ├── schemas.ts              # Zod schemas for tool parameters
│   │   └── tools/                  # Tool implementations (7 tools)
│   ├── playbooks/
│   │   ├── PlaybookRunner.ts       # Linear state machine
│   │   ├── loader.ts               # YAML loader + validation
│   │   ├── generators/             # Prompt templates for generate steps
│   │   └── definitions/            # YAML playbook files (by role)
│   │       ├── developer/
│   │       └── researcher/
│   ├── integrations/
│   │   ├── repomix.ts              # RepoMix programmatic API wrapper
│   │   └── athena.ts               # Athena MCP sidecar client
│   ├── services/
│   │   ├── context-service.ts      # Rule retrieval with relevance scoring
│   │   └── memory-service.ts       # Insight enrichment and storage
│   └── utils/
│       ├── logger.ts               # Logging (stderr only)
│       └── errors.ts               # Custom error classes
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql  # Database schema + RLS policies
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
5. Validate all inputs with Zod schemas
6. Use strict TypeScript; explicit types required

---

## Architecture Details

### Data Schema

| Table | Key Fields | Purpose |
|-------|-----------|---------|
| `projects` | id, name, org, metadata | Top-level container; all entities scoped to a project |
| `repositories` | id, project_id, url, snapshot, file_tree, version_label | Versioned repo snapshots from RepoMix |
| `memories` | id, project_id, memory_type, title, content, tags, confidence, embedding, source_role | All knowledge entities (rules, docs, learnings, findings) |
| `sessions` | id, project_id, playbook_id, current_step, collected_data, status | Playbook execution state |
| `api_keys` | id, project_id, key_hash | API key → project mapping for RLS |

### IDataStore Interface

```typescript
interface IDataStore {
  getStoreId(): Promise<string>;
  initialize(): Promise<void>;
  healthCheck(): Promise<boolean>;
  fetchRules(): Promise<Rule[]>;
  saveInsights(insights: Insight[]): Promise<SavedInsight[]>;
}
```

### Retrieval Strategy

**MVP**: Exact-match filtering on `project_id`, `memory_type`, and `tags`. Embeddings are stored on write but vector similarity search is deferred to v2.1.

**v2.1**: Hybrid retrieval — exact-match filters + vector ranking via pgvector.

### Relevance Scoring (current)

`ContextService` scores rules by:
- Title match: 40 points
- Description match: 30 points
- Pattern match: 20 points
- Example match: 10 points
- Normalized to 0–100%

---

## Roadmap

### v2.0 MVP (current)

- [x] Remote SSE server + auth middleware + Fly.io deployment
- [ ] Supabase schema (5 tables) + RLS + `SupabaseDataStore`
- [ ] `manage_projects` tool + project scoping
- [ ] RepoMix direct integration + `pack_repo` tool
- [ ] Athena MCP sidecar + `query_data` tool
- [ ] PlaybookRunner state machine + `run_playbook` / `advance_step` tools
- [ ] Developer playbooks: Initialize Project, Brownfield Onboard
- [ ] Researcher playbook: Research & Analyze
- [ ] End-to-end demos (developer, researcher, cross-role)

### v2.1

| Feature | Description |
|---------|-------------|
| **Semantic search** | Activate vector similarity on `memories.embedding`; hybrid retrieval |
| **SkillManager / Umbrella MCP** | Proxy pattern for Confluence, SharePoint, GitHub, Jira connectors |
| **Researcher data sources** | SharePoint + Google Drive as selectable sources in Research & Analyze |
| **Architect playbooks** | Technology evaluation, system modeling, ADRs |
| **Strategist playbooks** | Roadmap planning, competitive analysis |
| **Playbook branching** | Conditional steps and skip logic in YAML |
| **Teams bot** | Read-only KB queries + Playbook steps as Adaptive Cards |
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
