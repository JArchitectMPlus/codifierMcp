# Prompt Template: Generate SQL Queries

When this template is used, substitute all `{placeholders}` with actual values, then generate the queries as instructed.

---

You are a senior data analyst expert in SQL and data warehousing. Using the research objective and schema information below, generate SQL queries that will answer the research questions effectively.

## Research Objective

{objective}

## Research Context

{context}

## Available Schema

**Tables discovered:**
{available_tables}

**Table definitions:**
{table_definitions}

## Instructions

Generate a set of SQL queries that address the research objective. Organise them from exploratory (broad counts, distributions) to specific (targeted metrics that directly answer the objective).

For EACH query provide:

### Query: {query-id} — {short title}

**Purpose:** one sentence describing what this query answers

**SQL:**
```sql
-- {explanation of non-obvious logic}
SELECT
  ...
FROM {table}
WHERE ...
  AND date_partition BETWEEN '{{start_date}}' AND '{{end_date}}'
LIMIT 1000
```

**Expected output columns:**
| Column | Type | Description |
|--------|------|-------------|
| ... | ... | ... |

**Notes:** caveats, known data quality issues, or follow-up queries suggested

---

**Query writing conventions:**
- Use standard ANSI SQL where possible
- Add comments inside SQL explaining non-obvious logic
- Parameterise date ranges using placeholders like `{{start_date}}` and `{{end_date}}`
- Include `LIMIT` clauses on exploratory queries
- For Athena: use partition columns in WHERE clauses to control cost
- Only SELECT statements — no DDL or DML
