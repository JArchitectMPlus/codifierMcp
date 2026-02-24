# Skill: Brownfield Onboard

**Role:** Developer
**Purpose:** Onboard existing codebases into the Codifier shared knowledge base by packing repositories, generating architectural summaries, and persisting learnings.

See `../shared/codifier-tools.md` for full MCP tool reference.

---

## Prerequisites

- Active MCP connection to the Codifier server
- At least one repository URL (GitHub, GitLab, or local path)
- A project to associate the snapshots with (existing or new)

---

## Workflow

### Step 1 — Identify or Create the Project

Call `manage_projects` with `operation: "list"` and show the user their existing projects.

Ask: **"Which project should these repositories be associated with, or should we create a new one?"**

- If **existing**: use the selected `project_id`.
- If **new**: collect name and optionally org, then call `manage_projects` with `operation: "create"`.

### Step 2 — Collect Repository URLs

Ask the user to provide all repository URLs to onboard. They may provide:
- One or more GitHub/GitLab/Bitbucket HTTPS URLs
- Local filesystem paths (absolute)

Ask: **"Are there any other repos to include, or is this the complete list?"**

Also ask: **"What is the current state of these repos — active development, legacy, recently archived?"**

### Step 3 — Fetch Existing Context

Call `fetch_context` with `{ project_id }` to retrieve any prior memories for this project. Summarize relevant findings to the user — prior architectural decisions, existing rules, or previous onboarding notes are important context.

### Step 4 — Pack Repositories

For each repository URL:
1. Call `pack_repo` with the URL, `project_id`, and a `version_label` (use current date: `"YYYY-MM"` or a tag like `"initial-onboard"`)
2. Note the returned `repository_id`, `token_count`, and `file_count`
3. Inform the user: "Packed `<repo-url>` — `<N>` files, `<M>` tokens"

If a pack fails, log the error and continue with remaining repos.

### Step 5 — Generate Architectural Summary

Using the packed repository content (available in your context from the pack results) and any prior memories, generate a comprehensive architectural summary covering:

1. **System Overview** — what the system does, its primary users, and its business purpose
2. **Technology Stack** — languages, frameworks, databases, infrastructure
3. **Module Structure** — major directories/packages and their responsibilities
4. **Key Interfaces** — APIs, event buses, shared contracts between components
5. **Data Flow** — how data moves through the system from input to output
6. **External Dependencies** — third-party services, APIs, or systems integrated with
7. **Known Issues / Technical Debt** — observations from the code (if apparent)
8. **Conventions Observed** — naming patterns, file organisation, testing approach

Present the summary to the user and ask: **"Does this accurately describe the system? What should be added or corrected?"**

Incorporate feedback.

### Step 6 — Persist Architectural Summary

Call `update_memory`:
```
memory_type: "learning"
title: "Architectural Summary — <repo-name or project-name>"
content: { text: "<full summary markdown>", repos: ["<url1>", "<url2>"] }
tags: ["architecture", "onboarding", "brownfield"]
source_role: "developer"
```

### Step 7 — Persist Architectural Decisions

For any significant architectural decisions uncovered (e.g., "uses event sourcing", "monorepo with Turborepo", "Postgres as primary store"), ask the user which to persist as formal documents.

For each confirmed decision, call `update_memory`:
```
memory_type: "document"
title: "ADR: <decision title>"
content: { text: "<decision description, rationale, and consequences>" }
tags: ["adr", "architecture"]
source_role: "developer"
```

### Step 8 — Summarize

Tell the user:
- Project ID
- Repositories packed (with IDs and token counts)
- Memories persisted (IDs and titles)
- How to retrieve this context in future: `fetch_context` with `{ project_id, tags: ["architecture"] }`

---

## Error Handling

- If `pack_repo` times out or fails: note the error in the summary, ask the user if they want to retry or skip.
- If a repo is private and credentials are not configured: inform the user that the server needs the relevant token (`GITHUB_TOKEN`, `GITLAB_TOKEN`) configured as an environment variable.
- If the packed content is very large (>500K tokens): focus the architectural summary on the highest-level structural observations rather than deep code analysis.
