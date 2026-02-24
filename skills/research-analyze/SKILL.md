# Skill: Research & Analyze

**Role:** Researcher
**Purpose:** Define a research objective, discover Athena data warehouse schemas, generate and validate SQL queries, execute them, synthesize the findings into a ResearchFindings.md report, and persist it to the shared knowledge base.

See `../shared/codifier-tools.md` for full MCP tool reference.

---

## Prerequisites

- Active MCP connection to the Codifier server
- AWS Athena credentials configured on the server (`AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `ATHENA_S3_OUTPUT_LOCATION`)
- A project to associate the findings with

---

## Workflow

### Step 1 — Identify or Create the Project

Call `manage_projects` with `operation: "list"` and show the user their existing projects.

Ask: **"Which project should these research findings be associated with?"**

Select or create a project and capture the `project_id`.

### Step 2 — Fetch Prior Research

Call `fetch_context` with `{ project_id, memory_type: "research_finding" }` to surface any prior findings relevant to this session.

If prior findings exist, summarize them briefly: **"Here's what we've found before on this project..."**

### Step 3 — Define the Research Objective

Ask the user to describe:
1. **Research objective** — the specific question or hypothesis to investigate
2. **Background context** — business context, prior hypotheses, relevant metrics or KPIs
3. **Time period of interest** — date ranges for the analysis
4. **Known relevant tables** — if the user knows which tables to look at (optional)

Confirm your understanding of the objective before proceeding.

### Step 4 — Discover Available Tables

Call `query_data` with `{ operation: "list-tables", project_id }`.

Present the full table list to the user. Ask: **"Which of these tables are likely relevant to your research objective?"**

### Step 5 — Describe Selected Tables

Call `query_data` with `{ operation: "describe-tables", project_id, table_names: [<user-selected tables>] }`.

Review the returned schemas with the user. Note column names, data types, and any partitioning. Ask if any additional tables should be included.

### Step 6 — Generate SQL Queries

Using the prompt template in `templates/query-generation-prompt.md`, generate SQL queries tailored to the research objective.

**Substitute:**
- `{objective}` — the research objective from Step 3
- `{context}` — background context from Step 3
- `{available_tables}` — full table list from Step 4
- `{table_definitions}` — schema details from Step 5

Present all generated queries to the user. For each query, show:
- Query ID and purpose
- The SQL
- Expected output columns

Ask: **"Do these queries look correct? Which ones should we run, and are there any you'd like to modify?"**

Allow the user to edit, add, or remove queries before execution.

### Step 7 — Execute Approved Queries

For each approved query, call `query_data` with `{ operation: "execute-query", project_id, query: "<sql>" }`.

Execute one query at a time. After each:
- Show the result rows
- Ask: "Does this look as expected, or should we investigate further before continuing?"

If a query returns no results: note this explicitly and ask if the query should be revised.
If a query errors: show the error and ask the user how to proceed.

### Step 8 — Synthesize Findings

Using the prompt template in `templates/synthesis-prompt.md`, synthesize all query results into a ResearchFindings.md report.

**Substitute:**
- `{objective}` — the research objective
- `{context}` — background context
- `{query_results}` — all query results (as structured data)
- `{table_definitions}` — the schema reference from Step 5

Present the full ResearchFindings.md to the user. Ask: **"Does this accurately capture the findings? Any corrections or additions?"**

Incorporate feedback.

### Step 9 — Persist Findings

Call `update_memory`:
```
memory_type: "research_finding"
title: "ResearchFindings — <objective summary> — <YYYY-MM-DD>"
content: {
  text: "<full ResearchFindings.md markdown>",
  objective: "<objective>",
  tables_used: ["<table1>", "<table2>"],
  queries_run: <count>
}
tags: ["research", "<domain-tag>", "<date-tag>"]
source_role: "researcher"
```

### Step 10 — Summarize

Tell the user:
- Project ID and memory ID of the persisted finding
- Tables queried and query count
- Key findings (2–3 sentence summary)
- How developers can access this finding: `fetch_context` with `{ project_id, memory_type: "research_finding" }`

---

## Error Handling

- If `list-tables` returns empty: Athena credentials may not be configured. Inform the user and check the server configuration.
- If a query exceeds the 100KB result cap: the tool returns a truncation notice. Acknowledge this in the findings methodology section.
- If the user asks to run a non-SELECT query: refuse and explain the SELECT-only constraint. Offer an alternative SELECT formulation if possible.
- If synthesis produces speculative conclusions: flag them explicitly with confidence levels (High/Medium/Low) per the synthesis template.
