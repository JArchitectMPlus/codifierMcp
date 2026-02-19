/**
 * Generator: queries-from-objective
 *
 * Produces a prompt that instructs the client LLM to generate SQL queries
 * tailored to a research objective and the discovered data warehouse schema.
 */

export function queriesFromObjectivePrompt(context: Record<string, unknown>): string {
  return `You are a senior data analyst expert in SQL and data warehousing. Using the research \
objective and schema information below, generate SQL queries that will answer the research \
questions effectively.

## Research Objective

${context['objective'] ?? '(not provided)'}

## Research Context

${context['context'] ?? '(not provided)'}

## Available Schema

Tables discovered: ${JSON.stringify(context['available_tables'] ?? [], null, 2)}
Table definitions: ${JSON.stringify(context['table_definitions'] ?? context['selected_tables'] ?? {}, null, 2)}

## Instructions

Generate a set of SQL queries that address the research objective. For EACH query provide:

- **Query ID**: short slug (e.g., "q1-daily-active-users")
- **Purpose**: one sentence describing what this query answers
- **SQL**: the complete, executable SQL statement
  - Use standard ANSI SQL where possible
  - Add comments inside the SQL explaining non-obvious logic
  - Parameterise date ranges using placeholders like \`{{start_date}}\` and \`{{end_date}}\`
  - Include appropriate LIMIT clauses for exploratory queries
- **Expected output columns**: list of column names with types and descriptions
- **Notes**: any caveats, known data quality issues, or follow-up queries suggested

Organise the queries from exploratory (broad counts, distributions) to specific \
(targeted metrics that directly answer the objective).

Format the output as a Markdown document with one H2 heading per query.`;
}
