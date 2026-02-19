# Codifier v2.0 — PlanOutline

## Value Proposition

Codifier turns individual productivity tools into organizational capability — across roles, not just engineering.

Individual tools like the compound engineering plugin, RepoMix, and Supermemory make a single developer faster. Codifier makes the *organization* faster by connecting those tools to shared institutional knowledge, proprietary data sources, authenticated org infrastructure, and surfaces beyond the IDE. And because institutional memory isn't just code — it's research findings, architectural decisions, and domain knowledge — Codifier serves multiple org roles through role-specific Playbooks that each connect to the data sources relevant to that function.

**Codifier's four irreplaceable capabilities:**

1. **Org-scoped knowledge persistence** — learnings from any person, any role, any project are stored in a shared, searchable knowledge base. A developer's discovery about a legacy API informs a researcher's analysis six months later. A researcher's data findings feed into a developer's project requirements.

2. **Authenticated connectors to proprietary data** — the org's knowledge lives behind Entra ID in SharePoint, Confluence, private GitHub repos, Athena data warehouses, and internal tools. Codifier is the bridge that brings walled-garden data into AI workflows through role-appropriate connectors.

3. **Guided friction reduction (Playbooks)** — role-specific Playbooks walk users through workflows step by step. Developers get project initialization with rules and roadmaps. Researchers get data discovery and synthesis. Each role connects to the data sources and produces the artifacts relevant to their function. The difference between a gym membership and a personal trainer.

4. **Multi-surface access** — developers use Codifier via MCP in their IDE. Researchers query data through Codifier's Athena integration. PMs and stakeholders query the knowledge base via Teams. This is how you "raise the ocean and all boats" — not just make one role faster.

---

## Architectural Principle: Extend, Don't Rebuild

Codifier is a **glue layer** that connects best-in-class tools to the org's unique context. It does not rebuild what others have already solved.

