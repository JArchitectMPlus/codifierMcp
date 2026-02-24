# Skill: Initialize Project

**Role:** Developer
**Purpose:** Set up a new project in the Codifier shared knowledge base — collecting context, optionally packing repositories, and generating four key artifacts: Rules.md, Evals.md, Requirements.md, and Roadmap.md.

See `../shared/codifier-tools.md` for full MCP tool reference.

---

## Prerequisites

- Active MCP connection to the Codifier server
- Project context: name, description, and optionally a Scope of Work (SOW) document and repo URLs

---

## Workflow

Follow these steps conversationally. You are the state machine — call MCP tools only for data operations.

### Step 1 — Identify or Create the Project

Call `manage_projects` with `operation: "list"` to show the user their existing projects.

Ask: **"Is this a new project, or do you want to use an existing one?"**

- If **existing**: ask the user to select from the list; use that `project_id` for all subsequent calls.
- If **new**: collect a project name and optionally an org name, then call `manage_projects` with `operation: "create"`. Use the returned `project_id` for all subsequent calls.

### Step 2 — Collect Project Context

Gather the following from the user in a single conversational turn:

1. **Project name** (if not already set)
2. **Description** — what does this project build and for whom?
3. **Scope of Work (SOW)** — paste the SOW document, or describe key deliverables if no formal SOW exists
4. **Repository URLs** (optional) — GitHub/GitLab URLs of codebases relevant to this project
5. **Additional context** — any constraints, tech stack, team conventions, or prior decisions

Confirm you have understood all provided context before proceeding.

### Step 3 — Pack Repositories (if URLs provided)

For each repository URL provided:
1. Call `pack_repo` with the URL, `project_id`, and a `version_label` (use the current date or sprint label, e.g., `"2026-02"`)
2. Note the returned `repository_id` and `token_count`
3. Inform the user: "Packed `<repo-url>` — `<N>` tokens"

If no URLs were provided, skip this step.

### Step 4 — Fetch Existing Context

Call `fetch_context` with `{ project_id }` (no type filter) to retrieve any prior memories for this project. This surfaces research findings, prior rules, or existing docs that should inform the new artifacts.

Summarize any relevant findings to the user before generating artifacts.

### Step 5 — Generate Rules.md

Using the prompt template in `templates/rules-prompt.md`, generate a comprehensive set of development rules and coding standards for this project.

**Substitute these placeholders with actual values:**
- `{project_name}` — the project name
- `{description}` — the project description
- `{sow}` — the SOW or deliverables description
- `{repo_urls}` — list of repo URLs (or "none provided")
- `{additional_context}` — any extra context, including relevant memories from Step 4

Present the generated Rules.md to the user inline. Ask: **"Does this look right? Any rules to add, remove, or change?"**

Incorporate feedback before proceeding.

### Step 6 — Generate Evals.md

Using the prompt template in `templates/evals-prompt.md`, generate evaluation criteria from the confirmed Rules.md.

**Substitute:**
- `{rules}` — the confirmed Rules.md content
- `{project_name}` — the project name
- `{description}` — the project description

Present Evals.md inline and ask for confirmation.

### Step 7 — Generate Requirements.md

Using the prompt template in `templates/requirements-prompt.md`, generate a detailed requirements document.

**Substitute:**
- `{project_name}`, `{description}`, `{sow}`, `{repo_urls}`, `{additional_context}`

Present Requirements.md inline and ask for confirmation.

### Step 8 — Generate Roadmap.md

Using the prompt template in `templates/roadmap-prompt.md`, generate a phased implementation roadmap from Requirements.md.

**Substitute:**
- `{requirements}` — the confirmed Requirements.md content
- `{project_name}`, `{description}`, `{repo_urls}`

Present Roadmap.md inline and ask for confirmation.

### Step 9 — Persist All Artifacts

Call `update_memory` four times — once per artifact:

| Artifact | `memory_type` | `title` | `source_role` |
|----------|--------------|---------|---------------|
| Rules.md | `document` | `"Rules.md — <project_name>"` | `"developer"` |
| Evals.md | `document` | `"Evals.md — <project_name>"` | `"developer"` |
| Requirements.md | `document` | `"Requirements.md — <project_name>"` | `"developer"` |
| Roadmap.md | `document` | `"Roadmap.md — <project_name>"` | `"developer"` |

For each call, set `content: { text: "<full artifact markdown>" }` and add relevant `tags` (e.g., `["rules", "standards"]` for Rules.md).

### Step 10 — Summarize

Tell the user:
- Project ID (so they can reference it later)
- Which artifacts were generated and persisted
- How many MCP tool calls were made total
- How to retrieve context in future sessions: `fetch_context` with `{ project_id, memory_type: "document" }`

---

## Context Assembly by Scenario

### Greenfield + SOW
Emphasize SOW deliverables and functional requirements in rules and requirements generation. The roadmap should sequence SOW milestones explicitly.

### Greenfield — No SOW
Prompt the user for key deliverables and target users before generating. Rules should be general-purpose but tailored to the tech stack described.

### Brownfield + SOW
Pack all repos first (Step 3). Fetch existing memories (Step 4) — prior rules and learnings are especially important. SOW delta (what's changing vs. what exists) should drive Requirements.md.

### Brownfield — No SOW
Pack all repos first. Spend extra time in conversation understanding the existing system before generating rules — ask about pain points, constraints, and what must not change.

---

## Error Handling

- If `pack_repo` fails for a URL: log the error, inform the user, and continue with remaining URLs.
- If `update_memory` fails: retry once. If still failing, present the artifact as a code block the user can save manually.
- If the user provides no description or SOW: ask at least 3 clarifying questions before attempting artifact generation.
