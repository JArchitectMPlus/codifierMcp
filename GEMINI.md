# GEMINI.md

This file provides guidance to Gemini CLI when working with code in this repository.

## Project Overview

**CodifierMcp** is a remotely-installable MCP (Model Context Protocol) server for MemoryBuilder, an institutional memory system for AI-driven development. The system captures and synthesizes organizational knowledge from software development projects, creating a self-reinforcing feedback loop that improves AI-driven development through accumulated institutional knowledge. Deployed at `codifier-mcp.fly.dev` with dual transport support (stdio for local use, HTTP for remote access).

## Build and Development Commands

```bash
# Build the TypeScript project
npm run build

# Install dependencies
npm install
```

The compiled output is placed in the `dist/` directory with `dist/index.js` as the main entry point.

## Architecture

### Three-Tier Memory System

The core architecture is based on three memory layers with different retrieval characteristics:

1. **Immediate Context Layer**: Hot memory for active project rules (<400ms retrieval)
2. **Working Memory Layer**: Recent architectural decisions (1-2s retrieval)
3. **Long-term Knowledge Base**: Historical patterns with complete version history

### Memory Components

The system manages three primary types of institutional knowledge:

- **Rules System (YAML)**: Project conventions, security patterns, testing standards, business logic patterns, and integration rules. Each rule includes confidence scores, usage metrics, validation history, and relationship mappings.

- **Documents/Guides (Markdown)**: Technical specifications, ADRs (Architecture Decision Records), runbooks, and best practices.

- **API Contracts (YAML/OpenAPI)**: Endpoint specifications, schemas, authentication requirements, and version compatibility.

### Knowledge Graph Architecture

Inspired by Supermemory.ai, the system uses:
- Hybrid graph database with vector indexing for semantic relationships
- RAG (Retrieval-Augmented Generation) architecture for context-aware retrieval
- MCP protocol for standardized integration across AI platforms

### Processing Pipeline

The feedback loop follows: Input → Build & Generate (with memory enrichment) → Evaluate & Learn (pattern extraction) → Memory Update (rule refinement and graph updates).

## Data Store Strategy

The project successfully migrated to Supabase while maintaining backward compatibility:

**Current (Default)**: Supabase database with PostgreSQL and pgvector extension. Provides structured storage, semantic search, and relationship mapping. Set via `DATA_STORE=supabase` (default).

**Legacy (Optional)**: Confluence Cloud via Atlassian MCP tools. Still supported for teams with existing Confluence infrastructure. Set via `DATA_STORE=confluence`.

**Why This Works**:
- Clean abstraction layer (IDataStore interface) enabled seamless migration
- Factory pattern (`createDataStore()`) switches between implementations
- Both data stores share the same interface (`getStoreId()`, `fetchRules()`, `saveInsights()`)
- Teams can choose the storage backend that fits their needs


## MCP Architecture

CodifierMcp supports dual transport modes and dual data stores:

```
MCP Client (Claude Desktop, GitHub Copilot, etc.)
    ↓ stdio (local) OR HTTP (remote with Bearer auth)
CodifierMcp Server (this project - business logic)
    ↓ factory pattern: createDataStore(config)
    ├── SupabaseDataStore (default)
    │   ↓ @supabase/supabase-js
    │   └── Supabase (PostgreSQL + pgvector)
    │
    └── AtlassianDataStore (optional)
        ↓ REST API
        └── Confluence Cloud (legacy)
```

**Key Design Principles**:
- CodifierMcp implements the IDataStore abstraction layer
- Factory pattern switches between SupabaseDataStore and AtlassianDataStore
- Dual transport: stdio for local MCP clients, HTTP for remote access
- Bearer token authentication for HTTP mode
- Clean separation allows future storage backends

## Data Storage Strategy

**Current (Default)**: Supabase database with PostgreSQL
- Three core tables: `projects`, `memories`, `insights`
- pgvector extension for embeddings and semantic search
- Structured storage for rules, documents, and API contracts
- Audit trails with `created_at` and `updated_at` timestamps
- Relationship management via foreign keys

## Technology Stack

- **TypeScript** with strict mode enabled
- **ESM (ECMAScript Modules)** with type: "module" in package.json
- **Target**: ES2022 with ESNext module system
- **Zod** for runtime validation of configuration and data schemas
- **MCP SDK** (@modelcontextprotocol/sdk) for protocol implementation
- **Express** for HTTP transport with CORS support
- **Supabase** (@supabase/supabase-js) for database and vector storage (default)
- **Atlassian MCP** for Confluence integration (optional)
- **Fly.io** for deployment with suspend-on-idle

## Development Rules and Best Practices

**IMPORTANT**: All development work must follow the rules defined in `docs/rules.yaml`.

The rules file contains institutional knowledge about this project, including:
- Production code quality standards (R001-R002)
- MCP protocol best practices (R003)
- Module system consistency (R004)
- Clean abstraction patterns (R005)
- Error handling standards (R006)
- Configuration management (R007)
- TypeScript best practices (R008)
- Module organization (R009)
- Test-friendly design patterns (R010)
- Documentation standards (R011)

**Before writing code**:
1. Review relevant rules in `docs/rules.yaml`
2. Follow the patterns (dos) specified in each rule
3. Avoid the antipatterns (don'ts) specified in each rule
4. Reference the examples provided

**After writing code**:
1. Validate your code against the rules
2. Add evaluations to `docs/evals.yaml` if introducing new patterns
3. Update rules if you discover new best practices

**Key Rules Summary**:
- Write production-ready code with no placeholders (R001)
- Keep implementations lean and concise (R002)
- Use stderr for logging in MCP servers (R003)
- Use ESM with .js extensions in imports (R004)
- Implement clean abstractions for future migration (R005)
- Use custom error classes with proper context (R006)
- Validate configuration with Zod schemas (R007)
- Enable TypeScript strict mode (R008)