| Capability | Leverage (don't build) | Codifier adds |
|---|---|---|
| Local dev workflow (Plan→Work→Review→Compound) | Compound Engineering Plugin | Persist learnings to shared KB via `update_memory`; inject org context into planning via `fetch_context` |
| Memory engine (embeddings, semantic search) | Supabase + pgvector | Project/repo scoping, org-level multi-tenancy, brownfield versioning |
| Repo condensation | RepoMix MCP | Store condensed snapshots as versioned project context |
| Data warehouse querying | AWS Athena MCP | Schema discovery and query execution within Researcher playbooks; results persisted to shared KB |
| Spec-driven execution | GSD Framework | Codifier produces artifacts (Roadmap.md, Requirements.md) that feed into GSD or similar workflows |

```
┌──────────────────────────────────────────────────┐
│            Developer's Local Environment          │
│                                                   │
│  ┌─────────────────┐    ┌─────────────────────┐  │
│  │ Compound Eng.    │    │ GSD / Other Tools   │  │
│  │ Plugin (local    │    │ (local workflow)     │  │
│  │ Plan→Work→Review)│    │                     │  │
│  └────────┬─────────┘    └──────────┬──────────┘  │
│           │                         │             │
│           ▼                         ▼             │
│  ┌──────────────────────────────────────────────┐ │
│  │         Codifier MCP (remote)                │ │
│  │                                              │ │
│  │  • Persist learnings to shared KB            │ │
│  │  • Fetch org context (project-scoped)        │ │
│  │  • Run Playbooks for guided setup            │ │
│  │  • Produce artifacts (Rules, Evals, etc.)    │ │
│  └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
         │
         ▼ (v2.1)
┌──────────────────────┐    ┌───────────────┐
│ Teams Bot (non-devs) │    │ CLI (DevOps)  │
└──────────────────────┘    └───────────────┘
```

---

## MVP Scope (v2.0)

The MVP proves all four differentiators with the minimum build surface: shared KB, org data persistence, friction reduction via Playbooks, and the remote MCP foundation that enables future multi-surface delivery.

### Core 1: Remote MCP Server

Users connect to Codifier as a remote MCP server. Codifier handles persistence and context retrieval server-side.

**Transport:** SSE via Express/Hono, replacing v1.0's stdio transport.

**Hosting:** Fly.io with suspend-on-idle.

```toml
app = "codifier-mcp"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = "suspend"
  auto_start_machines = true
  min_machines_running = 0

  [http_service.concurrency]
    type = "connections"
    hard_limit = 25
    soft_limit = 20
```

**Auth:** Personal API keys passed via header. Auth middleware is a thin layer so the swap to SSO/Entra ID in v2.1 is non-breaking.

**Stdio fallback:** Retained for local dev and testing.

### Core 2: Shared Knowledge Base (Supabase + pgvector)

The institutional memory layer. All data persists in Supabase (Postgres + pgvector). Implements the existing `IDataStore` interface as `SupabaseDataStore`.

**Schema:**

| Table | Columns (key fields) | Purpose |
|---|---|---|
| `projects` | `id`, `name`, `org`, `metadata` (JSONB), `created_at` | Top-level container. All other entities scoped to a project. |
| `repositories` | `id`, `project_id` (FK), `version_label`, `repomix_output` (text), `file_tree` (JSONB), `metadata` (JSONB), `created_at` | Versioned repo snapshots via RepoMix. A project links to N repos (e.g., "legacy", "revamped"). |
| `memories` | `id`, `project_id` (FK), `memory_type` (enum: rule, doc, api_contract, learning, research_finding), `title`, `content` (text), `tags` (text[]), `confidence` (float), `usage_count` (int), `embedding` (vector), `source_role` (text), `created_at`, `updated_at` | Rules, docs, API contracts, learnings, research findings. Core knowledge entities. `source_role` tracks which role created the memory. |
| `sessions` | `id`, `project_id` (FK), `playbook_id`, `current_step`, `collected_data` (JSONB), `status` (enum: active, completed, abandoned), `created_at`, `updated_at` | Playbook execution state. |

**Retrieval (MVP):** Exact-match filtering on `project_id`, `memory_type`, and `tags`. The `embedding` column is populated on write (using an embedding model at ingest time) but vector similarity search is deferred to v2.1. This keeps retrieval simple and predictable while the KB is small, and the embeddings are ready when the data volume justifies semantic search.

**Row Level Security:** Supabase RLS policies scope all queries by project. API key maps to allowed project(s) via a lightweight `api_keys` table.

### Core 3: Playbook Engine

Playbooks are linear, multi-step guided sequences organized by **user role**. This taxonomy aligns with the org's internal processes — each role has workflows specific to its function, with some overlapping steps across roles.

**Role-based playbook taxonomy:**

| Role | Purpose | MVP Playbooks |
|---|---|---|
| **Developer** | Set up projects, onboard codebases, produce artifacts for AI-assisted development | Initialize Project, Brownfield Onboard |
| **Researcher** | Connect to data sources, retrieve and analyze data, synthesize findings | Research & Analyze |
| *Architect* | *(v2.1)* Evaluate technologies, model systems, produce architecture decision records | — |
| *Strategist* | *(v2.1)* Roadmap planning, competitive analysis, OKR alignment | — |

The PlaybookRunner is a lightweight state machine — no conditional branching, no loops for MVP. Steps execute in order.

**Step action types:**

| Action | Behavior |
|---|---|
| `store` | Prompt user for input, store value in `sessions.collected_data` at the specified `target` key. Accepts text, text-list, or 'skip' to store null. |
| `skill-invoke` | Call an external tool (e.g., RepoMix, Athena) with params from session data. Store result. If `skip_if_empty` is set and the referenced session value is null/empty/'skip', the step is skipped automatically. |
| `generate` | Return a structured prompt + accumulated context to the client. Client's LLM generates the artifact. User reviews and confirms ("proceed", "yes", etc.) to accept. Accepted artifact is returned as tool response content for the client to save locally, and a copy is persisted in the `memories` table. |
| `data-query` | Execute a query against a connected data source (Athena for MVP). Returns results as structured content stored in session. |

**Generate action flow (detailed):**

```
1. PlaybookRunner reaches a `generate` step
2. Codifier assembles: system prompt (generator template) + context (session data, repo snapshots, prior memories)
3. Returns to client as tool response: { type: "generate_request", prompt: "...", context: "...", output_filename: "Rules.md" }
4. Client's LLM generates the artifact from the prompt + context
5. User reviews output, confirms or edits
6. Client calls `advance_step` with the final artifact content
7. Codifier persists a copy in `memories` (memory_type based on artifact) and returns next step
```

This keeps Codifier stateless with respect to LLM calls. No API keys, no model selection, no rate limits on the server. The client's existing LLM does the generation.

**Playbook definition format (declarative YAML):**

```yaml
id: initialize-project
name: Initialize Project
description: >
  Set up a new project with knowledge base, rules, evals, requirements, and roadmap.
  Supports both greenfield (no existing code) and brownfield (existing codebase) projects.
  Context is assembled from any combination of: project description, SOW/documentation, and repo analysis.
steps:
  - id: name-project
    prompt: "What is the name of this project?"
    input_type: text
    action: store
    target: project.name

  - id: describe-project
    prompt: >
      Describe the project's purpose, goals, and scope. Include:
      - What is being built or changed
      - Key business objectives
      - Known constraints or requirements
      - For brownfield: what aspects of the existing system are being revamped
    input_type: text
    action: store
    target: project.description

  - id: provide-sow
    prompt: >
      Provide a Statement of Work (SOW) or other project documentation by pasting the content 
      directly (markdown or plain text), or 'skip' if none. This can be an SOW, PRD, technical 
      brief, or any document that defines project scope and requirements. This context will guide 
      artifact generation for both greenfield and brownfield projects.
      
      Note: For MVP, paste document content directly. Fetching from URLs (Confluence, SharePoint, 
      Google Docs) requires authenticated connectors available in v2.1.
    input_type: text
    action: store
    target: session.sow_content

  - id: provide-repo-urls
    prompt: >
      Provide repository URLs to analyze (comma-separated, or 'skip' for greenfield projects).
      For brownfield projects, this can be the legacy repo being revamped — the SOW above will 
      guide how rules are generated to reflect the target state, not just the current codebase.
    input_type: text-list
    action: store
    target: session.source_urls

  - id: fetch-and-condense
    prompt: "Fetching and condensing repositories..."
    action: skill-invoke
    skill: repomix
    params_from: session.source_urls
    skip_if_empty: session.source_urls
    target: session.repo_snapshot

  - id: generate-rules
    prompt: "Generating project rules based on available context. Review and confirm."
    action: generate
    generator: rules-from-context
    output: Rules.md
    # Generator receives: project.description + session.sow_content + session.repo_snapshot (if any)
    # Greenfield: rules derived from SOW + description (coding standards, architecture patterns, constraints)
    # Brownfield: rules derived from repo analysis + SOW (SOW guides target-state rules, repo informs current-state awareness)

  - id: generate-evals
    prompt: "Generating evaluation criteria based on rules. Review and confirm."
    action: generate
    generator: evals-from-rules
    output: Evals.md

  - id: define-requirements
    prompt: "Generating requirements based on project context. Review, edit, and confirm."
    action: generate
    generator: requirements-from-context
    output: Requirements.md

  - id: generate-roadmap
    prompt: "Generating phased roadmap from requirements. Review, edit, and confirm."
    action: generate
    generator: roadmap-from-requirements
    output: Roadmap.md
```

**Context assembly for generators:** Each `generate` step receives the full accumulated session context. The generators are smart about what's available:

| Scenario | Context available | Generator behavior |
|---|---|---|
| **Greenfield + SOW** | description + SOW | Rules derived from SOW constraints, architecture patterns, and standards. Requirements extracted from SOW scope. |
| **Greenfield, no SOW** | description only | Rules are minimal scaffolding (naming conventions, file structure). Requirements gathered from description. |
| **Brownfield + SOW** | description + SOW + repo snapshot | Rules reflect *target state* from SOW, with current-state awareness from repo analysis. SOW takes precedence over existing patterns where they conflict (the repo is what's being changed). |
| **Brownfield, no SOW** | description + repo snapshot | Rules extracted from existing codebase patterns. Requirements inferred from description + repo structure. |

**Starter Playbooks (MVP):**

#### Developer Playbooks

1. **Initialize Project** — name → describe → provide SOW (optional) → provide repos (optional) → fetch/condense → generate Rules.md → Evals.md → Requirements.md → Roadmap.md. Works for greenfield (SOW + description), brownfield (repo + SOW), or any combination.
2. **Brownfield Onboard** — provide repo URLs → pack via RepoMix → store as versioned snapshots → generate architectural summary

#### Researcher Playbooks

3. **Research & Analyze** — define objective → select data source (Athena for MVP) → discover schema → formulate queries → retrieve data → synthesize findings → generate research document

```yaml
id: research-analyze
name: Research & Analyze
role: researcher
description: >
  Connect to a data source, explore available data, retrieve relevant datasets,
  and synthesize findings into a research document. MVP supports AWS Athena;
  v2.1 adds SharePoint, Google Drive, and other sources via SkillManager.
steps:
  - id: define-objective
    prompt: >
      What is the research objective? Describe what you're trying to learn,
      the questions you need answered, and how the findings will be used.
    input_type: text
    action: store
    target: session.research_objective

  - id: provide-context
    prompt: >
      Provide any background context or supporting documentation (paste content, or 'skip').
      This could be an SOW, brief, prior research, or domain context that
      should inform the analysis.
    input_type: text
    action: store
    target: session.research_context

  - id: discover-schema
    prompt: "Discovering available databases and tables in Athena..."
    action: data-query
    source: athena
    operation: list-tables
    target: session.available_schema

  - id: select-tables
    prompt: >
      Here are the available tables. Which tables are relevant to your
      research objective? (provide table names, comma-separated)
    input_type: text-list
    action: store
    target: session.selected_tables

  - id: describe-tables
    prompt: "Retrieving schema details for selected tables..."
    action: data-query
    source: athena
    operation: describe-tables
    params_from: session.selected_tables
    target: session.table_schemas

  - id: generate-queries
    prompt: >
      Based on the research objective and available table schemas,
      here are suggested SQL queries. Review, edit, and confirm.
    action: generate
    generator: queries-from-objective
    output: null  # Queries are intermediate, not a final artifact

  - id: execute-queries
    prompt: "Executing approved queries against Athena..."
    action: data-query
    source: athena
    operation: execute-query
    params_from: session.approved_queries
    target: session.query_results

  - id: synthesize-findings
    prompt: >
      Generating research synthesis from query results and context.
      Review, edit, and confirm.
    action: generate
    generator: research-synthesis
    output: ResearchFindings.md
```

**Data-query action flow (Athena):**

```
1. PlaybookRunner reaches a `data-query` step
2. Codifier routes to the Athena integration based on `source: athena`
3. For `list-tables`: calls Athena MCP's schema discovery tools, returns available databases/tables
4. For `describe-tables`: calls Athena MCP's table metadata tools for selected tables
5. For `execute-query`: calls Athena MCP's query execution tool, waits for results
6. Results stored in session and returned to client for display
7. Client calls `advance_step` to proceed
```

### Core 4: Direct Integrations (RepoMix + Athena)

For MVP, Codifier calls external tools directly — not through the umbrella MCP proxy pattern. Each integration is hardcoded. The SkillManager abstraction is deferred to v2.1.

#### RepoMix (Developer playbooks)

The `pack_repo` tool invokes RepoMix's `pack_remote_repository` or `pack_codebase` commands and stores results in the `repositories` table.

**Supported repo URL platforms:**

| Platform | Support | Auth mechanism |
|---|---|---|
| GitHub (public) | ✓ Works out of the box | None needed |
| GitHub (private/org) | ✓ Requires token | `GITHUB_TOKEN` env var on Fly.io |
| GitLab (public) | ✓ Works out of the box | None needed |
| GitLab (private) | ✓ Requires token | `GITLAB_TOKEN` env var on Fly.io |
| Bitbucket (public) | ✓ Works out of the box | None needed |
| Bitbucket (private) | ✓ Requires token | `BITBUCKET_TOKEN` env var on Fly.io |
| Azure DevOps | Deferred to v2.1 | Requires clone + `pack_codebase` or custom connector |

RepoMix reads auth tokens from environment variables automatically. For the org's private repos, a GitHub service account PAT (or GitHub App installation token) with read access to the relevant org repos must be configured as a Fly.io secret:

```bash
fly secrets set GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
```

**Input handling for URLs:**

| Input type | How it's handled |
|---|---|
| Public repo URL (e.g., `https://github.com/org/repo`) | Passed directly to RepoMix `pack_remote_repository` |
| Private repo URL | Same — RepoMix uses token from env automatically |
| 'skip' or empty | `skip_if_empty` triggers, step is skipped (greenfield path) |
| Non-supported URL format | Error returned to client with supported platforms listed |

**MVP input scope summary:**

| Input | Source | MVP approach | v2.1 approach |
|---|---|---|---|
| Repo code | GitHub/GitLab/Bitbucket URLs | RepoMix with env tokens | Same, plus Azure DevOps |
| SOW / project docs | User pastes content directly | Stored as session data | Fetched from Confluence/SharePoint/GDrive via authenticated connectors (SkillManager) |
| Analytics / research data | AWS Athena | Direct Athena MCP integration with `query_data` tool | Same, plus SharePoint and Google Drive via SkillManager |
| Confluence/SharePoint pages | Not supported in MVP | User copies and pastes content | SkillManager with Confluence MCP, SharePoint MCP |

**Deployment prerequisite:** For demos using org private repos, the Fly.io instance must have `GITHUB_TOKEN` (or equivalent) configured as a secret before the MVP demo.

#### AWS Athena MCP (Researcher playbooks)

The `query_data` tool routes to the AWS Athena MCP server (ColeMurray/aws-athena-mcp) for schema discovery and query execution. This is a hardcoded integration — same pattern as RepoMix.

**Capabilities exposed via `query_data`:**

| Operation | Athena MCP tool | Description |
|---|---|---|
| `list-tables` | `list_databases` + `list_tables` | Discover available databases and tables |
| `describe-tables` | `get_table_schema` | Get column names, types, and metadata for selected tables |
| `execute-query` | `run_query` | Execute SQL and return results (with built-in injection protection) |

**Auth:** AWS credentials configured as Fly.io secrets. The Athena MCP server reads from standard AWS environment variables. Codifier passes these through when invoking the Athena MCP.

**Deployment prerequisite:** Fly.io instance must have `ATHENA_S3_OUTPUT_LOCATION` and AWS credentials configured before the Researcher demo. The AWS IAM role/user needs Athena query permissions and S3 read/write on the results bucket.

---

## MCP Tool Surface (MVP)

| Tool | Description |
|---|---|
| `fetch_context` | Retrieve memories filtered by `project_id`, `memory_type`, and/or `tags`. Returns matching memories as structured content. |
| `update_memory` | Create or update a memory (rule, doc, contract, learning, research finding) within the current project scope. |
| `run_playbook` | Start a Playbook by ID. Creates a session, returns the first step. Playbooks are role-specific (developer, researcher). |
| `advance_step` | Submit input for the current step. For `generate` steps, accepts the confirmed artifact content. Returns next step or completion status. |
| `manage_projects` | Create, list, switch active project. All subsequent tool calls scoped to the active project. |
| `pack_repo` | Condense a local or remote repo via RepoMix. Store result as a versioned repository snapshot in the active project. *(Developer playbooks)* |
| `query_data` | Execute queries against connected data sources (Athena for MVP). Supports schema discovery (`list-tables`, `describe-tables`) and query execution. *(Researcher playbooks)* |

**7 tools.** Each one earns its place. `pack_repo` and `query_data` serve different roles but share the same project-scoped KB. No generic dispatchers, no skill management — those come in v2.1.

---

## Phasing

### MVP (v2.0) — Prove the concept

| Step | Scope | Output |
|---|---|---|
| **1a** | Remote MCP server (SSE + Fly.io) + API key auth middleware | Codifier accessible as a remote MCP service. |
| **1b** | Supabase schema + `SupabaseDataStore` implementing `IDataStore` | `fetch_context` and `update_memory` operational with exact-match filtering. |
| **1c** | `manage_projects` tool + project scoping | Multi-project support, all queries scoped. |
| **1d** | RepoMix direct integration + `pack_repo` tool | Repo condensation stores versioned snapshots in `repositories` table. |
| **1e** | Athena MCP direct integration + `query_data` tool | Schema discovery and query execution against org data warehouse. |
| **1f** | PlaybookRunner (linear state machine) + `run_playbook` / `advance_step` tools | Playbook engine operational. |
| **1g** | Developer playbooks: Initialize Project, Brownfield Onboard | End-to-end guided dev workflows producing Rules.md, Evals.md, Requirements.md, Roadmap.md. |
| **1h** | Researcher playbook: Research & Analyze | End-to-end guided research workflow: objective → schema discovery → query → synthesis → ResearchFindings.md. |
| **1i** | Demo + internal dogfooding | Proof-of-concept validated with real projects across both roles. |

**MVP demo scenarios:**

*Developer demo:* A developer connects to Codifier from Cursor, runs the Initialize Project playbook, provides an SOW and optionally a repo URL, and walks through guided steps. At the end, they have Rules.md, Evals.md, Requirements.md, and Roadmap.md saved locally, with all knowledge persisted in the shared KB. Works identically whether the project is greenfield or brownfield.

*Researcher demo:* A researcher runs the Research & Analyze playbook, defines a research objective, discovers available Athena tables, reviews schemas, confirms generated SQL queries, and receives ResearchFindings.md synthesizing the results. Findings are persisted in the shared KB — available to developers working on the same project.

*Cross-role demo:* A researcher's findings (persisted as `memory_type: research_finding`) are retrieved by a developer via `fetch_context` during the Initialize Project playbook, informing the generated Requirements.md. That's the institutional memory story — knowledge flows across roles, not just within them.

### v2.1 — Extend the foundation

| Feature | Description | Builds on |
|---|---|---|
| **Umbrella MCP / SkillManager** | MCPorter-based proxy pattern. Codifier acts as MCP client to child servers (Confluence, GitHub, SharePoint, Jira). Progressive skill disclosure with `manage_skills` and `invoke_skill` tools. | Core 1 (remote server) |
| **Researcher data sources: SharePoint + Google Drive** | Add SharePoint MCP and Google Drive MCP as data sources selectable in the Research & Analyze playbook. Replaces hardcoded Athena-only with source selection step. | Core 4 (Athena integration pattern) |
| **Architect playbooks** | Technology evaluation, system modeling, architecture decision records (ADRs). Connects to CMDB, cloud config data sources. | Core 3 (PlaybookRunner) |
| **Strategist playbooks** | Roadmap planning, competitive analysis, OKR alignment. Produces strategy artifacts. | Core 3 (PlaybookRunner) |
| **Semantic search** | Activate vector similarity search on the `embedding` column in `memories`. Hybrid retrieval: exact-match filters + vector ranking. | Core 2 (KB already has embeddings) |
| **Playbook branching** | Conditional steps (`condition` field), skip logic, and branch paths in YAML. | Core 3 (PlaybookRunner) |
| **Teams bot** | Bot Framework SDK adapter. Read-only KB queries via Teams messages. Playbook steps rendered as Adaptive Cards. | Core 1 + Core 3 |
| **Interactive CLI** | Terminal adapter using `inquirer` or `clack` for Playbook execution outside the IDE. | Core 3 (PlaybookRunner) |
| **Compound engineering plugin integration** | Plugin's `/workflows:compound` calls `update_memory`; `/workflows:plan` calls `fetch_context`. Requires validating plugin extensibility. | Core 2 (KB) |
| **SSO / Entra ID auth** | Replace API key middleware with org SSO. Auth context flows through to connector permissions. | Core 1 (auth middleware) |
| **Memory relationships** | `memory_relationships` table for graph edges between memories (source → target, typed, weighted). Enables "show me everything related to this rule." | Core 2 (KB) |
| **Artifact versioning** | Track versions of generated artifacts (Roadmap.md v1, v2, etc.) with diff history. | Core 3 (generate action) |
| **GSD integration patterns** | Codifier artifacts (Roadmap.md, Requirements.md) formatted for direct use in GSD's `.planning/` directory. | Core 3 (Playbooks) |

---

## What Codifier Does NOT Build

| Capability | Why not | Leverage instead |
|---|---|---|
| Plan → Work → Review → Compound workflow | Already solved, model-agnostic, well-adopted | Compound engineering plugin |
| Spec-driven project execution | Already solved with milestone tracking, agent orchestration | GSD Framework |
| Memory graph engine | Infrastructure problem, not Codifier's niche | Supabase + pgvector (v2.1: memory relationships) |
| Repo packing / condensation | Already an MCP server with compression | RepoMix |
| MCP client-side protocol handling | Boilerplate, already abstracted | MCPorter (v2.1) |
| Skill definition format | Open standard exists | Agent Skills spec |
| General-purpose AI coding assistant | Commoditized | Claude Code, Cursor, etc. |
| Data warehouse query engine | Already an MCP server with SQL injection protection and async query support | AWS Athena MCP (ColeMurray/aws-athena-mcp) |
| Server-side LLM orchestration | Adds complexity, API key management, model coupling | Client's LLM generates artifacts; Codifier provides context |

---

## Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Data backend | Supabase + pgvector | No third-party data review needed. `IDataStore` abstraction preserved. Free tier sufficient for MVP. |
| LLM generation | Client-side | Codifier returns prompt + context; client's LLM generates. Keeps server stateless re: LLM calls. |
| Artifact delivery | Return as tool response content | Client saves locally. Codifier persists copy in KB. Simplest path. |
| Retrieval (MVP) | Exact-match filtering | `project_id` + `memory_type` + `tags`. Embeddings stored on write but vector search deferred to v2.1. |
| Playbook complexity (MVP) | Linear step progression | No branching, no loops. Add conditions in v2.1 based on real usage patterns. |
| RepoMix integration (MVP) | Direct call, not via SkillManager | Hardcoded integration. Umbrella MCP proxy deferred to v2.1. |
| Hosting | Fly.io | Suspend-on-idle, low cost for MVP. |
| Auth (MVP) | Personal API keys | Entra ID deferred to v2.1 until permissions granted. |
| MCP topology (MVP) | Single server, no proxy | Proxy/umbrella pattern deferred to v2.1 with SkillManager. |
| Playbook format | Declarative YAML | Portable, versionable, surface-agnostic. |
| Playbook taxonomy | Role-specific (developer, researcher for MVP) | Aligns with org structure. Roles share KB but have distinct workflows and data sources. |
| Data querying (MVP) | AWS Athena MCP (hardcoded) | Org uses Athena for analytics. SharePoint/GDrive deferred to v2.1. |
| Athena integration (MVP) | Direct call, not via SkillManager | Same pattern as RepoMix. Hardcoded, swapped to SkillManager in v2.1. |

---

## Success Metrics (MVP)

**Developer functional proof:** A developer completes the Initialize Project playbook end-to-end and receives 4 artifacts (Rules.md, Evals.md, Requirements.md, Roadmap.md) from a single guided flow.

**Researcher functional proof:** A researcher completes the Research & Analyze playbook end-to-end — discovers Athena schemas, executes queries, and receives ResearchFindings.md.

**Cross-role proof:** A researcher's findings (persisted as `research_finding`) are retrieved by a developer via `fetch_context` on the same project, demonstrating knowledge flowing across roles.

**Persistence proof:** A second user on a different machine calls `fetch_context` and retrieves memories created by the first user.

**Remote access proof:** Codifier is accessible from any MCP client (Cursor, Claude Code) via the remote SSE endpoint without local installation.

**Dogfooding:** The Codifier team uses Codifier to manage Codifier's own project knowledge base (eat your own cooking).

---

## Technical Stack Summary

| Component | Technology |
|---|---|
| Language | TypeScript |
| MCP SDK | `@modelcontextprotocol/sdk` (SSE transport) |
| Web framework | Hono or Express (for SSE endpoint + auth middleware) |
| Database | Supabase (Postgres + pgvector) |
| Embedding model | TBD at implementation (OpenAI `text-embedding-3-small` or similar — only used at ingest, not query for MVP) |
| Repo condensation | RepoMix (direct invocation) |
| Data querying | AWS Athena MCP — ColeMurray/aws-athena-mcp (direct invocation) |
| Hosting | Fly.io |
| Playbook definitions | YAML files (bundled with server, loaded at startup) |

**Deployment Requirements (Fly.io Secrets):**

| Secret | Required | Purpose |
|---|---|---|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | Supabase service role key (server-side, bypasses RLS for admin operations) |
| `CODIFIER_API_KEYS` | Yes | Comma-separated valid API keys for client auth |
| `GITHUB_TOKEN` | For private repos | GitHub PAT or App token with repo read access |
| `GITLAB_TOKEN` | If using GitLab | GitLab PAT with read_repository scope |
| `EMBEDDING_API_KEY` | Yes | API key for embedding model (e.g., OpenAI) — used at ingest only |
| `ATHENA_S3_OUTPUT_LOCATION` | For Researcher playbook | S3 path for Athena query results (e.g., `s3://bucket/athena-results/`) |
| `AWS_REGION` | For Researcher playbook | AWS region for Athena (default: `us-east-1`) |
| `AWS_ACCESS_KEY_ID` | For Researcher playbook | AWS credentials for Athena access (or use `AWS_PROFILE`) |
| `AWS_SECRET_ACCESS_KEY` | For Researcher playbook | AWS credentials for Athena access |

---

## File Structure (MVP)

```
codifier/
├── src/
│   ├── server.ts                  # SSE + stdio entry points
│   ├── auth/
│   │   └── apiKeyMiddleware.ts    # API key validation
│   ├── core/
│   │   ├── CodifierCore.ts        # Business logic (tool handlers)
│   │   └── types.ts               # Shared types
│   ├── datastore/
│   │   ├── IDataStore.ts          # Interface (from v1.0)
│   │   └── SupabaseDataStore.ts   # Supabase implementation
│   ├── playbooks/
│   │   ├── PlaybookRunner.ts      # Linear state machine
│   │   ├── generators/            # Prompt templates for generate steps
│   │   │   ├── rules-from-context.ts
│   │   │   ├── evals-from-rules.ts
│   │   │   ├── requirements-from-context.ts
│   │   │   ├── roadmap-from-requirements.ts
│   │   │   ├── queries-from-objective.ts     # Researcher: SQL generation
│   │   │   └── research-synthesis.ts         # Researcher: findings synthesis
│   │   └── definitions/           # YAML playbook files
│   │       ├── developer/
│   │       │   ├── initialize-project.yaml
│   │       │   └── brownfield-onboard.yaml
│   │       └── researcher/
│   │           └── research-analyze.yaml
│   ├── tools/
│   │   ├── fetchContext.ts
│   │   ├── updateMemory.ts
│   │   ├── runPlaybook.ts
│   │   ├── advanceStep.ts
│   │   ├── manageProjects.ts
│   │   ├── packRepo.ts
│   │   └── queryData.ts           # Athena schema discovery + query execution
│   └── integrations/
│       ├── repomix.ts             # Direct RepoMix invocation
│       └── athena.ts              # Direct Athena MCP invocation
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql # Tables, RLS policies, indexes
├── fly.toml
├── Dockerfile
├── package.json
└── tsconfig.json
```

---

*v2.0 MVP Plan — February 2026*
