# Codifier v2.0 — PlanOutline (Revised)

## Value Proposition

Codifier turns individual productivity tools into organizational capability — across roles, not just engineering.

Individual tools like the compound engineering plugin, RepoMix, and Supermemory make a single developer faster. Codifier makes the *organization* faster by connecting those tools to shared institutional knowledge, proprietary data sources, authenticated org infrastructure, and surfaces beyond the IDE. And because institutional memory isn't just code — it's research findings, architectural decisions, and domain knowledge — Codifier serves multiple org roles through role-specific Skills and Playbooks that each connect to the data sources relevant to that function.

**Codifier's four irreplaceable capabilities:**

1. **Org-scoped knowledge persistence** — learnings from any person, any role, any project are stored in a shared, searchable knowledge base. A developer's discovery about a legacy API informs a researcher's analysis six months later. A researcher's data findings feed into a developer's project requirements.

2. **Authenticated connectors to proprietary data** — the org's knowledge lives behind Entra ID in SharePoint, Confluence, private GitHub repos, Athena data warehouses, and internal tools. Codifier is the bridge that brings walled-garden data into AI workflows through role-appropriate connectors.

3. **Codified workflow friction reduction (Skills + Playbooks)** — model-agnostic Agent Skills guide users through complex workflows conversationally. Developers get project initialization with rules and roadmaps. Researchers get data discovery and synthesis. Skills are reusable instruction sets that any LLM client can consume — Claude Code, Cursor, Windsurf, OpenCode, GPT — reducing friction by codifying best practices into repeatable, composable workflows. The difference between a gym membership and a personal trainer.

4. **Multi-surface access** — developers use Codifier via MCP in their IDE. Researchers query data through Codifier's Athena integration. PMs and stakeholders query the knowledge base via Teams. Skills distribute as files, adapting to each surface's native instruction format. This is how you "raise the ocean and all boats" — not just make one role faster.

---

## Architectural Principle: Extend, Don't Rebuild

Codifier is a **glue layer** that connects best-in-class tools to the org's unique context. It does not rebuild what others have already solved.

