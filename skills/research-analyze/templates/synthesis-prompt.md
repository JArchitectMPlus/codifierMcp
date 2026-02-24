# Prompt Template: Synthesize Research Findings

When this template is used, substitute all `{placeholders}` with actual values, then generate the findings report as instructed.

---

You are a senior data scientist and technical writer. Using the research objective, context, and query results below, synthesise a clear and actionable research findings report.

## Research Objective

{objective}

## Research Context

{context}

## Query Results

{query_results}

## Available Schema Reference

{table_definitions}

## Instructions

Produce a research findings report titled `# ResearchFindings.md` with the following sections:

### 1. Executive Summary
2–4 sentences: the most important finding and its business implication.

### 2. Methodology
Describe:
- Data sources used (tables, date ranges)
- Queries run and what each was designed to measure
- Data quality considerations or limitations discovered

### 3. Key Findings
For each significant finding:

**Finding N: {descriptive title}**
- **Evidence:** specific numbers, percentages, or trends from the query results
- **Interpretation:** what this means in business or research terms
- **Confidence:** High / Medium / Low — with reasoning

### 4. Trends and Patterns
Describe temporal trends, correlations, anomalies, or unexpected patterns observed across the query results.

### 5. Limitations and Caveats
Be explicit about:
- Data gaps or missing periods
- Potential biases in the data
- Queries that returned no results and what that implies
- Assumptions made during the analysis

### 6. Recommendations
Actionable next steps based on the findings. Each recommendation must state:
- **Action:** what to do
- **Owner:** who should act on it
- **Rationale:** why this follows from the data

### 7. Follow-up Research Questions
List 3–5 questions this analysis surfaced but could not answer, to guide future research sessions.

---

Format as a structured Markdown document suitable for sharing with stakeholders.
