# Codifier MCP Tools Reference

This document describes all 5 MCP tools exposed by the Codifier server. Reference this when executing any Codifier skill.

---

## 1. `fetch_context`

Retrieve memories from the shared knowledge base, filtered by project, type, tags, or full-text search.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project_id` | string (UUID) | ✓ | Project to scope the query to |
| `memory_type` | enum | — | Filter by type: `rule`, `document`, `api_contract`, `learning`, `research_finding` |
| `tags` | string[] | — | All supplied tags must be present on the memory |
| `query` | string | — | Full-text search applied to title and content |
| `limit` | number (1–100) | — | Max results (default: 20) |

**Returns:** Array of memory records with `id`, `title`, `content`, `memory_type`, `tags`, `source_role`, `created_at`.

**Usage patterns:**
- Fetch all rules for a project: `{ project_id, memory_type: "rule" }`
- Fetch researcher findings relevant to auth: `{ project_id, memory_type: "research_finding", tags: ["auth"] }`
- Full-text search across all memory types: `{ project_id, query: "payment processing" }`

---

## 2. `update_memory`

Create a new memory or update an existing one in the shared knowledge base.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project_id` | string (UUID) | ✓ | Project to scope this memory to |
| `memory_type` | enum | ✓ | `rule`, `document`, `api_contract`, `learning`, `research_finding` |
| `title` | string | ✓ | Short descriptive title |
| `content` | object | ✓ | Structured content payload (any JSON object) |
| `id` | string (UUID) | — | If provided, updates the existing record instead of creating |
| `tags` | string[] | — | Tags for filtering and categorization |
| `category` | string | — | Category grouping (e.g., "security", "error-handling") |
| `description` | string | — | Human-readable summary |
| `confidence` | number (0–1) | — | Confidence score (default: 1.0) |
| `source_role` | string | — | Role that produced this memory (e.g., "developer", "researcher") |

**Returns:** The created or updated memory record including its `id`.

**Usage patterns:**
- Store a generated Rules.md: `{ project_id, memory_type: "document", title: "Rules.md", content: { text: "..." }, source_role: "developer" }`
- Store a research finding: `{ project_id, memory_type: "research_finding", title: "Q4 Retention Analysis", content: { summary: "...", findings: [...] }, source_role: "researcher" }`
- Update an existing memory: `{ project_id, id: "<existing-id>", memory_type: "rule", title: "...", content: {...} }`

---

## 3. `manage_projects`

Create, list, or switch the active project.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `operation` | enum | ✓ | `create`, `list`, or `switch` |
| `name` | string | For `create` | Project name |
| `org` | string | — | Organisation name (optional for `create`) |
| `project_id` | string (UUID) | For `switch` | Project to switch to |

**Returns:**
- `list`: Array of projects with `id`, `name`, `org`, `created_at`
- `create`: The created project record including its `id`
- `switch`: Confirmation of the active project

**Usage patterns:**
- List all projects: `{ operation: "list" }`
- Create a new project: `{ operation: "create", name: "Payments Redesign", org: "Acme Corp" }`
- Switch to an existing project: `{ operation: "switch", project_id: "<uuid>" }`

---

## 4. `pack_repo`

Condense a code repository into a versioned text snapshot using RepoMix. The snapshot is stored in the `repositories` table and can be retrieved for context.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | ✓ | Repository URL (e.g., `https://github.com/org/repo`) or local path |
| `project_id` | string (UUID) | ✓ | Project to associate the snapshot with |
| `version_label` | string | — | Version label for this snapshot (e.g., `"v1.2.3"`, `"sprint-5"`, `"2026-02"`) |

**Returns:** Repository record with `id`, `url`, `version_label`, `token_count`, `file_count`, and `created_at`.

**Usage patterns:**
- Pack a public GitHub repo: `{ url: "https://github.com/org/repo", project_id, version_label: "2026-02" }`
- Pack multiple repos for brownfield onboarding: call once per repo URL

**Note:** Large repos may take 30–60 seconds. The packed snapshot is plain text suitable for LLM context.

---

## 5. `query_data`

Discover schemas and execute SELECT queries against an AWS Athena data warehouse.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `operation` | enum | ✓ | `list-tables`, `describe-tables`, or `execute-query` |
| `project_id` | string (UUID) | ✓ | Project UUID for session scoping |
| `query` | string | For `execute-query` | SQL SELECT statement to execute |
| `table_names` | string[] | For `describe-tables` | Tables to describe |

**Returns:**
- `list-tables`: Array of available table names
- `describe-tables`: Schema definitions for requested tables
- `execute-query`: Query results (capped at 100KB; truncation notice included if limit hit)

**Usage patterns:**
- Discover available tables: `{ operation: "list-tables", project_id }`
- Get schema for selected tables: `{ operation: "describe-tables", project_id, table_names: ["events", "users"] }`
- Execute a query: `{ operation: "execute-query", project_id, query: "SELECT user_id, COUNT(*) FROM events GROUP BY 1 LIMIT 100" }`

**Constraints:** Only SELECT statements are permitted. DDL and DML are rejected.
