/**
 * Generator: research-synthesis
 *
 * Produces a prompt that instructs the client LLM to synthesise query results
 * into a structured research findings report.
 */

export function researchSynthesisPrompt(context: Record<string, unknown>): string {
  return `You are a senior data scientist and technical writer. Using the research objective, \
context, and query results below, synthesise a clear and actionable research findings report.

## Research Objective

${context['objective'] ?? '(not provided)'}

## Research Context

${context['context'] ?? '(not provided)'}

## Query Results

${JSON.stringify(context['query_results'] ?? '(no query results provided)', null, 2)}

## Available Schema Reference

${JSON.stringify(context['table_definitions'] ?? context['selected_tables'] ?? {}, null, 2)}

## Instructions

Produce a research findings report with the following sections:

### 1. Executive Summary
2–4 sentences: the most important finding and its business implication.

### 2. Methodology
Describe the data sources used, the queries run, and any data quality considerations or \
limitations discovered.

### 3. Key Findings
For each significant finding:
- **Finding N**: descriptive title
- **Evidence**: specific numbers, percentages, or trends from the query results
- **Interpretation**: what this means in business or research terms
- **Confidence**: High / Medium / Low — with reasoning

### 4. Trends and Patterns
Describe any temporal trends, correlations, anomalies, or unexpected patterns observed.

### 5. Limitations and Caveats
Be explicit about data gaps, potential biases, queries that returned no results, and \
assumptions made during the analysis.

### 6. Recommendations
Actionable next steps based on the findings. Each recommendation should state:
- What action to take
- Who owns it
- Why it follows from the data

### 7. Follow-up Research Questions
List 3–5 questions that this analysis surfaced but could not answer — to guide future research.

Format the output as a structured Markdown document suitable for sharing with stakeholders.`;
}
