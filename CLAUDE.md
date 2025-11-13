# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CodifierMcp** is an MCP (Model Context Protocol) server implementation for MemoryBuilder, an institutional memory system for AI-driven development. The system captures and synthesizes organizational knowledge from software development projects, creating a self-reinforcing feedback loop that improves AI-driven development through accumulated institutional knowledge.

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

## MVP Strategy

The project uses a phased migration approach to deliver value quickly while building toward the full vision:

**Current Approach (MVP)**: Start with Confluence as the data store via Atlassian MCP tools. This allows rapid prototyping and immediate value delivery without infrastructure setup.

**Future Migration**: Transition to Supabase for advanced features like vector search, semantic retrieval, and graph relationships.

**Why This Approach**:
- Leverage existing Confluence infrastructure
- Clean abstraction layer (IDataStore interface) makes migration straightforward
- Learn and validate concepts before committing to infrastructure
- Deliver value to users immediately

## Implementation Phases

Development follows a phased approach with the MVP-first strategy:

**Phase 1: MVP with Atlassian MCP** (Current)
- Foundation: utilities, configuration, types, error handling
- Data store abstraction layer with IDataStore interface
- Confluence integration via Atlassian MCP tools
- Basic MCP server with fetch_context and update_memory operations
- Rules and insights storage in Confluence pages

**Phase 2: Supabase Migration**
- Database schema design (rules, documents, API contracts)
- Implement SupabaseDataStore with IDataStore interface
- Data migration tools from Confluence to Supabase
- Relationship management and audit trail

**Phase 3: Advanced Features**
- Vector storage and semantic search
- Knowledge graph with relationship mapping
- RAG architecture for context-aware retrieval
- Pattern extraction and learning algorithms

**Phase 4: Integration & UX**
- IDE plugins and CI/CD hooks
- Code review augmentation
- Query interface and knowledge graph explorer
- Administrative dashboard

## MCP Protocol Implementation

When implementing MCP protocol handlers, the core operations are:

- `fetch_context`: Retrieve relevant institutional memory based on semantic search and context-aware filtering
- `update_memory`: Save new learnings, update rules, and maintain the relationship graph

## MCP Architecture

CodifierMcp acts as a bridge between MCP clients and Confluence:

```
MCP Client (Claude Desktop, GitHub Copilot, etc.)
    ↓ stdio transport
CodifierMcp Server (this project - business logic)
    ↓ calls MCP tools via SDK
Atlassian MCP Server (Confluence API wrapper)
    ↓ REST API
Confluence Cloud (data storage)
```

**Key Design Principles**:
- CodifierMcp implements the IDataStore abstraction layer
- Atlassian MCP tools handle Confluence API authentication and communication
- Clean separation allows easy migration to different storage backends

## Data Storage Strategy

**Current (MVP)**: Confluence pages store institutional memory
- Rules stored in YAML code blocks within Confluence pages
- Insights stored as dated child pages under a parent "Memory Insights" page
- Uses Atlassian MCP tools for all Confluence operations

**Future (Production)**: Supabase database with advanced features
- Core tables for rules, documents, and API contracts
- Relationship management for graph connections between memories
- Vector storage for embeddings to enable semantic search
- Audit trail for change history and evaluation results
- Migration path: Export from Confluence → Transform → Import to Supabase

## Key Success Metrics

The system aims for:
- Sub-500ms knowledge retrieval latency
- 40% reduction in repeated architectural mistakes
- Pattern extraction and identification from development artifacts

## Technology Stack

- **TypeScript** with strict mode enabled
- **ESM (ECMAScript Modules)** with type: "module" in package.json
- **Target**: ES2022 with ESNext module system
- **Zod** for runtime validation of configuration and data schemas
- **MCP SDK** (@modelcontextprotocol/sdk) for protocol implementation
- **Atlassian MCP** for Confluence integration (current)
- **Supabase** for database and vector storage (future migration)

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