| Capability | Leverage (don't build) | Codifier adds |
|---|---|---|
| Local dev workflow (Plan→Work→Review→Compound) | Compound Engineering Plugin | Persist learnings to shared KB via `update_memory`; inject org context into planning via `fetch_context` |
| Memory engine (embeddings, semantic search) | Supabase + pgvector | Project/repo scoping, org-level multi-tenancy, brownfield versioning |
| Repo condensation | RepoMix MCP | Store condensed snapshots as versioned project context |
| Data warehouse querying | AWS Athena MCP | Schema discovery and query execution within Researcher workflows; results persisted to shared KB |
| Spec-driven execution | GSD Framework | Codifier produces artifacts (Roadmap.md, Requirements.md) that feed into GSD or similar workflows |
| Guided workflow orchestration | Agent Skills (open standard) | Codifier Skills guide LLMs through role-specific workflows; the LLM is the state machine, not the server |

```
┌──────────────────────────────────────────────────────┐
│              User's Local Environment                │
│                                                      │
│  ┌─────────────────┐    ┌─────────────────────────┐  │
│  │ IDE / Terminal   │    │ .codifier/skills/       │  │
│  │ (Claude Code,    │    │ (Playbook Skills +      │  │
│  │  Cursor, etc.)   │    │  slash commands)         │  │
│  └────────┬─────────┘    └────────────┬────────────┘  │
│           │ LLM reads Skills ◄────────┘              │
│           │ LLM calls MCP tools as needed            │
│           ▼                                          │
│  ┌───────────────────────────────────────────────┐   │
│  │         Codifier MCP Server (remote)          │   │
│  │                                               │   │
│  │  • fetch_context — retrieve org knowledge     │   │
│  │  • update_memory — persist learnings          │   │
│  │  • manage_projects — project CRUD             │   │
│  │  • pack_repo — RepoMix integration            │   │
│  │  • query_data — Athena integration            │   │
│  └───────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
         │
         ▼ (v2.1)
┌──────────────────────┐    ┌───────────────┐
│ Teams Bot (non-devs) │    │ CLI (DevOps)  │
└──────────────────────┘    └───────────────┘
```

### Key Architectural Insight: Separate Data Plane from Control Plane

The original v2.0 plan bundled workflow orchestration (PlaybookRunner, session state, step progression) into the MCP server. This created a poor user experience — each step required a full MCP round-trip (`advance_step`), burning tokens and adding latency for what should be fluid conversation.

The revised architecture separates concerns:

- **Data Plane (MCP Server)**: 5 tools for discrete data operations — fetch, store, pack, query, manage. Stateless, fast, purpose-built.
- **Control Plane (Skills)**: Model-agnostic instruction files that the user's LLM reads and follows conversationally. The LLM is the state machine. No server-side session management, no stepping protocol.

This follows the pattern established by Notion's design team (Brian Lovin) with Claude Code: Skills as reusable instruction sets, slash commands as workflow entry points, and the principle of "when the AI asks you to do something, teach it to do that itself."

---

## MVP Scope (v2.0)

The MVP proves all four differentiators with the minimum build surface: shared KB, org data persistence, codified workflow friction reduction via Skills, and the remote MCP foundation that enables future multi-surface delivery.

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

Note: The `sessions` table from the original plan is **removed**. Workflow state lives in the LLM's conversation context, not the server.

**Retrieval (MVP):** Exact-match filtering on `project_id`, `memory_type`, and `tags`. The `embedding` column is populated on write (using an embedding model at ingest time) but vector similarity search is deferred to v2.1. This keeps retrieval simple and predictable while the KB is small, and the embeddings are ready when the data volume justifies semantic search.

**Row Level Security:** Supabase RLS policies scope all queries by project. API key maps to allowed project(s) via a lightweight `api_keys` table.

### Core 3: Skills + Slash Commands (Playbooks-as-Skills)

Playbooks are delivered as **Agent Skills** — model-agnostic markdown instruction files that any LLM client can consume. Slash commands are the activation pattern. The LLM follows the Skill instructions conversationally, calling Codifier MCP tools only for data operations.

**Why Skills instead of a server-side PlaybookRunner:**

| Concern | Server-side PlaybookRunner (original) | Skills (revised) |
|---|---|---|
| Step progression | `advance_step` MCP calls — token-burning round-trips | Natural conversation — LLM manages flow |
| Session state | `sessions` table in Supabase | LLM's context window |
| Generator prompts | Server-side prompt templates | Skill `templates/` directory, read by LLM locally |
| Activation | `run_playbook` tool call | Slash command or natural language |
| Model compatibility | Tied to MCP client implementation | Model-agnostic — Claude, GPT, Gemini, OpenCode |
| Distribution | Bundled with MCP server deployment | Files in a directory — git, npm, or manual copy |
| User experience | Choppy step-by-step with latency between steps | Fluid conversational flow with MCP calls only for data ops |

**Skill structure:**

Each Playbook Skill is a directory containing a `SKILL.md` (natural language instructions for the LLM) and optional `templates/` (prompt templates for artifact generation):

```
.codifier/
├── skills/
│   ├── initialize-project/
│   │   ├── SKILL.md              # Full workflow instructions
│   │   └── templates/
│   │       ├── rules-prompt.md
│   │       ├── evals-prompt.md
│   │       ├── requirements-prompt.md
│   │       └── roadmap-prompt.md
│   ├── brownfield-onboard/
│   │   └── SKILL.md
│   ├── research-analyze/
│   │   ├── SKILL.md
│   │   └── templates/
│   │       ├── query-generation-prompt.md
│   │       └── synthesis-prompt.md
│   └── shared/
│       └── codifier-tools.md     # Reference: available MCP tools, params, usage
├── commands/
│   ├── init.md                   # Slash command → invokes initialize-project skill
│   ├── onboard.md                # Slash command → invokes brownfield-onboard skill
│   └── research.md               # Slash command → invokes research-analyze skill
└── config.json                   # MCP server URL, project defaults
```

**SKILL.md anatomy:**

A Skill file contains:
- **Purpose**: What the workflow achieves
- **Prerequisites**: What must be available (MCP connection, repo URLs, etc.)
- **Workflow steps**: Natural language instructions telling the LLM what to collect from the user, when to call MCP tools, and how to generate/present artifacts
- **Context assembly**: How to combine collected inputs for artifact generation
- **Error handling**: What to do when tools fail or inputs are missing
- **Tool reference**: Pointer to shared/codifier-tools.md

The LLM reads the SKILL.md and follows it conversationally. It asks the user questions, processes responses, calls MCP tools when needed, generates artifacts using the prompt templates, and persists results — all within a natural conversation flow.

**Slash commands:**

Slash commands are thin activation wrappers that map to Skills. For Claude Code, these live in `.claude/commands/`. For other clients, they map to the equivalent instruction entry point.

Example `commands/init.md`:
```markdown
Read and follow the instructions in .codifier/skills/initialize-project/SKILL.md

Use the Codifier MCP tools as directed by the skill. The user wants to initialize
a new project in the shared knowledge base.
```

**Friction reduction levels:**

Skills support a progression of automation that reduces friction at each level:

1. **Guide** — The Skill tells the LLM what to ask the user and how to process their responses. Every Skill does this as a baseline.

2. **Act** — The Skill instructs the LLM to call MCP tools directly on behalf of the user, rather than asking them to do it manually. Example: "call `pack_repo` with the URL the user provided" rather than "ask the user to run pack_repo."

3. **Automate** — Skills can include detection logic and executable scripts for recurring patterns. Example: auto-detect a `.sow` file in the project root and load it without asking, or scan `package.json` to infer the tech stack before generating rules.

4. **Chain** — Slash commands compose Skills. `/init` might invoke initialize-project, then automatically chain to brownfield-onboard if repos were provided. The LLM handles the transition naturally.

**Role-based Skill taxonomy (MVP):**

| Role | Purpose | MVP Skills |
|---|---|---|
| **Developer** | Set up projects, onboard codebases, produce artifacts for AI-assisted development | Initialize Project, Brownfield Onboard |
| **Researcher** | Connect to data sources, retrieve and analyze data, synthesize findings | Research & Analyze |
| *Architect* | *(v2.1)* Technology evaluation, system modeling, ADRs | — |
| *Strategist* | *(v2.1)* Roadmap planning, competitive analysis, OKR alignment | — |

**Context assembly for generators:**

Each Skill's generate steps use prompt templates that receive the full accumulated conversation context. The templates are smart about what's available:

| Scenario | Context available | Generator behavior |
|---|---|---|
| **Greenfield + SOW** | description + SOW | Rules derived from SOW constraints, architecture patterns, and standards. Requirements extracted from SOW scope. |
| **Greenfield, no SOW** | description only | Rules are minimal scaffolding (naming conventions, file structure). Requirements gathered from description. |
| **Brownfield + SOW** | description + SOW + repo snapshot | Rules reflect *target state* from SOW, with current-state awareness from repo analysis. SOW takes precedence over existing patterns where they conflict. |
| **Brownfield, no SOW** | description + repo snapshot | Rules extracted from existing codebase patterns. Requirements inferred from description + repo structure. |

### Core 4: CLI Installer (`npx codifier`)

A thin CLI that scaffolds Skills, commands, and MCP configuration into the user's project. Not a runtime — a scaffolder. After installation, the CLI isn't needed; the user's LLM client takes over.

**Installation flow:**

```bash
npx codifier init
```

What it does:

1. **Detect environment** — Identifies the LLM client (Claude Code, Cursor, Windsurf, generic) by checking for `.claude/`, `.cursor/`, etc.
2. **Create `.codifier/` directory** — Copies Skills, commands, and shared references into the project
3. **Write client-specific config** — For Claude Code: symlinks/copies commands to `.claude/commands/`, updates CLAUDE.md with Skill references. For Cursor: writes to `.cursor/rules/`. For generic: creates standalone `.codifier/` only.
4. **Configure MCP connection** — Prompts for Codifier MCP server URL + API key, writes `.codifier/config.json` and the client-specific MCP config (e.g., `.mcp.json`)
5. **Confirm setup** — Lists installed Skills, verifies MCP connectivity with a test call

**Additional CLI commands:**

| Command | Purpose |
|---|---|
| `npx codifier init` | Full scaffold — Skills, commands, MCP config |
| `npx codifier update` | Pull latest Skills from the package registry |
| `npx codifier add <skill>` | Install an individual Skill (e.g., `npx codifier add research-analyze`) |
| `npx codifier doctor` | Verify MCP connectivity, check Skill integrity |

**CLI scope (MVP):** The CLI is ~200-300 lines of TypeScript. It's a file copier with environment detection and config writing. No daemon, no background process, no runtime dependency.

```
codifier (npm package)
├── bin/
│   └── codifier.ts               # CLI entry point
├── cli/
│   ├── init.ts                   # Scaffold skills + configure MCP
│   ├── update.ts                 # Pull latest skills
│   ├── add.ts                    # Add individual skills
│   ├── doctor.ts                 # Verify connectivity + integrity
│   └── detect.ts                 # Environment detection
├── skills/                       # Bundled skill definitions (copied to user project)
│   ├── initialize-project/
│   ├── brownfield-onboard/
│   ├── research-analyze/
│   └── shared/
└── commands/                     # Bundled slash commands
    ├── init.md
    ├── onboard.md
    └── research.md
```

**Distribution model:**

Skills are files in a directory. This enables multiple distribution paths:

- **Local**: `.codifier/skills/` in the project repo — team-specific, version-controlled alongside the code
- **Org-wide**: Shared via internal npm package or git submodule — tiger team publishes, everyone consumes
- **Public**: Open-source Skills for common patterns — community contribution model
- **npx**: `npx codifier init` for quickstart — always pulls latest from npm

### Core 5: Direct Integrations (RepoMix + Athena)

For MVP, Codifier calls external tools directly — not through the umbrella MCP proxy pattern. Each integration is hardcoded. The SkillManager abstraction is deferred to v2.1.

#### RepoMix (Developer Skills)

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
| 'skip' or empty | Skill instructs LLM to skip repo analysis (greenfield path) |
| Non-supported URL format | Error returned to client with supported platforms listed |

**MVP input scope summary:**

| Input | Source | MVP approach | v2.1 approach |
|---|---|---|---|
| Repo code | GitHub/GitLab/Bitbucket URLs | RepoMix with env tokens | Same, plus Azure DevOps |
| SOW / project docs | User pastes content directly | LLM holds in conversation context | Fetched from Confluence/SharePoint/GDrive via authenticated connectors (SkillManager) |
| Analytics / research data | AWS Athena | Direct Athena MCP integration with `query_data` tool | Same, plus SharePoint and Google Drive via SkillManager |
| Confluence/SharePoint pages | Not supported in MVP | User copies and pastes content | SkillManager with Confluence MCP, SharePoint MCP |

**Deployment prerequisite:** For demos using org private repos, the Fly.io instance must have `GITHUB_TOKEN` (or equivalent) configured as a secret before the MVP demo.

#### AWS Athena MCP (Researcher Skills)

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
| `fetch_context` | Retrieve memories filtered by `project_id`, `memory_type`, `tags`, and/or free-text `query`. Returns matching memories as structured content. |
| `update_memory` | Create or update a memory (rule, doc, contract, learning, research finding) within the current project scope. |
| `manage_projects` | Create, list, switch active project. All subsequent tool calls scoped to the active project. |
| `pack_repo` | Condense a local or remote repo via RepoMix. Store result as a versioned repository snapshot in the active project. *(Developer Skills)* |
| `query_data` | Execute queries against connected data sources (Athena for MVP). Supports schema discovery (`list-tables`, `describe-tables`) and query execution. *(Researcher Skills)* |

**5 tools.** Each one is a discrete data operation. No workflow orchestration, no session management, no stepping protocol. The server is a pure data plane.

**Removed from original plan:** `run_playbook`, `advance_step`. These were server-side workflow orchestration tools replaced by client-side Skills.

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
| **1f** | Skill authoring: Initialize Project + Brownfield Onboard + Research & Analyze | SKILL.md files with prompt templates, tested against MCP tools. |
| **1g** | CLI installer (`npx codifier init`) | Environment detection, Skill scaffolding, MCP config writing. |
| **1h** | Slash commands for all 3 Skills | `/init`, `/onboard`, `/research` activate corresponding Skills. |
| **1i** | Demo + internal dogfooding | Proof-of-concept validated with real projects across both roles. |

**MVP demo scenarios:**

*Developer demo:* A developer runs `npx codifier init` in their project, which scaffolds Skills and configures the MCP connection. They type `/init` (or say "initialize my project"). The LLM reads the Skill, conversationally collects project info, calls `pack_repo` and `update_memory` as needed, generates Rules.md / Evals.md / Requirements.md / Roadmap.md inline, and persists everything to the shared KB. The entire flow is a fluid conversation — no `advance_step` latency, no token-burning round-trips for simple questions.

*Researcher demo:* A researcher runs `/research`. The LLM guides them through defining a research objective, discovering Athena schemas (via `query_data`), reviewing and confirming generated SQL queries, executing them, and synthesizing findings into ResearchFindings.md. All conversational, with MCP calls only for actual data operations.

*Cross-role demo:* A researcher's findings (persisted as `memory_type: research_finding`) are retrieved by a developer via `fetch_context` during the Initialize Project workflow, informing the generated Requirements.md. Knowledge flows across roles, not just within them.

### v2.1 — Extend the foundation

| Feature | Description | Builds on |
|---|---|---|
| **Umbrella MCP / SkillManager** | MCPorter-based proxy pattern. Codifier acts as MCP client to child servers (Confluence, GitHub, SharePoint, Jira). Progressive skill disclosure with `manage_skills` and `invoke_skill` tools. | Core 1 (remote server) |
| **Researcher data sources: SharePoint + Google Drive** | Add SharePoint MCP and Google Drive MCP as data sources. Research & Analyze Skill updated with source selection step. | Core 5 (Athena integration pattern) |
| **Architect Skills** | Technology evaluation, system modeling, architecture decision records (ADRs). Connects to CMDB, cloud config data sources. | Core 3 (Skills) |
| **Strategist Skills** | Roadmap planning, competitive analysis, OKR alignment. Produces strategy artifacts. | Core 3 (Skills) |
| **Semantic search** | Activate vector similarity search on the `embedding` column in `memories`. Hybrid retrieval: exact-match filters + vector ranking. | Core 2 (KB already has embeddings) |
| **Teams bot** | Bot Framework SDK adapter. Read-only KB queries via Teams messages. Skill steps rendered as Adaptive Cards. | Core 1 + Core 3 |
| **Interactive CLI** | Terminal adapter using `inquirer` or `clack` for Skill execution outside the IDE. Alternative to LLM-driven flow for structured input collection. | Core 3 (Skills) + Core 4 (CLI) |
| **Compound engineering plugin integration** | Plugin's `/workflows:compound` calls `update_memory`; `/workflows:plan` calls `fetch_context`. Requires validating plugin extensibility. | Core 2 (KB) |
| **SSO / Entra ID auth** | Replace API key middleware with org SSO. WorkOS device auth flow for CLI. Auth context flows through to connector permissions. | Core 1 (auth middleware) |
| **Memory relationships** | `memory_relationships` table for graph edges between memories (source → target, typed, weighted). Enables "show me everything related to this rule." | Core 2 (KB) |
| **Artifact versioning** | Track versions of generated artifacts (Roadmap.md v1, v2, etc.) with diff history. | Core 3 (Skills) |
| **GSD integration patterns** | Codifier artifacts (Roadmap.md, Requirements.md) formatted for direct use in GSD's `.planning/` directory. | Core 3 (Skills) |
| **Skill marketplace / registry** | Central registry for discovering and installing community and org Skills. `npx codifier add <skill>` pulls from registry. | Core 4 (CLI) |

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
| Data warehouse query engine | Already an MCP server with SQL injection protection | AWS Athena MCP (ColeMurray/aws-athena-mcp) |
| Server-side LLM orchestration | Adds complexity, API key management, model coupling | Client's LLM generates artifacts; Codifier provides context |
| Server-side workflow state machine | Poor UX (latency, token waste), unnecessary server complexity | Client-side Skills — LLM is the state machine |

---

## Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Data backend | Supabase + pgvector | No third-party data review needed. `IDataStore` abstraction preserved. Free tier sufficient for MVP. |
| LLM generation | Client-side | Codifier returns data; client's LLM generates artifacts guided by Skills. Keeps server stateless re: LLM calls. |
| Artifact delivery | LLM saves locally + Skill persists to KB via `update_memory` | User gets local files. Org gets shared memory. Both from same flow. |
| Retrieval (MVP) | Exact-match filtering | `project_id` + `memory_type` + `tags`. Embeddings stored on write but vector search deferred to v2.1. |
| Playbook delivery | Agent Skills (model-agnostic markdown) | Skills are read by any LLM client. No server-side state machine. Fluid conversational UX. |
| Playbook activation | Slash commands | Maps to native client patterns (`.claude/commands/`, `.cursor/rules/`). Zero friction entry point. |
| Skill distribution | npm package + `npx codifier init` | One command to scaffold. Updates via `npx codifier update`. No runtime dependency. |
| RepoMix integration (MVP) | Direct call, not via SkillManager | Hardcoded integration. Umbrella MCP proxy deferred to v2.1. |
| Hosting | Fly.io | Suspend-on-idle, low cost for MVP. |
| Auth (MVP) | Personal API keys | Entra ID deferred to v2.1 until permissions granted. |
| MCP topology (MVP) | Single server, no proxy | Proxy/umbrella pattern deferred to v2.1 with SkillManager. |
| Data querying (MVP) | AWS Athena MCP (hardcoded) | Org uses Athena for analytics. SharePoint/GDrive deferred to v2.1. |

---

## Success Metrics (MVP)

**Developer functional proof:** A developer runs `/init`, completes the conversational flow, and receives 4 artifacts (Rules.md, Evals.md, Requirements.md, Roadmap.md) — all saved locally and persisted to the shared KB.

**Researcher functional proof:** A researcher runs `/research`, completes the conversational flow — discovers Athena schemas, executes queries, and receives ResearchFindings.md.

**Cross-role proof:** A researcher's findings (persisted as `research_finding`) are retrieved by a developer via `fetch_context` on the same project, demonstrating knowledge flowing across roles.

**Persistence proof:** A second user on a different machine calls `fetch_context` and retrieves memories created by the first user.

**Remote access proof:** Codifier MCP is accessible from any MCP client (Cursor, Claude Code) via the remote SSE endpoint without local installation.

**Installation proof:** `npx codifier init` scaffolds Skills, commands, and MCP config in under 30 seconds with zero errors.

**UX proof:** The conversational Skill flow completes with ≤5 MCP tool calls (vs. 8-10 `advance_step` calls in the original design). User never waits for "next step" — the LLM drives the conversation fluidly.

**Dogfooding:** The Codifier team uses Codifier to manage Codifier's own project knowledge base.

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
| CLI | TypeScript, distributed via npm (`npx codifier`) |
| Skill definitions | Markdown files (model-agnostic Agent Skills) |
| Slash commands | Markdown files (mapped to client-native patterns) |

**Deployment Requirements (Fly.io Secrets):**

| Secret | Required | Purpose |
|---|---|---|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | Supabase service role key (server-side, bypasses RLS for admin operations) |
| `CODIFIER_API_KEYS` | Yes | Comma-separated valid API keys for client auth |
| `GITHUB_TOKEN` | For private repos | GitHub PAT or App token with repo read access |
| `GITLAB_TOKEN` | If using GitLab | GitLab PAT with read_repository scope |
| `EMBEDDING_API_KEY` | Yes | API key for embedding model (e.g., OpenAI) — used at ingest only |
| `ATHENA_S3_OUTPUT_LOCATION` | For Researcher workflow | S3 path for Athena query results (e.g., `s3://bucket/athena-results/`) |
| `AWS_REGION` | For Researcher workflow | AWS region for Athena (default: `us-east-1`) |
| `AWS_ACCESS_KEY_ID` | For Researcher workflow | AWS credentials for Athena access (or use `AWS_PROFILE`) |
| `AWS_SECRET_ACCESS_KEY` | For Researcher workflow | AWS credentials for Athena access |

---

## File Structure (MVP)

```
codifier/
├── src/                               # MCP Server
│   ├── server.ts                      # SSE + stdio entry points
│   ├── auth/
│   │   └── apiKeyMiddleware.ts        # API key validation
│   ├── core/
│   │   ├── CodifierCore.ts            # 5 tool handlers (business logic)
│   │   └── types.ts                   # Shared types
│   ├── datastore/
│   │   ├── IDataStore.ts              # Interface (from v1.0)
│   │   └── SupabaseDataStore.ts       # Supabase implementation
│   ├── tools/
│   │   ├── fetchContext.ts
│   │   ├── updateMemory.ts
│   │   ├── manageProjects.ts
│   │   ├── packRepo.ts
│   │   └── queryData.ts
│   └── integrations/
│       ├── repomix.ts                 # Direct RepoMix invocation
│       └── athena.ts                  # Direct Athena MCP invocation
├── cli/                               # CLI Installer (npx codifier)
│   ├── bin/
│   │   └── codifier.ts               # CLI entry point
│   ├── init.ts                        # Scaffold skills + configure MCP
│   ├── update.ts                      # Pull latest skills
│   ├── add.ts                         # Add individual skills
│   ├── doctor.ts                      # Verify connectivity + integrity
│   └── detect.ts                      # Environment detection (Claude Code, Cursor, etc.)
├── skills/                            # Playbook Skills (model-agnostic, distributed via CLI)
│   ├── initialize-project/
│   │   ├── SKILL.md                   # Full workflow instructions for LLM
│   │   └── templates/
│   │       ├── rules-prompt.md
│   │       ├── evals-prompt.md
│   │       ├── requirements-prompt.md
│   │       └── roadmap-prompt.md
│   ├── brownfield-onboard/
│   │   └── SKILL.md
│   ├── research-analyze/
│   │   ├── SKILL.md
│   │   └── templates/
│   │       ├── query-generation-prompt.md
│   │       └── synthesis-prompt.md
│   └── shared/
│       └── codifier-tools.md          # Reference: all 5 MCP tools, params, usage patterns
├── commands/                          # Slash commands (mapped to client-native patterns by CLI)
│   ├── init.md
│   ├── onboard.md
│   └── research.md
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql     # Tables, RLS policies, indexes (no sessions table)
├── fly.toml
├── Dockerfile
├── package.json                       # Includes both server and CLI as separate entry points
└── tsconfig.json
```

**Key structural changes from original plan:**

| Removed | Reason |
|---|---|
| `src/playbooks/PlaybookRunner.ts` | Server-side state machine replaced by client-side Skills |
| `src/playbooks/generators/` | Prompt templates moved to `skills/*/templates/` |
| `src/playbooks/definitions/*.yaml` | YAML playbook definitions replaced by SKILL.md files |
| `src/tools/runPlaybook.ts` | `run_playbook` tool removed |
| `src/tools/advanceStep.ts` | `advance_step` tool removed |
| `sessions` table in schema | No server-side session state |

| Added | Reason |
|---|---|
| `cli/` | `npx codifier init` installer for Skills + MCP config |
| `skills/` | Model-agnostic Playbook Skills (SKILL.md + templates) |
| `commands/` | Slash command definitions (thin wrappers that invoke Skills) |

---

*v2.0 MVP Plan — Revised February 2026*
