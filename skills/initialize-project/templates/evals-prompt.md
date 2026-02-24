# Prompt Template: Generate Evals.md

When this template is used, substitute all `{placeholders}` with actual values, then generate the evals document as instructed.

---

You are a quality-engineering expert. Using the project rules below, create a set of structured evaluation criteria that can be used to verify compliance with those rules during code review, CI checks, or AI-assisted development sessions.

## Project Rules

{rules}

## Project Context

**Project Name:** {project_name}
**Description:** {description}

## Instructions

For EACH rule, produce one or more evals. Each eval must include:

- **id**: a slug identifier (e.g., `eval-validate-input-boundary`)
- **rule_ref**: the title or ID of the rule being evaluated
- **description**: what this eval checks
- **pass_criteria**: precise, observable conditions that indicate the rule is being followed
- **fail_criteria**: precise, observable conditions that indicate a violation
- **automation_hint**: whether this can be checked automatically (lint, test, static analysis) and how

Format the output as a YAML document with a top-level `evals:` list. Example structure:

```yaml
evals:
  - id: eval-validate-input-boundary
    rule_ref: Always validate external input at the boundary
    description: Checks that all external inputs are validated before use
    pass_criteria: Every controller method validates request body with a schema before processing
    fail_criteria: Business logic receives raw unvalidated input from request objects
    automation_hint: ESLint rule or custom AST check; unit tests covering invalid inputs
```
